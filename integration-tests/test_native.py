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
