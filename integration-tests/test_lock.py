"""Door locks map only to lock entities and may carry a thumb-turn part."""
import json
import unittest
import zipfile
from io import BytesIO

from test_models import models, package

LOCK = {"id": "front-lock", "label": "Front door lock", "type": "lock", "position": [0, 1, 0],
        "capabilities": ["lock_unlock"], "nodeIds": ["lock-node"]}


def manifest():
    with zipfile.ZipFile(BytesIO(package())) as archive:
        return json.loads(archive.read("manifest.json"))


def nodes(turn=None):
    extras = {"controlId": "lock-node"}
    child = {"extras": {"lockTurn": turn}} if turn is not None else {}
    return {"asset": {"version": "2.0"}, "nodes": [
        {"extras": {"controlId": "fixture"}}, {"extras": extras, "children": [2]}, child]}


class LockTests(unittest.TestCase):
    def test_manifest_capabilities_and_bindings(self):
        m = manifest()
        m["controls"] = m["controls"] + [LOCK]
        self.assertEqual(models.validate_manifest(m)["controls"][1]["type"], "lock")
        self.assertTrue(models.compatible_entity(LOCK, "lock.front_door"))
        for entity in ("light.front", "switch.front", "cover.front", "binary_sensor.front", "button.front"):
            self.assertFalse(models.compatible_entity(LOCK, entity))
        for caps in ([], ["on_off"], ["lock_unlock", "open"], ["more_info"]):
            with self.assertRaises(ValueError):
                models.validate_manifest({**m, "controls": [{**LOCK, "capabilities": caps}]})

    def test_glb_requires_unique_root_and_valid_turn(self):
        m = manifest()
        m["controls"] = m["controls"] + [LOCK]
        models.validate_glb(self.glb(nodes({"axis": [0, 0, 1], "lockedAngle": 1.5708})), m)
        models.validate_glb(self.glb(nodes()), m)
        for turn in ({"axis": [0, 0, 2], "lockedAngle": 1}, {"axis": [0, 0, 1], "lockedAngle": 0},
                     {"axis": [0, 1], "lockedAngle": 1}, {"axis": [0, 0, 1], "lockedAngle": 4}, "turn"):
            with self.assertRaises(ValueError):
                models.validate_glb(self.glb(nodes(turn)), m)
        duplicate = nodes()
        duplicate["nodes"].append({"extras": {"controlId": "lock-node"}})
        with self.assertRaises(ValueError):
            models.validate_glb(self.glb(duplicate), m)

    @staticmethod
    def glb(document):
        with zipfile.ZipFile(BytesIO(package(manifest_change={"controls": []}, document=document))) as archive:
            return archive.read("scene.glb")


if __name__ == "__main__":
    unittest.main()
