"""Room-level icons: a device's default icon position and icon, shared by every view."""
import tempfile
import unittest
from test_models import models, package

CONTROLS = [
    {"id": "lamp", "label": "Lamp", "type": "light", "position": [1, 2, 0], "nodeIds": ["lamp"], "capabilities": ["on_off"]},
    {"id": "spot", "label": "Spot", "type": "light", "position": [3, 2, 0], "markerPosition": [3, 1.5, 0], "nodeIds": ["spot"], "capabilities": ["on_off"]},
]


def fixture(controls=CONTROLS):
    return package(manifest_change={"controls": controls},
                   document={"asset": {"version": "2.0"}, "nodes": [{"extras": {"controlId": c["nodeIds"][0]}} for c in controls]})


class MarkerDefaultTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.store = models.ModelStore(self.temp.name).open(); self.store.install(fixture())

    def shown(self, control_id):
        room = next(m for m in self.store.catalog() if m["id"] == "kitchen")
        return next(c for c in room["controls"] if c["id"] == control_id)

    def test_position_and_icon_are_served_and_reset_separately(self):
        result = self.store.set_device_marker("kitchen", "spot", {"position": [3.2, 1, 0.5], "icon": "mdi:lamp"})
        self.assertEqual(result["control"], {"markerPosition": [3.2, 1, 0.5], "markerAnchor": [3, 1.5, 0], "icon": "mdi:lamp"})
        spot = self.shown("spot")
        self.assertEqual((spot["markerPosition"], spot["markerAnchor"], spot["icon"]), ([3.2, 1, 0.5], [3, 1.5, 0], "mdi:lamp"))
        self.store.set_device_marker("kitchen", "spot", {"position": None})
        spot = self.shown("spot")
        self.assertEqual(spot["markerPosition"], [3, 1.5, 0]); self.assertNotIn("markerAnchor", spot); self.assertEqual(spot["icon"], "mdi:lamp")
        self.store.set_device_marker("kitchen", "spot", {"icon": None})
        self.assertNotIn("icon", self.shown("spot")); self.assertNotIn("markerDefaults", self.store.find("kitchen"))

    def test_a_control_without_its_own_anchor_uses_its_position(self):
        self.store.set_device_marker("kitchen", "lamp", {"position": [1, 2.5, 0]})
        self.assertEqual(self.shown("lamp")["markerAnchor"], [1, 2, 0])

    def test_invalid_values_and_unknown_devices_are_refused(self):
        for changes in ({}, {"size": 3}, {"position": [1, 2]}, {"position": [1, 2, 5000]}, {"icon": "lamp"}, {"icon": 4}):
            with self.assertRaises(ValueError):
                self.store.set_device_marker("kitchen", "lamp", changes)
        with self.assertRaises(ValueError):
            self.store.set_device_marker("kitchen", "nope", {"icon": "mdi:lamp"})
        self.assertNotIn("markerDefaults", self.store.find("kitchen"))

    def test_replacement_keeps_icons_for_devices_that_still_exist(self):
        self.store.set_device_marker("kitchen", "lamp", {"icon": "mdi:ceiling-light"})
        self.store.set_device_marker("kitchen", "spot", {"position": [3, 1, 0]})
        self.store.replace("kitchen", fixture([CONTROLS[0]]))
        self.assertEqual(self.store.find("kitchen")["markerDefaults"], {"lamp": {"icon": "mdi:ceiling-light"}})
        self.assertEqual(self.shown("lamp")["icon"], "mdi:ceiling-light")


if __name__ == "__main__":
    unittest.main()
