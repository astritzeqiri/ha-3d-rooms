"""Sliding cover metadata must survive import and reject ambiguous or unsafe motion."""
import copy
import json
import struct
import unittest
from test_models import models


class SlidingDoorTests(unittest.TestCase):
    def test_import_and_invalid_slides(self):
        control = {"id": "living-sliding-door", "type": "cover", "nodeIds": ["living-sliding-door"], "defaultPosition": 100}
        root = {"children": [1], "extras": {"controlId": "living-sliding-door", "slidingDoor": {
            "axis": "x", "closedOffset": -0.3875, "openOffset": 0.45, "defaultPosition": 100}}}

        def validate(nodes):
            data = json.dumps({"asset": {"version": "2.0"}, "nodes": nodes}).encode()
            data += b" " * (-len(data) % 4)
            glb = b"glTF" + struct.pack("<IIII", 2, 20 + len(data), len(data), 0x4E4F534A) + data
            models.validate_glb(glb, {"controls": [control]})

        validate([root, {"name": "leaf"}])
        for field, value in [("axis", "y"), ("openOffset", -0.3875), ("openOffset", 9), ("closedOffset", "0"), ("defaultPosition", 0)]:
            bad = copy.deepcopy(root)
            bad["extras"]["slidingDoor"][field] = value
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                validate([bad, {"name": "leaf"}])
        with self.assertRaises(ValueError):
            validate([root, root])
        childless = copy.deepcopy(root)
        del childless["children"]
        with self.assertRaises(ValueError):
            validate([childless])
        both = copy.deepcopy(root)
        both["extras"]["hingedDoor"] = {"axis": "y", "closedAngle": 0, "openAngle": 1.0, "defaultPosition": 100}
        with self.assertRaises(ValueError):
            validate([both, {"name": "leaf"}])


if __name__ == "__main__":
    unittest.main()
