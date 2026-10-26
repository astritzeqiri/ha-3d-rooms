"""Number manifests, scene motion and persistent compatible mappings."""
from copy import deepcopy
import tempfile
import unittest
from pathlib import Path
from test_models import models, package

class NumberTests(unittest.TestCase):
    def test_height_package_motion_and_mapping_round_trip(self):
        control = {"id": "desk-height", "label": "Desk height", "type": "number", "position": [0, .782, 0], "nodeIds": ["desk-height"], "min": 73, "max": 130, "step": .1, "unit": "cm", "defaultValue": 100, "capabilities": ["set_value"]}
        doc = {"asset": {"version": "2.0"}, "nodes": [{"extras": {"controlId": "desk-height", "numberMotion": {"min": 73, "max": 130, "restValue": 78.2, "metersPerUnit": .01, "defaultValue": 100}}, "children": [1]}, {"extras": {"numberMotionPart": {"baseY": 0, "factor": 1}}}]}
        with tempfile.TemporaryDirectory() as directory:
            manifest, _ = models.extract_package(package(manifest_change={"controls": [control]}, document=doc), Path(directory))
            self.assertEqual(models.validate_bindings({"desk-height": "number.desk"}, manifest), {"desk-height": "number.desk"})
            models.validate_bindings({"desk-height": "input_number.desk"}, manifest)
            for entity in ("light.desk", "cover.desk", "switch.desk"):
                with self.assertRaises(ValueError):
                    models.validate_bindings({"desk-height": entity}, manifest)
            for key, value in (("step", 0), ("max", 70), ("defaultValue", 150), ("unit", "in")):
                bad = {**manifest, "controls": [{**control, key: value}]}
                with self.assertRaises(ValueError):
                    models.validate_manifest(bad)
            for mutate in (lambda d: d["nodes"][0]["extras"].pop("numberMotion"), lambda d: d["nodes"][0]["extras"]["numberMotion"].update(defaultValue=73), lambda d: d["nodes"][1]["extras"]["numberMotionPart"].update(factor=float("nan")), lambda d: d["nodes"][0].update(children=[])):
                bad = deepcopy(doc); mutate(bad)
                with self.assertRaises(ValueError):
                    models.extract_package(package(manifest_change={"controls": [control]}, document=bad), Path(directory))

    def test_adjustable_desk_names_persist_and_survive_model_replacement(self):
        height = {"id":"height", "type":"number", "label":"Height", "position":[0,0,0], "nodeIds":["height"], "min":73, "max":130, "step":.1, "unit":"cm", "defaultValue":78.2, "capabilities":["set_value"]}
        motion = {"id":"motion", "type":"cover", "motion":"none", "label":"Motion", "position":[0,0,0], "nodeIds":[], "capabilities":["open_close","stop"]}
        macros = [{"id":f"macro-{i}", "type":"button", "label":f"Macro {i}", "position":[0,0,0], "capabilities":["press"]} for i in range(1,5)]
        desk = {"id":"desk", "type":"adjustable_desk", "label":"Desk", "height":"height", "motion":"motion", "macros":[c["id"] for c in macros]}
        doc = {"asset":{"version":"2.0"}, "nodes":[{"extras":{"controlId":"height", "numberMotion":{"min":73,"max":130,"restValue":78.2,"defaultValue":78.2,"metersPerUnit":.01}},"children":[1]}, {"extras":{"numberMotionPart":{"baseY":0,"factor":1}}}]}
        data=package(manifest_change={"controls":[height,motion,*macros],"devices":[desk]},document=doc)
        with tempfile.TemporaryDirectory() as directory:
            store=models.ModelStore(directory).open();store.install(data)
            self.assertNotIn("deviceSettings",store.find("kitchen"))
            store.set_device_settings("kitchen","desk",{"macro-1":"My position","macro-3":""})
            store=models.ModelStore(directory).open()
            self.assertEqual(store.find("kitchen")["deviceSettings"]["desk"]["macroNames"]["macro-1"],"My position")
            store.replace("kitchen",data)
            self.assertEqual(store.find("kitchen")["deviceSettings"]["desk"]["macroNames"]["macro-1"],"My position")
            with self.assertRaises(ValueError):store.set_device_settings("kitchen","desk",{"height":"Wrong"})
