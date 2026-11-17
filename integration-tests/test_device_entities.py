"""Robot vacuums list extra entities; room settings survive a restart."""
import json
import tempfile
import unittest
import zipfile
from io import BytesIO

from test_models import models, package

VACUUM = {"id": "robot", "label": "Robot vacuum", "type": "vacuum", "position": [0, 0, 0],
          "capabilities": ["start"]}


def with_vacuum():
    with zipfile.ZipFile(BytesIO(package())) as archive:
        manifest = json.loads(archive.read("manifest.json"))
    return package(manifest_change={"controls": manifest["controls"] + [VACUUM]})


class DeviceEntitiesTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.store = models.ModelStore(self.dir.name).open()
        self.store.install(with_vacuum())
        self.model = self.store.models[0]["id"]

    def tearDown(self):
        self.dir.cleanup()

    def served(self, store=None):
        model = next(m for m in (store or self.store).catalog() if m["id"] == self.model)
        return {c["id"]: c for c in model["controls"]}

    def test_vacuum_lists_entities_in_order(self):
        result = self.store.set_device_entities(self.model, "robot", ["select.saros_10r_mop_mode", "sensor.saros_10r_battery"])
        self.assertEqual(result["entities"], ["select.saros_10r_mop_mode", "sensor.saros_10r_battery"])
        self.assertEqual(self.served()["robot"]["entities"], ["select.saros_10r_mop_mode", "sensor.saros_10r_battery"])
        self.store.set_device_entities(self.model, "robot", [])
        self.assertNotIn("entities", self.served()["robot"])
        self.assertNotIn("deviceEntities", self.store.models[0])

    def test_rejects_other_devices_bad_ids_duplicates_and_too_many(self):
        light = next(c["id"] for c in self.store.models[0]["controls"] if c["type"] == "light")
        for control, entities in ((light, ["sensor.a"]), ("robot", ["Sensor.A"]), ("robot", ["sensor.a", "sensor.a"]),
                                  ("robot", [f"sensor.s{i}" for i in range(49)]), ("robot", "sensor.a"), ("missing", ["sensor.a"])):
            with self.assertRaises(ValueError):
                self.store.set_device_entities(self.model, control, entities)

    def test_room_settings_survive_a_restart(self):
        self.store.set_device_entities(self.model, "robot", ["sensor.saros_10r_battery"])
        light = next(c["id"] for c in self.store.models[0]["controls"] if c["type"] == "light")
        self.store.set_device_marker(self.model, light, {"icon": "mdi:lamp"})
        self.store.update_room(self.model, {"groupIcons": True})
        reopened = models.ModelStore(self.dir.name).open()
        room = reopened.models[0]
        self.assertEqual(room["deviceEntities"], {"robot": ["sensor.saros_10r_battery"]})
        self.assertEqual(room["markerDefaults"][light], {"icon": "mdi:lamp"})
        self.assertIs(room["groupIcons"], True)
        self.assertEqual(self.served(reopened)["robot"]["entities"], ["sensor.saros_10r_battery"])

    def test_replacing_the_room_keeps_the_list(self):
        self.store.set_device_entities(self.model, "robot", ["sensor.saros_10r_battery"])
        self.store.replace(self.model, with_vacuum())
        self.assertEqual(self.served()["robot"]["entities"], ["sensor.saros_10r_battery"])
        self.store.replace(self.model, package())  # vacuum removed: list dropped
        self.assertNotIn("deviceEntities", self.store.models[0])

    def test_vacuum_map_is_one_image_entity_kept_on_restart_and_replace(self):
        self.assertEqual(self.store.set_device_map(self.model, "robot", "image.saros_10r_map_0"), {"map": "image.saros_10r_map_0"})
        self.assertEqual(self.served()["robot"]["map"], "image.saros_10r_map_0")
        for bad in ("sensor.saros_10r_map_0", "camera.map", ["image.a"], "Image.Map"):
            with self.assertRaises(ValueError):
                self.store.set_device_map(self.model, "robot", bad)
        light = next(c["id"] for c in self.store.models[0]["controls"] if c["type"] == "light")
        with self.assertRaises(ValueError):
            self.store.set_device_map(self.model, light, "image.saros_10r_map_0")
        reopened = models.ModelStore(self.dir.name).open()
        self.assertEqual(self.served(reopened)["robot"]["map"], "image.saros_10r_map_0")
        self.store.replace(self.model, with_vacuum())
        self.assertEqual(self.served()["robot"]["map"], "image.saros_10r_map_0")
        self.store.set_device_map(self.model, "robot", "")
        self.assertNotIn("map", self.served()["robot"])
        self.assertNotIn("deviceMaps", self.store.models[0])


if __name__ == "__main__":
    unittest.main()
