"""Persisted grouping must never overwrite original geometry or connections."""
from copy import deepcopy
import tempfile
import unittest
from unittest.mock import patch
from test_models import models, package
from rooms_test.light_groups import apply_light_groups

CONTROLS = [
    {"id": "left", "label": "Left", "type": "light", "position": [0, 2, 0], "nodeIds": ["left-node"], "capabilities": ["on_off", "brightness"]},
    {"id": "right", "label": "Right", "type": "light", "position": [2, 2, 0], "nodeIds": ["right-node"], "capabilities": ["on_off", "brightness"]},
    {"id": "other", "label": "Other", "type": "light", "position": [4, 2, 0], "nodeIds": ["other-node"], "capabilities": ["on_off"]},
]
GROUP = {"id": "dining", "label": "Dining lights", "controls": ["left", "right"], "entityId": "light.dining"}
def fixture(controls=None):
    controls = controls or CONTROLS
    return package(manifest_change={"controls": controls}, document={"asset": {"version": "2.0"}, "nodes": [{"extras": {"controlId": c["nodeIds"][0]}} for c in controls]})

class LightGroupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.store = models.ModelStore(self.temp.name).open(); self.store.install(fixture())
        self.store.bind("kitchen", "left", "light.left"); self.store.bind("kitchen", "right", "light.right")

    def test_hidden_group_members_stay_hidden_until_restored_in_source_room(self):
        self.store.set_light_groups("kitchen", [GROUP])
        self.store.set_device_visibility("kitchen", "right", True)
        self.assertTrue(all(c.get("hidden") for c in self.store.catalog()[0]["controls"][:2]))
        self.store.replace("kitchen", fixture())
        self.assertTrue(all(c.get("hidden") for c in self.store.catalog()[0]["controls"][:2]))
        self.store.set_light_groups("kitchen", [])
        self.assertTrue(all(c.get("hidden") for c in self.store.catalog()[0]["controls"][:2]))
        self.store.set_light_groups("kitchen", [GROUP])
        self.store.set_device_visibility("kitchen", "left", False)
        self.assertFalse(any(c.get("hidden") for c in self.store.catalog()[0]["controls"]))

    def test_group_roundtrip_export_replacement_and_ungroup_restore_originals(self):
        before = deepcopy(self.store.find("kitchen")); geometry = self.store.scene_bytes("kitchen")
        self.store.set_light_groups("kitchen", [GROUP])
        shown = self.store.catalog()[0]
        self.assertEqual(shown["bindings"]["left"], "light.dining"); self.assertEqual(shown["bindings"]["right"], "light.dining")
        self.assertEqual([c["position"] for c in shown["controls"]], [c["position"] for c in CONTROLS])
        self.assertEqual(shown["controls"][0]["markerPosition"], [1, 2, 0]); self.assertFalse(shown["controls"][1]["lightGroupPrimary"])
        reopened = models.ModelStore(self.temp.name).open(); self.assertEqual(reopened.find("kitchen")["lightGroups"], [GROUP])
        with tempfile.TemporaryDirectory() as target:
            exported = models.ModelStore(target).open(); exported.install(self.store.export("kitchen"))
            self.assertEqual(exported.catalog()[0]["bindings"]["left"], "light.dining")
        self.store.replace("kitchen", fixture()); self.assertEqual(self.store.find("kitchen")["lightGroups"], [GROUP])
        self.store.bind("kitchen", "left", "light.new_group"); self.assertEqual(self.store.catalog()[0]["bindings"]["right"], "light.new_group")
        self.store.set_light_groups("kitchen", [])
        self.assertEqual(self.store.find("kitchen")["bindings"], before["bindings"]); self.assertEqual(self.store.find("kitchen")["controls"], before["controls"])
        self.assertEqual(self.store.scene_bytes("kitchen"), geometry)

    def test_invalid_overlap_unknown_member_and_failed_write_are_atomic(self):
        self.store.set_light_groups("kitchen", [GROUP]); before = deepcopy(self.store.models)
        for groups in [[{**GROUP,"controls":["left"]}], [{**GROUP,"controls":["left","missing"]}], [GROUP,{**GROUP,"id":"two","controls":["right","other"]}], [{**GROUP,"entityId":"cover.invalid"}], [{**GROUP,"controls":["left","left"]}]]:
            with self.assertRaises(ValueError): self.store.set_light_groups("kitchen", groups)
            self.assertEqual(self.store.models, before)
        with patch.object(self.store, "save", side_effect=OSError("disk")):
            with self.assertRaises(OSError): self.store.set_light_groups("kitchen", [])
        self.assertEqual(self.store.models, before)

    def test_floor_without_original_primary_still_has_one_group_control(self):
        from rooms_test.house import house_models
        model = self.store.find("kitchen"); model["controls"][1]["position"][1] = 4
        model["housePlacement"] = {"schemaVersion":1,"houseId":"home","houseName":"Home","roomId":"kitchen","transform":[1,0,0,0,0,1,0,0,0,0,1,0,10,0,0,1],"floors":[{"id":"up","name":"Up","minY":3,"maxY":6}],"floorIds":["up"]}
        self.store.set_light_groups("kitchen", [GROUP])
        floor = next(m for m in self.store.catalog() if m.get("houseFloor"))
        self.assertEqual(len(floor["controls"]), 1); c = floor["controls"][0]
        self.assertTrue(c["lightGroupPrimary"]); self.assertEqual(c["markerPosition"], [12,4,0]); self.assertEqual(floor["bindings"][c["id"]], "light.dining")
        # The card's Lights panel lists house lights under their own room's name.
        self.assertEqual(c["roomTitle"], self.store.find("kitchen")["title"])
