"""Native API permission, mapping and service validation against Home Assistant.

Run inside the official HA container with this repo mounted at /repo:
python -m unittest discover -s /repo/integration-tests -p test_native.py -v
"""

import importlib
import json
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace
import unittest

# The container's /config/custom_components contains this integration.
sys.path.insert(0, "/config")
try:
    import homeassistant
except ImportError:
    homeassistant = None


@unittest.skipIf(homeassistant is None, "Run native tests in the official HA runtime")
class NativeTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        from homeassistant.core import HomeAssistant

        self.api = importlib.import_module("custom_components.three_d_rooms.api")
        self.models = importlib.import_module("custom_components.three_d_rooms.models")
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.hass = HomeAssistant(self.temp.name)
        self.store = self.models.ModelStore(self.temp.name).open()
        self.runtime = self.api.RoomsRuntime(self.hass, self.store)
        self.hass.data["three_d_rooms"] = {"runtime": self.runtime}
        self.store.models = [
            {
                "id": "kitchen",
                "controls": [
                    {"id": "ceiling", "capabilities": ["on_off", "brightness"]}
                ],
                "bindings": {"ceiling": "light.kitchen"},
            }
        ]

    async def asyncTearDown(self):
        await self.hass.async_stop()

    async def test_room_visibility_persists_and_notifies_without_touching_bindings(self):
        from unittest.mock import patch
        with patch.object(type(self.hass.bus), "async_fire") as fire:
            result = await self.runtime.request("device-visibility", {"model": "kitchen", "controlId": "ceiling", "hidden": True}, "test-user")
            self.assertTrue(result["controls"][0]["hidden"])
            fire.assert_called_once_with("three_d_rooms_updated")
        self.assertTrue(json.loads((self.store.directory / "catalog.json").read_text())["models"][0]["controls"][0]["hidden"])
        self.assertEqual(self.store.find("kitchen")["bindings"], {"ceiling": "light.kitchen"})
        for invalid in [None, 1, "true"]:
            with self.assertRaises(ValueError):
                await self.runtime.request("device-visibility", {"model": "kitchen", "controlId": "ceiling", "hidden": invalid}, "test-user")
        await self.runtime.request("device-visibility", {"model": "kitchen", "controlId": "ceiling", "hidden": False}, "test-user")
        self.assertNotIn("hidden", self.store.find("kitchen")["controls"][0])

    async def test_full_house_upload_uses_native_api_and_keeps_independent_rooms(self):
        from unittest.mock import AsyncMock, patch
        from io import BytesIO
        import struct
        import zipfile
        entries = {}
        for index, room in enumerate(["kitchen", "office"]):
            placement = {"schemaVersion": 1, "houseId": "house-test", "houseName": "Test house", "roomId": room, "transform": [1,0,0,0,0,1,0,0,0,0,1,0,index*4,0,0,1], "floors": [], "floorIds": []}
            manifest = {"schemaVersion": 1, "id": room, "title": room.title(), "units": "meters", "up": "Y", "scene": "scene.glb", "controls": [], "housePlacement": placement}
            doc = json.dumps({"asset": {"version": "2.0"}}).encode()
            doc += b" " * (-len(doc) % 4)
            glb = struct.pack("<4sIIII", b"glTF", 2, len(doc)+20, len(doc), 0x4E4F534A) + doc
            output = BytesIO()
            with zipfile.ZipFile(output, "w") as archive:
                archive.writestr("manifest.json", json.dumps(manifest))
                archive.writestr("scene.glb", glb)
            entries[f"rooms/{room}.zip"] = output.getvalue()
        output = BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr("house-manifest.json", json.dumps({"format": "three-d-rooms-house/1", "houseId": "house-test", "houseName": "Test house", "rooms": list(entries)}))
            for name, payload in entries.items():
                archive.writestr(name, payload)
        payload = output.getvalue()
        self.store.models = []
        request = {"hass_user": SimpleNamespace(is_admin=True)}
        with patch.object(self.api, "read_upload", AsyncMock(return_value=payload)):
            response = await self.api.ModelUploadView(self.hass).post(request)
        self.assertEqual(response.status, 201)
        result = json.loads(response.body)
        self.assertEqual(result["roomCount"], 2)
        self.assertEqual(result["viewId"], "h-house-test")
        self.assertEqual(len(self.store.models), 2)
        with patch.object(self.api, "read_upload", AsyncMock(return_value=payload)):
            duplicate = await self.api.ModelUploadView(self.hass).post(request)
        self.assertEqual(duplicate.status, 400)
        self.assertEqual(len(self.store.models), 2)
        class HouseRequest(dict):
            headers = {}
        house_request = HouseRequest(hass_user=SimpleNamespace(is_admin=True))
        view = self.api.HouseReplaceView(self.hass)
        before = (self.store.directory / "catalog.json").read_bytes()
        with patch.object(self.api, "read_upload", AsyncMock(return_value=payload)):
            preview = await view.post(house_request, "house-test")
            self.assertEqual(preview.status, 200)
            self.assertEqual(before, (self.store.directory / "catalog.json").read_bytes())
            invalid = await view.put(house_request, "house-test")
            self.assertEqual(invalid.status, 400)
            house_request.headers = {"X-Rooms-Revision": json.loads(preview.body)["revision"]}
            replaced = await view.put(house_request, "house-test")
            self.assertEqual(replaced.status, 200)
            denied = HouseRequest(hass_user=SimpleNamespace(is_admin=False))
            with self.assertRaises(self.api.web.HTTPForbidden):
                await view.put(denied, "house-test")
        summary = await self.runtime.request("house_summary", {"house": "house-test"}, "user")
        await self.runtime.request("delete_house", {"house": "house-test", "revision": summary["revision"]}, "user")
        self.assertEqual(self.store.models, [])


    async def test_house_and_floor_views_keep_mapped_device_controls(self):
        from homeassistant.helpers import floor_registry
        await floor_registry.async_load(self.hass)
        floors = floor_registry.async_get(self.hass)
        first = floors.async_create("1st floor", level=1)
        second = floors.async_create("2nd floor", level=2)
        model = self.store.models[0]
        model.update(title="Kitchen", folder="a"*32, importedAt="2026-11-07")
        model["controls"][0].update(label="Ceiling", type="light", position=[0,2,0], nodeIds=[])
        model["housePlacement"] = {"schemaVersion":1,"houseId":"native-house","houseName":"Native house","roomId":"kitchen","transform":[1,0,0,0,0,1,0,0,0,0,1,0,10,0,4,1],"floors":[{"id":"first","name":"1st floor","minY":0,"maxY":2.8},{"id":"second","name":"2nd floor","minY":2.8,"maxY":6}],"floorIds":["first","second"]}
        model["appearance"]=[{"id":"entrance-upper-wall","label":"Show wall above entrance","visible":True}]
        await self.runtime.request("room",{"model":"kitchen","appearance":[{**model["appearance"][0],"visible":False}]},"test-user")
        appearance_catalog=await self.runtime.request("models",{},"test-user")
        for composed in appearance_catalog:
            if composed.get("houseView"):
                self.assertFalse(composed["members"][0]["appearance"][0]["visible"])
        self.assertEqual(self.store.models[0]["bindings"],{"ceiling":"light.kitchen"})
        with self.assertRaises(ValueError):
            await self.runtime.request("room",{"model":"kitchen","appearance":[{"id":"door","label":"Door","visible":False}]},"test-user")
        listed = await self.runtime.request("floors",{},"test-user")
        self.assertEqual({f["floor_id"] for f in listed},{first.floor_id,second.floor_id})
        links={"first":first.floor_id,"second":second.floor_id}
        await self.runtime.request("room",{"model":"kitchen","floorLinks":links,"haFloorIds":[first.floor_id,second.floor_id]},"test-user")
        self.assertEqual(self.store.models[0]["housePlacement"]["floors"][0]["haFloorId"],first.floor_id)
        floors.async_update(first.floor_id,name="Lower level")
        renamed = await self.runtime.request("models",{},"test-user")
        self.assertTrue(any(m.get("houseFloor",{}).get("name")=="Lower level" for m in renamed if m.get("houseFloor")))
        with self.assertRaises(ValueError):
            await self.runtime.request("room",{"model":"kitchen","floorLinks":{"first":"missing"},"haFloorIds":["missing"]},"test-user")
        choices = await self.runtime.request("models",{},"test-user")
        for index, scope in enumerate([m for m in choices if m.get("houseView")]):
            component={"schemaVersion":1,"id":f"house-scope-{index}","title":scope["title"],"height":500,"layers":[{"model":scope["id"],"view":"front","heading":0,"tilt":28,"zoom":1}]}
            saved=await self.runtime.request("save_component",{**component,"markers":{"ceiling":{"size":44}}},"test-user")
            self.assertEqual(saved["layers"][0]["model"],scope["id"])
            self.assertEqual(saved["markers"]["ceiling"]["size"],44)
        calls=[]
        async def handle(call):
            calls.append(call)
        self.hass.services.async_register("light","turn_on",handle)
        self.hass.states.async_set("light.kitchen","off",{"supported_color_modes":["onoff"]})
        catalog=await self.runtime.request("models",{},"test-user")
        for view in [m for m in catalog if m.get("houseView") and m["controls"]]:
            self.assertEqual(view["bindings"][view["controls"][0]["id"]],"light.kitchen")
            await self.runtime.request("command",{"model":view["id"],"controlId":view["controls"][0]["id"],"action":"on"},"test-user")
            self.assertEqual(calls[-1].data["entity_id"],"light.kitchen")
            self.assertEqual(calls[-1].context.user_id,"test-user")
            with self.assertRaises(ValueError):
                await self.runtime.request("command",{"model":view["id"],"controlId":"not-in-this-space","action":"on"},"test-user")
        self.assertEqual(len(calls),len([m for m in catalog if m.get("houseView") and m["controls"]]))
        calls.clear()
        await self.runtime.request("command",{"model":"kitchen","controlId":"ceiling","action":"on"},"test-user")
        self.assertEqual(len(calls),1)
        self.assertEqual(calls[0].data["entity_id"],"light.kitchen")
        self.assertEqual(calls[0].context.user_id,"test-user")
        await self.runtime.request("room",{"model":"kitchen","floorIds":["second"]},"test-user")
        self.assertEqual(self.store.models[0]["housePlacement"]["floorIds"],["second"])

    async def test_shared_thumbnails_are_optional_in_dashboard_metadata(self):
        import base64
        thumbnail = "data:image/jpeg;base64," + base64.b64encode(bytes.fromhex("ffd8ffc0000b080190028001011100ffd9")).decode()
        view = {"schemaVersion": 1, "id": "preview-check", "title": "Preview", "height": 500,
                "thumbnail": thumbnail,
                "layers": [{"model": "kitchen", "view": "front", "heading": 0, "tilt": 28, "zoom": 1}]}
        await self.runtime.request("save_component", view, "test-user")
        lightweight = await self.runtime.request("components", {}, "test-user")
        self.assertNotIn("thumbnail", lightweight[0])
        full = await self.runtime.request("components", {"include_thumbnails": True}, "test-user")
        self.assertEqual(full[0]["thumbnail"], thumbnail)
        import json
        stored = json.loads((Path(self.temp.name) / "catalog.json").read_text())
        self.assertEqual(stored["components"][0]["thumbnail"], thumbnail)

    async def test_marker_settings_persist_through_native_saved_view_api(self):
        markers = {"ceiling": {"visible": True, "show_label": False, "size": 44,
                               "placement": "room", "offset": [0.5, 0.25, -1]}}
        view = {"schemaVersion": 1, "id": "marker-check", "title": "Markers", "height": 500,
                "markers": markers, "layers": [{"model": "kitchen", "view": "front", "heading": 0, "tilt": 28, "zoom": 1}]}
        await self.runtime.request("save_component", view, "test-user")
        restored = await self.runtime.request("components", {}, "test-user")
        self.assertEqual(restored[0]["markers"], markers)
        self.assertEqual(json.loads((self.store.directory / "catalog.json").read_text())["components"][0]["markers"], markers)
        with self.assertRaises(ValueError):
            await self.runtime.request("save_component", {**view, "markers": {"ceiling": {"offset": [0, True, 0]}}}, "test-user")
        self.assertEqual(self.store.components[0]["markers"], markers)

    async def test_saved_view_changes_notify_linked_cards_after_persistence(self):
        from homeassistant.core import callback
        updates = []
        @callback
        def changed(event):
            updates.append([c["title"] for c in self.store.components])
        self.hass.bus.async_listen("three_d_rooms_updated", changed)
        view = {"schemaVersion": 1, "id": "linked-check", "title": "First", "height": 500,
                "layers": [{"model": "kitchen", "view": "front", "heading": 0, "tilt": 28, "zoom": 1}]}
        await self.runtime.request("save_component", view, "test-user")
        await self.hass.async_block_till_done()
        await self.runtime.request("save_component", {**view, "title": "Changed"}, "test-user")
        await self.hass.async_block_till_done()
        with self.assertRaises(ValueError):
            await self.runtime.request("save_component", {**view, "height": 0}, "test-user")
        await self.hass.async_block_till_done()
        await self.runtime.request("delete_component", {"id": view["id"]}, "test-user")
        await self.hass.async_block_till_done()
        self.assertEqual(updates, [["First"], ["Changed"], []])

    async def test_daylight_settings_and_sun_state_are_native_and_persistent(self):
        self.store.models[0]["daylight"] = {"mode": "night", "entity": "sun.sun", "windows": [
            {"id": "window", "nodeId": "glass", "position": [0, 2, 1], "inward": [0, 0, -1], "width": 1, "height": 1}
        ]}
        self.hass.states.async_set("sun.sun", "above_horizon", {"elevation": 22})
        result = await self.runtime.request("daylight", {"model": "kitchen", "mode": "auto", "entity": "sun.sun"}, "test-user")
        self.assertEqual(result["daylight"]["mode"], "auto")
        self.assertTrue(any(e["entity_id"] == "sun.sun" for e in self.runtime.status()["entities"]))
        with self.assertRaises(ValueError):
            await self.runtime.request("daylight", {"model": "kitchen", "mode": "auto", "entity": "sun.missing"}, "test-user")
        self.assertEqual(self.store.find("kitchen")["daylight"]["mode"], "auto")

    async def test_desk_number_services_limits_units_and_reported_state(self):
        calls = []
        async def handle(call):
            calls.append(call)
            self.hass.states.async_set(call.data["entity_id"], str(call.data["value"]), attrs)
        attrs = {"min": 73, "max": 130, "step": .1, "unit_of_measurement": "cm"}
        control = {"id": "desk-height", "type": "number", "min": 73, "max": 130, "step": .1, "unit": "cm", "capabilities": ["set_value"]}
        self.store.models[0]["controls"].append(control)
        base = {"model": "kitchen", "controlId": "desk-height", "action": "set_value"}
        for domain in ("number", "input_number"):
            entity_id = f"{domain}.desk"
            self.hass.services.async_register(domain, "set_value", handle)
            self.hass.states.async_set(entity_id, "78.2", attrs)
            self.store.models[0]["bindings"]["desk-height"] = entity_id
            await self.runtime.request("command", {**base, "value": 130, "entityId": "number.injected"}, "test-user")
            self.assertEqual(calls[-1].data["entity_id"], entity_id)
            self.assertEqual(calls[-1].context.user_id, "test-user")
            self.assertEqual(self.hass.states.get(entity_id).state, "130")
            self.assertTrue(any(e["entity_id"] == entity_id for e in self.runtime.status()["entities"]))
            for value in (72, 131, True, "100", float("nan"), 100.05):
                with self.assertRaises(ValueError):
                    await self.runtime.request("command", {**base, "value": value}, "test-user")
            self.hass.states.async_set(entity_id, "unknown", attrs)
            with self.assertRaises(ValueError):
                await self.runtime.request("command", {**base, "value": 100}, "test-user")
            self.hass.states.async_set(entity_id, "100", {**attrs, "unit_of_measurement": "in"})
            with self.assertRaises(ValueError):
                await self.runtime.request("command", {**base, "value": 100}, "test-user")
        self.assertEqual(len(calls), 2)

    async def test_desk_presets_dispatch_only_mapped_actions_with_caller(self):
        calls = []
        async def handle(call):
            calls.append(call)
        for index, domain in enumerate(("button", "input_button", "script", "scene")):
            control_id = f"desk-preset-{index+1}"
            entity_id = f"{domain}.desk_preset"
            self.store.models[0]["controls"].append({"id": control_id, "type": "button", "capabilities": ["press"]})
            self.store.models[0]["bindings"][control_id] = entity_id
            self.hass.states.async_set(entity_id, "unknown")
            service = "press" if domain in ("button", "input_button") else "turn_on"
            self.hass.services.async_register(domain, service, handle)
            await self.runtime.request("command", {"model": "kitchen", "controlId": control_id, "action": "press", "entityId": "button.injected"}, "test-user")
            self.assertEqual(calls[-1].data["entity_id"], entity_id)
            self.assertEqual(calls[-1].service, service)
            self.assertEqual(calls[-1].context.user_id, "test-user")
            self.hass.states.async_set(entity_id, "unavailable")
            with self.assertRaises(ValueError):
                await self.runtime.request("command", {"model": "kitchen", "controlId": control_id, "action": "press"}, "test-user")
        self.assertEqual(len(calls), 4)

    async def test_cover_services_reported_height_and_capability_gating(self):
        calls = []
        async def handle(call):
            calls.append(call)
            if "position" in call.data:
                self.hass.states.async_set("cover.shade", "open", {"supported_features": 15, "current_position": call.data["position"]})
        for service in ("open_cover", "close_cover", "set_cover_position", "stop_cover"):
            self.hass.services.async_register("cover", service, handle)
        self.store.models[0]["controls"].append({"id": "shade", "type": "cover", "capabilities": ["open_close", "position", "stop"]})
        self.store.models[0]["bindings"]["shade"] = "cover.shade"
        self.hass.states.async_set("cover.shade", "closed", {"supported_features": 15, "current_position": 0})
        base = {"model": "kitchen", "controlId": "shade"}
        for action in ("open", "position", "stop", "close"):
            await self.runtime.request("command", {**base, "action": action, "position": 43, "entityId": "cover.injected"}, "test-user")
        self.assertEqual([c.service for c in calls], ["open_cover", "set_cover_position", "stop_cover", "close_cover"])
        self.assertTrue(all(c.data["entity_id"] == "cover.shade" and c.context.user_id == "test-user" for c in calls))
        self.assertEqual(next(e for e in self.runtime.status()["entities"] if e["entity_id"] == "cover.shade")["attributes"]["current_position"], 43)
        for value in (-1, 101, 50.5, True, "50"):
            with self.assertRaises(ValueError):
                await self.runtime.request("command", {**base, "action": "position", "position": value}, "test-user")
        self.hass.states.async_set("cover.shade", "open", {"supported_features": 3})
        with self.assertRaises(ValueError):
            await self.runtime.request("command", {**base, "action": "position", "position": 50}, "test-user")
        self.hass.states.async_set("cover.shade", "unavailable", {"supported_features": 15})
        with self.assertRaises(ValueError):
            await self.runtime.request("command", {**base, "action": "open"}, "test-user")
        self.assertEqual(len(calls), 4)

    async def test_lock_dispatches_only_explicit_mapped_actions(self):
        calls = []
        async def handle(call):
            calls.append(call)
        for service in ("lock", "unlock", "open"):
            self.hass.services.async_register("lock", service, handle)
        self.store.models[0]["controls"].append({"id": "front-lock", "type": "lock", "capabilities": ["lock_unlock"]})
        self.store.models[0]["bindings"]["front-lock"] = "lock.front_door"
        self.hass.states.async_set("lock.front_door", "unlocked", {})
        self.assertTrue(any(e["entity_id"] == "lock.front_door" for e in self.runtime.status()["entities"]))
        base = {"model": "kitchen", "controlId": "front-lock"}
        for action in ("lock", "unlock"):
            await self.runtime.request("command", {**base, "action": action, "entityId": "lock.injected"}, "test-user")
        self.assertEqual([c.service for c in calls], ["lock", "unlock"])
        self.assertTrue(all(c.data == {"entity_id": "lock.front_door"} and c.context.user_id == "test-user" for c in calls))
        for action in ("open", "toggle", "on", None):
            with self.assertRaises(ValueError):
                await self.runtime.request("command", {**base, "action": action}, "test-user")
        self.hass.states.async_set("lock.front_door", "locked", {"code_format": "^\\d{4}$"})
        with self.assertRaises(ValueError):
            await self.runtime.request("command", {**base, "action": "unlock"}, "test-user")
        for state in ("unavailable", "unknown"):
            self.hass.states.async_set("lock.front_door", state, {})
            with self.assertRaises(ValueError):
                await self.runtime.request("command", {**base, "action": "lock"}, "test-user")
        self.assertEqual(len(calls), 2)

    async def test_existing_area_assignment_and_area_rename(self):
        from homeassistant.helpers import area_registry
        await area_registry.async_load(self.hass)
        registry = area_registry.async_get(self.hass)
        area = registry.async_create("Kitchen")
        areas = await self.runtime.request("areas", {}, "test-user")
        self.assertTrue(any(a["area_id"] == area.id for a in areas))
        before = dict(self.store.models[0]["bindings"])
        result = await self.runtime.request("room", {"model": "kitchen", "title": "Kitchen room", "areaId": area.id}, "test-user")
        self.assertEqual(result["areaId"], area.id)
        self.assertEqual(self.store.models[0]["bindings"], before)
        registry.async_update(area.id, name="Renamed kitchen")
        renamed = await self.runtime.request("areas", {}, "test-user")
        self.assertTrue(any(a["area_id"] == area.id and a["name"] == "Renamed kitchen" for a in renamed))
        for invalid in ("missing_area", 42, True, None):
            with self.assertRaises(ValueError):
                await self.runtime.request("room", {"model": "kitchen", "areaId": invalid}, "test-user")
        result = await self.runtime.request("room", {"model": "kitchen", "areaId": ""}, "test-user")
        self.assertEqual(result["areaId"], "")

    async def test_standalone_page_serves_only_a_validated_view_id(self):
        from aiohttp import web
        standalone = importlib.import_module("custom_components.three_d_rooms.standalone")
        view = standalone.StandalonePageView(self.hass)
        self.assertFalse(view.requires_auth)
        self.hass.data["three_d_rooms"]["assets_version"] = "1.2.3.456"
        response = await view.get(SimpleNamespace(), "my-house_1")
        self.assertEqual(response.content_type, "text/html")
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.assertIn('data-view="my-house_1"', response.text)
        self.assertIn("three-d-rooms-standalone.js?v=1.2.3.456", response.text)
        for bad in ['x"><script>', "../x", "A", "", "a" * 81]:
            with self.assertRaises(web.HTTPNotFound):
                await view.get(SimpleNamespace(), bad)
        del self.hass.data["three_d_rooms"]["assets_version"]
        with self.assertRaises(web.HTTPServiceUnavailable):
            await view.get(SimpleNamespace(), "my-house_1")

    async def test_signed_in_users_read_and_use_cards_but_only_admins_edit(self):
        from aiohttp import web
        from homeassistant.exceptions import Unauthorized

        allowed = {"light.kitchen", "button.desk_preset"}
        user = SimpleNamespace(
            id="family",
            is_admin=False,
            permissions=SimpleNamespace(check_entity=lambda entity, _policy: entity in allowed),
        )
        admin = SimpleNamespace(id="admin", is_admin=True)

        # HTTP: room models for every signed-in user; uploads/exports for admins.
        with self.assertRaises(web.HTTPForbidden):
            self.api.runtime_for({"hass_user": None}, self.hass, admin=False)
        self.assertIs(self.api.runtime_for({"hass_user": user}, self.hass, admin=False), self.runtime)
        with self.assertRaises(web.HTTPForbidden):
            self.api.runtime_for({"hass_user": user}, self.hass)
        self.assertIs(self.api.runtime_for({"hass_user": admin}, self.hass), self.runtime)

        # Websocket: read operations work, every edit is refused.
        from unittest.mock import patch
        with patch("homeassistant.helpers.floor_registry.async_get", return_value=SimpleNamespace(async_list_floors=lambda: [])), \
                patch.object(self.store, "catalog", lambda _floors=None: [{"id": "kitchen"}]):
            self.assertEqual(await self.runtime.request("models", {}, user.id, user), [{"id": "kitchen"}])
        self.store.components = [{"id": "v", "thumbnail": "x", "thumbnailArt": "y"}]
        listed = await self.runtime.request(
            "components", {"include_thumbnails": True, "include_art": True}, user.id, user
        )
        self.assertNotIn("thumbnail", listed[0])
        self.assertNotIn("thumbnailArt", listed[0])
        for operation, data in [
            ("bindings", {"model": "kitchen", "controlId": "ceiling", "entityId": ""}),
            ("delete", {"model": "kitchen"}),
            ("save_component", {}),
            ("delete_component", {"id": "v"}),
            ("device-visibility", {"model": "kitchen", "controlId": "ceiling", "hidden": True}),
            ("room", {"model": "kitchen", "title": "Hacked"}),
            ("light-groups", {"model": "kitchen", "groups": []}),
            ("optimization", {"model": "kitchen"}),
            ("status", {}),
            ("house_summary", {"house": "h"}),
        ]:
            with self.assertRaises(Unauthorized, msg=operation):
                await self.runtime.request(operation, data, user.id, user)
        self.assertEqual(self.store.find("kitchen")["bindings"], {"ceiling": "light.kitchen"})

        # Day/night switch: the mode only, never the sun entity.
        self.store.models[0]["daylight"] = {"mode": "night", "entity": "sun.sun", "windows": [
            {"id": "window", "nodeId": "glass", "position": [0, 2, 1], "inward": [0, 0, -1], "width": 1, "height": 1}
        ]}
        self.hass.states.async_set("sun.sun", "above_horizon", {"elevation": 22})
        result = await self.runtime.request("daylight", {"model": "kitchen", "mode": "day", "entity": "sun.sun"}, user.id, user)
        self.assertEqual(result["daylight"]["mode"], "day")
        self.hass.states.async_set("sun.other", "above_horizon", {"elevation": 5})
        with self.assertRaises(Unauthorized):
            await self.runtime.request("daylight", {"model": "kitchen", "mode": "auto", "entity": "sun.other"}, user.id, user)
        self.assertEqual(self.store.find("kitchen")["daylight"]["entity"], "sun.sun")

        # Presets follow Home Assistant's entity permissions for the user.
        calls = []
        async def handle(call):
            calls.append(call)
        self.hass.services.async_register("button", "press", handle)
        for control_id, entity_id in (("preset-ok", "button.desk_preset"), ("preset-no", "button.garage")):
            self.store.models[0]["controls"].append({"id": control_id, "type": "button", "capabilities": ["press"]})
            self.store.models[0]["bindings"][control_id] = entity_id
            self.hass.states.async_set(entity_id, "unknown")
        await self.runtime.request("command", {"model": "kitchen", "controlId": "preset-ok", "action": "press"}, user.id, user)
        self.assertEqual(calls[-1].context.user_id, "family")
        with self.assertRaises(Unauthorized):
            await self.runtime.request("command", {"model": "kitchen", "controlId": "preset-no", "action": "press"}, user.id, user)
        self.assertEqual(len(calls), 1)

        # The websocket handler turns refusals into an "unauthorized" error.
        sent = []
        connection = SimpleNamespace(
            user=user,
            send_error=lambda *args: sent.append(("error", *args)),
            send_result=lambda *args: sent.append(("result", *args)),
        )
        handler = getattr(self.api.websocket_request, "__wrapped__", self.api.websocket_request)
        await handler(self.hass, connection, {"id": 7, "operation": "delete", "data": {"model": "kitchen"}})
        self.assertEqual(sent[-1][:3], ("error", 7, "unauthorized"))

    async def test_light_group_uses_one_entity_and_one_service_call(self):
        from copy import deepcopy
        controls = [{"id": "left", "label":"Left", "type":"light", "position":[0,2,0], "capabilities":["on_off","brightness"]}, {"id":"right","label":"Right","type":"light","position":[2,2,0],"capabilities":["on_off","brightness"]}]
        self.store.models[0]["controls"] = controls
        self.store.models[0]["bindings"] = {"left":"light.original"}
        self.hass.states.async_set("light.dining", "off", {"supported_color_modes":["brightness"]})
        calls = []
        async def handle(call): calls.append(call)
        self.hass.services.async_register("light", "turn_on", handle)
        groups = [{"id":"dining","label":"Dining lights","controls":["left","right"],"entityId":"light.dining"}]
        await self.runtime.request("light-groups", {"model":"kitchen","groups":groups}, "test-user")
        await self.runtime.request("command", {"model":"kitchen","controlId":"left","action":"on","brightness":128,"entityId":"light.injected"}, "test-user")
        self.assertEqual(len(calls),1)
        self.assertEqual(calls[0].data["entity_id"],"light.dining")
        self.assertEqual(calls[0].context.user_id,"test-user")
        before = deepcopy(self.store.models)
        with self.assertRaises(ValueError):
            await self.runtime.request("light-groups", {"model":"kitchen","groups":[{**groups[0],"entityId":"light.missing"}]}, "test-user")
        self.assertEqual(self.store.models,before)
        await self.runtime.request("light-groups", {"model":"kitchen","groups":[]}, "test-user")
        self.assertEqual(self.store.models[0]["bindings"],{"left":"light.original"})

    async def test_only_mapped_services_run_with_caller_context(self):
        calls = []

        async def handle(call):
            calls.append(call)

        self.hass.services.async_register("light", "turn_on", handle)
        self.hass.states.async_set(
            "light.kitchen",
            "off",
            {
                "supported_color_modes": ["rgb", "color_temp"],
                "min_color_temp_kelvin": 2200,
                "max_color_temp_kelvin": 6000,
            },
        )
        await self.runtime.request(
            "command",
            {
                "model": "kitchen",
                "controlId": "ceiling",
                "action": "on",
                "rgb_color": [255, 80, 10],
                "entityId": "light.injected",
            },
            "test-user",
        )
        self.assertEqual(calls[0].data["entity_id"], "light.kitchen")
        self.assertEqual(calls[0].context.user_id, "test-user")
        with self.assertRaises(ValueError):
            await self.runtime.request(
                "command",
                {"model": "kitchen", "controlId": "unknown", "action": "on"},
                "test-user",
            )
        self.assertEqual(len(calls), 1)
        with self.assertRaises(ValueError):
            await self.runtime.request(
                "bindings",
                {"model": "kitchen", "controlId": "ceiling", "entityId": "lock.front"},
                "test-user",
            )

    async def test_light_capabilities_bounds_and_switch_restrictions(self):
        from homeassistant.core import State

        control = {"capabilities": ["on_off", "brightness"]}
        entity = State(
            "light.kitchen",
            "on",
            {
                "supported_color_modes": ["rgb", "color_temp"],
                "min_color_temp_kelvin": 2200,
                "max_color_temp_kelvin": 6000,
                "supported_features": 36,
                "effect_list": ["rainbow"],
            },
        )
        for settings in (
            {"brightness": 0},
            {"rgb_color": [256, 0, 0]},
            {"rgb_color": [255, 0, 0], "color_temp_kelvin": 3000},
            {"color_temp_kelvin": 100},
            {"transition": 61},
            {"effect": "invalid"},
        ):
            with self.subTest(settings=settings), self.assertRaises(ValueError):
                self.api.light_command({"action": "on", **settings}, control, entity)
        result = self.api.light_command(
            {
                "action": "on",
                "brightness": 100,
                "color_temp_kelvin": 3000,
                "effect": "rainbow",
                "transition": 1,
            },
            control,
            entity,
        )
        self.assertEqual(result["color_temp_kelvin"], 3000)
        with self.assertRaises(ValueError):
            self.api.light_command(
                {"action": "on", "brightness": 100},
                control,
                State("switch.ceiling", "on"),
            )
