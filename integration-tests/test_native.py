"""Native API permission, mapping and service validation against Home Assistant.

Run inside the official HA container with this repo mounted at /repo:
python -m unittest discover -s /repo/integration-tests -p test_native.py -v
"""

import importlib
import sys
import tempfile
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

    async def test_native_view_and_websocket_deny_non_admin(self):
        from aiohttp import web
        from homeassistant.exceptions import Unauthorized

        with self.assertRaises(web.HTTPForbidden):
            self.api.runtime_for(
                {"hass_user": SimpleNamespace(is_admin=False)}, self.hass
            )
        with self.assertRaises(Unauthorized):
            self.api.websocket_request(
                self.hass,
                SimpleNamespace(user=SimpleNamespace(is_admin=False)),
                {"id": 1, "type": "three_d_rooms/request", "operation": "models"},
            )
        self.assertIs(
            self.api.runtime_for(
                {"hass_user": SimpleNamespace(is_admin=True)}, self.hass
            ),
            self.runtime,
        )

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
