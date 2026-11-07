"""Hinged cover metadata must survive import and reject ambiguous bindings."""
import copy
import json
import struct
import unittest
from test_models import models


class HingedDoorTests(unittest.TestCase):
    def test_import_and_invalid_hinges(self):
        control = {"id": "office-door", "type": "cover", "nodeIds": ["office-door"], "defaultPosition": 100}
        root = {"children": [1], "extras": {"controlId": "office-door", "hingedDoor": {
            "axis": "y", "closedAngle": 0, "openAngle": 1.5707963267948966, "defaultPosition": 100}}}

        def validate(nodes):
            data = json.dumps({"asset": {"version": "2.0"}, "nodes": nodes}).encode()
            data += b" " * (-len(data) % 4)
            glb = b"glTF" + struct.pack("<IIII", 2, 20 + len(data), len(data), 0x4E4F534A) + data
            models.validate_glb(glb, {"controls": [control]})

        validate([root, {"name": "leaf"}])
        for field, value in [("axis", "x"), ("openAngle", 0), ("openAngle", 9), ("closedAngle", "0"), ("defaultPosition", 0)]:
            bad = copy.deepcopy(root)
            bad["extras"]["hingedDoor"][field] = value
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                validate([bad, {"name": "leaf"}])
        with self.assertRaises(ValueError):
            validate([root, root])
