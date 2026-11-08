"""Shades and windows/doors (cover controls) group like lights: one cover entity, never mixed with lights."""
from copy import deepcopy
import tempfile
import unittest
from test_models import models, package

COVER = {"type": "cover", "capabilities": ["open_close", "position", "stop"], "defaultPosition": 0}
CONTROLS = [
    {"id": "shade-left", "label": "Shade left", "position": [0, 2, 0], "nodeIds": ["shade-left"], **COVER},
    {"id": "shade-right", "label": "Shade right", "position": [2, 2, 0], "nodeIds": ["shade-right"], **COVER},
    {"id": "window", "label": "Window", "position": [4, 1, 0], "nodeIds": ["window"], **COVER},
    {"id": "lamp", "label": "Lamp", "type": "light", "position": [4, 2, 0], "nodeIds": ["lamp"], "capabilities": ["on_off"]},
    {"id": "lamp-2", "label": "Lamp 2", "type": "light", "position": [5, 2, 0], "nodeIds": ["lamp-2"], "capabilities": ["on_off"]},
]
SHADES = {"id": "cg-shades", "label": "Dining shades", "controls": ["shade-left", "shade-right"], "entityId": "cover.dining_shades"}


def fixture():
    return package(manifest_change={"controls": CONTROLS}, document={"asset": {"version": "2.0"}, "nodes": [{"extras": {"controlId": c["nodeIds"][0]}} for c in CONTROLS]})


class CoverGroupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.store = models.ModelStore(self.temp.name).open(); self.store.install(fixture())
        self.store.bind("kitchen", "shade-left", "cover.left")

    def test_cover_group_binds_members_marks_one_primary_and_ungroups_cleanly(self):
        before = deepcopy(self.store.find("kitchen"))
        self.store.set_light_groups("kitchen", [SHADES])
        shown = self.store.catalog()[0]
        self.assertEqual(shown["bindings"]["shade-left"], "cover.dining_shades")
        self.assertEqual(shown["bindings"]["shade-right"], "cover.dining_shades")
        primary = [c for c in shown["controls"] if c.get("lightGroup") == "cg-shades"]
        self.assertEqual([c["lightGroupPrimary"] for c in primary], [True, False])
        self.assertEqual(primary[0]["label"], "Dining shades"); self.assertEqual(primary[0]["markerPosition"], [1, 2, 0])
        self.store.replace("kitchen", fixture()); self.assertEqual(self.store.find("kitchen")["lightGroups"], [SHADES])
        self.store.bind("kitchen", "shade-right", "cover.renamed")
        self.assertEqual(self.store.catalog()[0]["bindings"]["shade-left"], "cover.renamed")
        self.store.set_light_groups("kitchen", [])
        self.assertEqual(self.store.find("kitchen")["bindings"], before["bindings"])

    def test_mixed_kinds_and_wrong_domains_are_rejected_atomically(self):
        self.store.set_light_groups("kitchen", [SHADES]); before = deepcopy(self.store.models)
        bad = [
            [{**SHADES, "controls": ["shade-left", "lamp"]}],          # light + cover
            [{**SHADES, "entityId": "light.dining"}],                    # cover group, light entity
            [{**SHADES, "id": "lights", "controls": ["lamp", "lamp-2"], "entityId": "cover.x"}],  # light group, cover entity
            [SHADES, {**SHADES, "id": "two", "controls": ["shade-right", "window"]}],             # overlap
        ]
        for groups in bad:
            with self.subTest(groups=groups), self.assertRaises(ValueError):
                self.store.set_light_groups("kitchen", groups)
            self.assertEqual(self.store.models, before)
        # Lights and covers may still coexist as separate groups.
        self.store.set_light_groups("kitchen", [SHADES, {"id": "lights", "label": "Lamps", "controls": ["lamp", "lamp-2"], "entityId": "light.lamps"}])
        self.assertEqual(len(self.store.find("kitchen")["lightGroups"]), 2)


if __name__ == "__main__":
    unittest.main()
