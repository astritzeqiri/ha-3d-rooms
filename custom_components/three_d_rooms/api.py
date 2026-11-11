"""Authenticated native Home Assistant model and device APIs."""

from __future__ import annotations

from .light_groups import apply_light_groups

import asyncio
import logging
import base64
import binascii
import json
import zipfile
from aiohttp import web

try:
    import probatio as vol
except ImportError:  # Home Assistant versions before the schema migration.
    import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import Context
from homeassistant.exceptions import HomeAssistantError
from .const import DOMAIN
from .models import ENTITY, MAX_UPLOAD, number, compatible_entity
from .house_matching import MAX_CHOICES

LOGGER = logging.getLogger(__name__)





class RoomsRuntime:
    """Serialize local mutations; use HA's service bus with the caller context."""

    def __init__(self, hass, store):
        self.hass = hass
        self.store = store
        self.lock = asyncio.Lock()
        self.optimizer = None

    def schedule_optimize(self):
        """Make lighter copies of rooms in the background; uploads stay usable meanwhile."""
        if self.optimizer is None or self.optimizer.done():
            self.optimizer = self.hass.async_create_background_task(
                self.optimize_pending(), "three_d_rooms optimize scenes"
            )

    async def optimize_pending(self):
        failed = set()
        while True:
            pending = [p for p in await self.hass.async_add_executor_job(self.store.pending_optimizations) if p not in failed]
            if not pending:
                return
            model_id, folder = pending[0]
            try:
                written = await self.hass.async_add_executor_job(self.store.optimize_room, model_id, folder)
            except Exception:  # noqa: BLE001 - the room keeps loading from its upload
                LOGGER.exception("Could not optimize 3D room %s", model_id)
                written = False
            if not written:
                failed.add((model_id, folder))
                continue
            # Cards and the manager reload once to pick up the lighter copy.
            self.hass.bus.async_fire("three_d_rooms_updated")

    async def work(self, function, *args):
        async with self.lock:
            return await self.hass.async_add_executor_job(function, *args)

    def status(self):
        return {
            "connected": True,
            "mode": "homeassistant",
            "entities": [
                s.as_dict()
                for s in self.hass.states.async_all()
                if s.domain in ("climate", "light", "switch", "cover", "lock", "sun", "binary_sensor", "number", "input_number", "button", "input_button", "script", "scene")
            ],
        }

    async def request(self, operation, data, user_id):
        if operation == "floors":
            from homeassistant.helpers import floor_registry
            registry = floor_registry.async_get(self.hass)
            return [{"floor_id":f.floor_id,"name":f.name,"level":f.level} for f in registry.async_list_floors()]
        if operation == "areas":
            from homeassistant.helpers import area_registry
            registry = area_registry.async_get(self.hass)
            return [{"area_id": a.id, "name": a.name, "floor_id": a.floor_id}
                    for a in registry.async_list_areas()]
        if operation == "room":
            from homeassistant.helpers import area_registry
            settings = {k: data[k] for k in ("title", "areaId", "floorIds", "floorLinks", "appearance", "groupIcons") if k in data}
            if "areaId" in settings:
                area_id = settings["areaId"]
                if not isinstance(area_id, str) or (
                    area_id and not area_registry.async_get(self.hass).async_get_area(area_id)
                ):
                    raise ValueError("Choose an existing Home Assistant area.")
            if "floorLinks" in data or "haFloorIds" in data:
                from homeassistant.helpers import floor_registry
                floors = floor_registry.async_get(self.hass)
                links = data.get("floorLinks",{})
                if not isinstance(links,dict) or any(not isinstance(v,str) or (v and not floors.async_get_floor(v)) for v in links.values()):
                    raise ValueError("Choose existing Home Assistant floors.")
                if "haFloorIds" in data:
                    ids = data["haFloorIds"]
                    if not isinstance(ids,list) or len(ids)>30 or not all(isinstance(i,str) and floors.async_get_floor(i) for i in ids):
                        raise ValueError("Choose existing Home Assistant floors.")
                    placement = self.store.find(data.get("model")).get("housePlacement")
                    if not placement: raise ValueError("Export house placement and floor heights first.")
                    effective = {f["id"]:links.get(f["id"],f.get("haFloorId","")) for f in placement["floors"]}
                    if any(i not in effective.values() for i in ids): raise ValueError("Match each selected Home Assistant floor to a saved height range first.")
                    # With no house floor linked, the choice says nothing: keep the room's floors.
                    if any(effective.values()):
                        settings["floorIds"] = [key for key,value in effective.items() if value in ids]
            result = await self.work(self.store.update_room, data.get("model"), settings)
            self.hass.bus.async_fire("three_d_rooms_updated")
            return result
        if operation == "components":
            from copy import deepcopy
            components = deepcopy(self.store.components)
            # A card asks for its own view only, so its thumbnail stays small to send.
            if isinstance(data.get("id"), str):
                components = [c for c in components if c.get("id") == data["id"]]
            if not data.get("include_thumbnails", False):
                for component in components:
                    component.pop("thumbnail", None)
            # The transparent art is only for the manager's gallery.
            if not data.get("include_art", False):
                for component in components:
                    component.pop("thumbnailArt", None)
            return components
        if operation == "save_component":
            result = await self.work(self.store.put_component, data)
            self.hass.bus.async_fire("three_d_rooms_updated")
            return result
        if operation == "delete_component":
            result = await self.work(self.store.remove_component, data.get("id"))
            self.hass.bus.async_fire("three_d_rooms_updated")
            return result
        if operation == "models":
            from homeassistant.helpers import floor_registry
            registry=floor_registry.async_get(self.hass)
            return self.store.catalog({f.floor_id:f.name for f in registry.async_list_floors()})
        if operation == "optimization":
            return await self.hass.async_add_executor_job(self.store.optimization_status, data.get("model"))
        if operation == "status":
            return self.status()
        if operation == "daylight":
            entity_id = data.get("entity")
            entity = self.hass.states.get(entity_id) if isinstance(entity_id, str) else None
            if data.get("mode") == "auto" and (not entity or entity.domain != "sun"):
                raise ValueError("Choose an existing sun entity for Auto daylight.")
            result = await self.work(self.store.set_daylight, data.get("model"), data)
            self.hass.bus.async_fire("three_d_rooms_updated")
            return result
        if operation == "device-visibility":
            result = await self.work(self.store.set_device_visibility, data.get("model"), data.get("controlId"), data.get("hidden"))
            self.hass.bus.async_fire("three_d_rooms_updated")
            return result
        if operation == "device-marker":
            changes = {k: data[k] for k in ("position", "icon", "icon_off") if k in data}
            result = await self.work(self.store.set_device_marker, data.get("model"), data.get("controlId"), changes)
            self.hass.bus.async_fire("three_d_rooms_updated")
            return result
        if operation == "device-settings":
            result = await self.work(self.store.set_device_settings, data.get("model"), data.get("deviceId"), data.get("macroNames"))
            self.hass.bus.async_fire("three_d_rooms_updated")
            return result
        if operation == "light-groups":
            groups = data.get("groups")
            if isinstance(groups, list):
                for group in groups:
                    entity_id = group.get("entityId") if isinstance(group, dict) else None
                    if entity_id and (not isinstance(entity_id, str) or not self.hass.states.get(entity_id)):
                        raise ValueError("Choose an existing entity for the group.")
            result = await self.work(self.store.set_light_groups, data.get("model"), groups)
            self.hass.bus.async_fire("three_d_rooms_updated")
            return result
        if operation == "bindings":
            entity_id = data.get("entityId", "")
            if not isinstance(entity_id, str) or (
                entity_id and not self.hass.states.get(entity_id)
            ):
                raise ValueError("Choose an existing entity for this device.")
            result = await self.work(
                self.store.bind, data.get("model"), data.get("controlId"), entity_id
            )
            self.hass.bus.async_fire("three_d_rooms_updated")
            return result
        if operation == "house_summary":
            return await self.work(self.store.house_summary, data.get("house"))
        if operation == "delete_house":
            result = await self.work(self.store.remove_house, data.get("house"), data.get("revision"))
            self.hass.bus.async_fire("three_d_rooms_updated")
            return result
        if operation == "delete":
            result = await self.work(self.store.remove, data.get("model"))
            self.hass.bus.async_fire("three_d_rooms_updated")
            return result
        if operation == "command":
            model = apply_light_groups(self.store.find(data.get("model")))
            control = next(
                (c for c in model["controls"] if c["id"] == data.get("controlId")), None
            )
            entity_id = model["bindings"].get(data.get("controlId"))
            if not control or not entity_id or not ENTITY.fullmatch(entity_id):
                raise ValueError("Connect this control to an entity first.")
            entity = self.hass.states.get(entity_id)
            if not entity or entity.state == "unavailable" or (entity.state == "unknown" and control.get("type") != "button"):
                raise ValueError("This entity is unavailable.")
            is_cover = control.get("type") == "cover"
            if not compatible_entity(control, entity_id):
                raise ValueError("Entity does not match this control type.")
            if control.get("type") == "climate":
                raise ValueError("Use Home Assistant climate controls from the device dialog.")
            if control.get("type") == "button":
                if data.get("action") != "press" or "press" not in control["capabilities"]:
                    raise ValueError("Use the preset's press action.")
                service, settings = ("press" if entity.domain in ("button", "input_button") else "turn_on"), {}
            elif control.get("type") == "lock":
                service, settings = lock_command(data, control, entity)
            elif control.get("type") == "number":
                service, settings = number_command(data, control, entity)
            elif is_cover:
                service, settings = cover_command(data, control, entity)
            else:
                settings = light_command(data, control, entity)
                service = "turn_on" if data["action"] == "on" else "turn_off"
            await self.hass.services.async_call(
                entity.domain,
                service,
                {"entity_id": entity_id, **settings},
                blocking=True,
                context=Context(user_id=user_id),
            )
            return {"ok": True}
        raise ValueError("Unknown 3D Rooms operation.")


def number_command(data, control, entity):
    """Set a mapped desk height only inside both model and device limits."""
    import math
    attrs = entity.attributes
    try:
        reported = float(entity.state)
    except (TypeError, ValueError):
        raise ValueError("This number is unavailable.") from None
    if not math.isfinite(reported) or not control["min"] <= reported <= control["max"]:
        raise ValueError("This number is outside the modeled range.")
    value = data.get("value")
    if (data.get("action") != "set_value" or "set_value" not in control["capabilities"]
        or entity.domain not in ("number", "input_number")
        or attrs.get("unit_of_measurement", control["unit"]) != control["unit"]):
        raise ValueError("Choose an available number with matching units.")
    if (not number(value) or not control["min"] <= value <= control["max"]
        or not number(attrs.get("min")) or not number(attrs.get("max"))
        or not attrs["min"] <= value <= attrs["max"]):
        raise ValueError("Value is outside the desk or entity range.")
    for minimum, step in ((control["min"], control["step"]), (attrs["min"], attrs.get("step"))):
        if not number(step) or step <= 0 or not math.isclose((value-minimum)/step, round((value-minimum)/step), abs_tol=1e-6, rel_tol=0):
            raise ValueError("Value must follow the allowed step.")
    return "set_value", {"value": value}


def lock_command(data, control, entity):
    """Lock or unlock only; locks that need a code use Home Assistant's own dialog."""
    action = data.get("action")
    if (
        action not in ("lock", "unlock")
        or entity.domain != "lock"
        or "lock_unlock" not in control["capabilities"]
    ):
        raise ValueError("Choose lock or unlock.")
    if entity.attributes.get("code_format"):
        raise ValueError("This lock needs a code; use the Home Assistant lock dialog.")
    return action, {}


def cover_command(data, control, entity):
    """Gate cover services on both declared and actual device capabilities."""
    action = data.get("action")
    actions = {
        "open": (1, "open_close", "open_cover"),
        "close": (2, "open_close", "close_cover"),
        "position": (4, "position", "set_cover_position"),
        "stop": (8, "stop", "stop_cover"),
    }
    if action not in actions or entity.domain != "cover":
        raise ValueError("Choose an explicit cover action.")
    bit, capability, service = actions[action]
    if (
        not entity.attributes.get("supported_features", 0) & bit
        or capability not in control["capabilities"]
    ):
        raise ValueError("This cover does not support that action.")
    position = data.get("position")
    if action == "position":
        if (
            isinstance(position, bool)
            or not isinstance(position, int)
            or not 0 <= position <= 100
        ):
            raise ValueError("Cover position must be an integer from 0 to 100.")
        return service, {"position": position}
    return service, {}


def light_command(data, control, entity):
    """Only allow capabilities the actual light reports, with bounded values."""
    if data.get("action") not in ("on", "off"):
        raise ValueError("Use an explicit on/off command.")
    attrs = entity.attributes
    modes = attrs.get("supported_color_modes", [])
    features = attrs.get("supported_features", 0)
    settings = {
        key: data[key]
        for key in (
            "brightness",
            "rgb_color",
            "color_temp_kelvin",
            "effect",
            "transition",
        )
        if key in data
    }
    if entity.domain != "light" and settings:
        raise ValueError("Switch entities only support on/off.")
    if data["action"] == "off" and any(
        key in settings
        for key in ("brightness", "rgb_color", "color_temp_kelvin", "effect")
    ):
        raise ValueError("Brightness, color and effects require turn-on.")
    if "brightness" in settings:
        value = settings["brightness"]
        if (
            "brightness" not in control["capabilities"]
            or not any(
                m in modes
                for m in (
                    "brightness",
                    "color_temp",
                    "white",
                    "hs",
                    "xy",
                    "rgb",
                    "rgbw",
                    "rgbww",
                )
            )
            or not number(value)
            or not 1 <= value <= 255
        ):
            raise ValueError("Brightness must be supported and between 1 and 255.")
        settings["brightness"] = round(value)
    if "rgb_color" in settings and "color_temp_kelvin" in settings:
        raise ValueError("Choose color or temperature in one command.")
    if "rgb_color" in settings:
        rgb = settings["rgb_color"]
        if (
            not any(m in modes for m in ("hs", "xy", "rgb", "rgbw", "rgbww"))
            or not isinstance(rgb, list)
            or len(rgb) != 3
            or not all(
                isinstance(v, int) and not isinstance(v, bool) and 0 <= v <= 255
                for v in rgb
            )
        ):
            raise ValueError("Unsupported RGB color.")
    if "color_temp_kelvin" in settings:
        kelvin = settings["color_temp_kelvin"]
        if (
            "color_temp" not in modes
            or not isinstance(kelvin, int)
            or isinstance(kelvin, bool)
            or not attrs.get("min_color_temp_kelvin", 2000)
            <= kelvin
            <= attrs.get("max_color_temp_kelvin", 6535)
        ):
            raise ValueError(
                "Temperature is outside the light's supported Kelvin range."
            )
    if "effect" in settings and (
        not features & 4 or settings["effect"] not in attrs.get("effect_list", [])
    ):
        raise ValueError("Choose an effect supported by this light.")
    if "transition" in settings and (
        not features & 32
        or not number(settings["transition"])
        or not 0 <= settings["transition"] <= 60
    ):
        raise ValueError("Fade must be supported and between 0 and 60 seconds.")
    return settings


@websocket_api.websocket_command(
    {
        "type": "three_d_rooms/request",
        vol.Required("operation"): str,
        vol.Optional("data", default={}): dict,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_request(hass, connection, msg):
    """Handle model metadata without Supervisor or another access token."""
    runtime = hass.data.get(DOMAIN, {}).get("runtime")
    if runtime is None:
        connection.send_error(
            msg["id"], "not_loaded", "Set up 3D Rooms in Devices & services first."
        )
        return
    try:
        result = await runtime.request(
            msg["operation"], msg["data"], connection.user.id
        )
    except (ValueError, TypeError, HomeAssistantError) as error:
        connection.send_error(msg["id"], "invalid_request", str(error))
    else:
        connection.send_result(msg["id"], result)


def runtime_for(request, hass):
    """HA authenticates the HTTP request; we also require administrator access."""
    user = request.get("hass_user")
    if user is None or not user.is_admin:
        raise web.HTTPForbidden(text="Administrator access is required.")
    runtime = hass.data.get(DOMAIN, {}).get("runtime")
    if runtime is None:
        raise web.HTTPServiceUnavailable(text="Set up 3D Rooms first.")
    return runtime


async def read_upload(request):
    """Collect a bounded ZIP body, or return None when it exceeds the limit."""
    data = bytearray()
    async for piece in request.content.iter_chunked(1024 * 1024):
        data.extend(piece)
        if len(data) > MAX_UPLOAD:
            return None
    return bytes(data)


def house_choices(header):
    """Decode reviewed room/device choices sent as base64url JSON."""
    if not header:
        return None
    if len(header) > MAX_CHOICES:
        raise ValueError("Too many room matching choices.")
    try:
        return json.loads(base64.urlsafe_b64decode(header + "=" * (-len(header) % 4)))
    except (binascii.Error, ValueError) as error:
        raise ValueError("Invalid room matching choices.") from error


UPLOAD_ERRORS = (ValueError, KeyError, TypeError, UnicodeError, zipfile.BadZipFile)


class ModelUploadView(HomeAssistantView):
    url = "/api/three_d_rooms/models"
    name = "api:three_d_rooms:upload"
    requires_auth = True

    def __init__(self, hass):
        self.hass = hass

    async def post(self, request):
        runtime = runtime_for(request, self.hass)
        data = await read_upload(request)
        if data is None:
            return self.json({"error": "Upload exceeds 100 MB."}, 413)
        try:
            result = await runtime.work(runtime.store.install_upload, data)
        except UPLOAD_ERRORS as error:
            return self.json({"error": str(error)}, 400)
        self.hass.bus.async_fire("three_d_rooms_updated")
        runtime.schedule_optimize()
        return self.json(result, 201)


class HouseReplaceView(HomeAssistantView):
    url = "/api/three_d_rooms/houses/{house_id}"
    name = "api:three_d_rooms:replace_house"
    requires_auth = True

    def __init__(self, hass):
        self.hass = hass

    async def post(self, request, house_id):
        return await self.upload(request, house_id, True)

    async def put(self, request, house_id):
        return await self.upload(request, house_id, False)

    async def upload(self, request, house_id, preview):
        runtime = runtime_for(request, self.hass)
        data = await read_upload(request)
        if data is None:
            return self.json({"error": "Upload exceeds 100 MB."}, 413)
        try:
            result = await runtime.work(runtime.store.replace_house, house_id, data,
                                        request.headers.get("X-Rooms-Revision"), preview,
                                        house_choices(request.headers.get("X-Rooms-Matches")))
        except UPLOAD_ERRORS as error:
            return self.json({"error": str(error)}, 400)
        if not preview:
            self.hass.bus.async_fire("three_d_rooms_updated")
            runtime.schedule_optimize()
        return self.json(result)


class ModelReplaceView(HomeAssistantView):
    """Replace one room's model package without losing its configuration."""

    url = "/api/three_d_rooms/models/{model_id}"
    name = "api:three_d_rooms:replace"
    requires_auth = True

    def __init__(self, hass):
        self.hass = hass

    async def put(self, request, model_id):
        runtime = runtime_for(request, self.hass)
        data = await read_upload(request)
        if data is None:
            return self.json({"error": "Upload exceeds 100 MB."}, 413)
        try:
            result = await runtime.work(runtime.store.replace, model_id, data)
        except UPLOAD_ERRORS as error:
            return self.json({"error": str(error)}, 400)
        self.hass.bus.async_fire("three_d_rooms_updated")
        runtime.schedule_optimize()
        return self.json(result)


class ModelAssetView(HomeAssistantView):
    url = "/api/three_d_rooms/models/{model_id}/{asset}"
    name = "api:three_d_rooms:asset"
    requires_auth = True

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request, model_id, asset):
        runtime = runtime_for(request, self.hass)
        try:
            if asset == "scene.glb":
                variant = request.query.get("variant", "original")
                if variant not in ("original", "full", "phone"):
                    raise ValueError("Unknown scene variant.")
                revision = runtime.store.revision(model_id)
                # Authentication/admin checks precede all cache revalidation.
                headers = {
                    "Cache-Control": "private, no-cache",
                    "Vary": "Authorization, Accept-Encoding",
                    "ETag": f'W/"{revision}-{variant}"',
                    "X-Content-Type-Options": "nosniff",
                }
                if request.headers.get("If-None-Match") in (headers["ETag"], "*"):
                    return web.Response(status=304, headers=headers)
                compressed = False
                for encoding in (
                    request.headers.get("Accept-Encoding", "").lower().split(",")
                ):
                    parts = [p.strip() for p in encoding.split(";")]
                    if parts[0] != "gzip":
                        continue
                    try:
                        compressed = all(
                            float(p[2:]) > 0 for p in parts[1:] if p.startswith("q=")
                        )
                    except ValueError:
                        compressed = False
                # Reads only; no need to queue behind uploads.
                data = await self.hass.async_add_executor_job(
                    runtime.store.scene_bytes, model_id, compressed, variant
                )
                if compressed:
                    headers["Content-Encoding"] = "gzip"
                return web.Response(
                    body=data, content_type="model/gltf-binary", headers=headers
                )
            elif asset == "export.zip":
                data = await runtime.work(runtime.store.export, model_id)
                content_type, filename = "application/zip", f"{model_id}.zip"
            else:
                raise ValueError("Unknown model asset.")
        except (ValueError, FileNotFoundError):
            raise web.HTTPNotFound() from None
        return web.Response(
            body=data,
            content_type=content_type,
            headers={
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )


class ModelOptimizedView(HomeAssistantView):
    """Accept a browser-optimized copy of one room (the upload itself is kept)."""

    url = "/api/three_d_rooms/models/{model_id}/optimized/{variant}"
    name = "api:three_d_rooms:optimized"
    requires_auth = True

    def __init__(self, hass):
        self.hass = hass

    async def put(self, request, model_id, variant):
        runtime = runtime_for(request, self.hass)
        data = await read_upload(request)
        if data is None:
            return self.json({"error": "Optimized scene exceeds 100 MB."}, 413)
        try:
            result = await runtime.work(
                runtime.store.put_web_variant, model_id, variant, data,
                request.headers.get("X-Rooms-Source-Revision"),
            )
        except UPLOAD_ERRORS as error:
            return self.json({"error": str(error)}, 400)
        self.hass.bus.async_fire("three_d_rooms_updated")
        return self.json(result)
