"""Authenticated native Home Assistant model and device APIs."""

from __future__ import annotations

import asyncio
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
from .models import ENTITY, MAX_UPLOAD, number


class RoomsRuntime:
    """Serialize local mutations; use HA's service bus with the caller context."""

    def __init__(self, hass, store):
        self.hass = hass
        self.store = store
        self.lock = asyncio.Lock()

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
                if s.domain in ("light", "switch", "cover", "sun")
            ],
        }

    async def request(self, operation, data, user_id):
        if operation == "components":
            from copy import deepcopy
            return deepcopy(self.store.components)
        if operation == "save_component":
            return await self.work(self.store.put_component, data)
        if operation == "delete_component":
            return await self.work(self.store.remove_component, data.get("id"))
        if operation == "models":
            return self.store.catalog()
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
        if operation == "bindings":
            entity_id = data.get("entityId", "")
            if not isinstance(entity_id, str) or (
                entity_id and not self.hass.states.get(entity_id)
            ):
                raise ValueError("Choose an existing light, switch or cover entity.")
            result = await self.work(
                self.store.bind, data.get("model"), data.get("controlId"), entity_id
            )
            self.hass.bus.async_fire("three_d_rooms_updated")
            return result
        if operation == "delete":
            result = await self.work(self.store.remove, data.get("model"))
            self.hass.bus.async_fire("three_d_rooms_updated")
            return result
        if operation == "command":
            model = self.store.find(data.get("model"))
            control = next(
                (c for c in model["controls"] if c["id"] == data.get("controlId")), None
            )
            entity_id = model["bindings"].get(data.get("controlId"))
            if not control or not entity_id or not ENTITY.fullmatch(entity_id):
                raise ValueError("Connect this control to an entity first.")
            entity = self.hass.states.get(entity_id)
            if not entity or entity.state in ("unavailable", "unknown"):
                raise ValueError("This entity is unavailable.")
            is_cover = control.get("type") == "cover"
            if (entity.domain == "cover") != is_cover:
                raise ValueError("Entity does not match this control type.")
            if is_cover:
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


class ModelUploadView(HomeAssistantView):
    url = "/api/three_d_rooms/models"
    name = "api:three_d_rooms:upload"
    requires_auth = True

    def __init__(self, hass):
        self.hass = hass

    async def post(self, request):
        runtime = runtime_for(request, self.hass)
        data = bytearray()
        async for piece in request.content.iter_chunked(1024 * 1024):
            data.extend(piece)
            if len(data) > MAX_UPLOAD:
                return self.json({"error": "Upload exceeds 100 MB."}, 413)
        try:
            result = await runtime.work(runtime.store.install, bytes(data))
        except (
            ValueError,
            KeyError,
            TypeError,
            UnicodeError,
            zipfile.BadZipFile,
        ) as error:
            return self.json({"error": str(error)}, 400)
        self.hass.bus.async_fire("three_d_rooms_updated")
        return self.json(result, 201)


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
                revision = runtime.store.revision(model_id)
                # Authentication/admin checks precede all cache revalidation.
                headers = {
                    "Cache-Control": "private, no-cache",
                    "Vary": "Authorization, Accept-Encoding",
                    "ETag": f'W/"{revision}"',
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
                data = await runtime.work(
                    runtime.store.scene_bytes, model_id, compressed
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
