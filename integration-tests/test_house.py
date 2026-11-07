"""Independent room uploads, house assembly, floors and compatible replacement."""
from copy import deepcopy
from io import BytesIO
import json
import tempfile
import unittest
import zipfile
from test_models import models, package

T = [1,0,0,0,0,1,0,0,0,0,1,0,10,0,4,1]
FLOORS = [{"id":"first","name":"1st floor","minY":0,"maxY":2.8},{"id":"second","name":"2nd floor","minY":2.8,"maxY":6}]
def placement(room="hallway"):
    return {"schemaVersion":1,"houseId":"my-house","houseName":"My house","roomId":room,"transform":list(T),"floors":deepcopy(FLOORS),"floorIds":["first","second"]}

class HouseTests(unittest.TestCase):
    def test_architecture_visibility_persists_composes_and_survives_replacement(self):
        part={"id":"entrance-upper-wall","label":"Show wall above entrance","visible":True}
        doc={"asset":{"version":"2.0"},"nodes":[{"extras":{"controlId":"fixture"}},{"extras":{"appearanceId":part["id"]}}]}
        upload=package(manifest_change={"appearance":[part],"housePlacement":placement()},document=doc)
        with tempfile.TemporaryDirectory() as directory:
            store=models.ModelStore(directory).open()
            store.install(upload)
            store.bind("kitchen","ceiling","light.kitchen")
            before=deepcopy(store.find("kitchen"))
            hidden={**part,"visible":False}
            store.update_room("kitchen",{"appearance":[hidden]})
            for composed in store.catalog():
                if composed.get("houseView"):
                    self.assertEqual(composed["members"][0]["appearance"],[hidden])
            self.assertEqual(store.find("kitchen")["bindings"],before["bindings"])
            self.assertEqual(store.find("kitchen")["housePlacement"],before["housePlacement"])
            store=models.ModelStore(directory).open()
            store.replace("kitchen",upload)
            self.assertEqual(store.find("kitchen")["appearance"],[hidden])
            with zipfile.ZipFile(BytesIO(store.export("kitchen"))) as z:
                self.assertEqual(json.loads(z.read("manifest.json"))["appearance"],[hidden])
            with self.assertRaises(ValueError):store.update_room("kitchen",{"appearance":[{**hidden,"id":"other"}]})
            with self.assertRaises(ValueError):models.validate_manifest({**before,"appearance":[{**part,"visible":"false"}]})
            with self.assertRaises(ValueError):store.install(package(manifest_change={"appearance":[part]}))

    def test_legacy_room_rejects_floor_links_without_mutating_setup(self):
        with tempfile.TemporaryDirectory() as directory:
            store=models.ModelStore(directory).open()
            store.install(package())
            before=deepcopy(store.models)
            with self.assertRaisesRegex(ValueError,"house builder"):
                store.update_room("kitchen",{"floorLinks":{}})
            self.assertEqual(store.models,before)

    def test_independent_upload_restart_floor_assignments_and_export(self):
        with tempfile.TemporaryDirectory() as directory:
            store = models.ModelStore(directory).open()
            store.install(package(manifest_change={"housePlacement":placement()}))
            store.bind("kitchen","ceiling","light.kitchen")
            catalog = store.catalog()
            self.assertEqual(len(catalog),4)
            whole = next(m for m in catalog if m.get("houseView") and not m.get("houseFloor"))
            self.assertEqual(whole["controls"][0]["position"],[10,2,4])
            self.assertEqual(whole["bindings"][whole["controls"][0]["id"]],"light.kitchen")
            store.update_room("kitchen",{"floorIds":["second"]})
            self.assertEqual(len(store.catalog()),3)
            reopened = models.ModelStore(directory).open()
            self.assertEqual(reopened.find("kitchen")["housePlacement"]["floorIds"],["second"])
            with zipfile.ZipFile(BytesIO(reopened.export("kitchen"))) as z:
                self.assertEqual(json.loads(z.read("house-placement.json"))["floorIds"],["second"])
            store.replace("kitchen",package())
            self.assertEqual(store.find("kitchen")["housePlacement"]["transform"],T)
            self.assertEqual(store.find("kitchen")["bindings"]["ceiling"],"light.kitchen")
            for operation in (store.remove,store.export,store.scene_path):
                with self.assertRaises(ValueError):operation(whole["id"])
            self.assertEqual(len(store.models),1)

    def test_native_floor_links_rename_and_replacement_keep_membership(self):
        with tempfile.TemporaryDirectory() as directory:
            store=models.ModelStore(directory).open()
            store.install(package(manifest_change={"housePlacement":placement()}))
            store.update_room("kitchen",{"floorLinks":{"first":"downstairs","second":"upstairs"}})
            catalog=store.catalog({"downstairs":"Lower level","upstairs":"Upper level"})
            floors=[m["houseFloor"] for m in catalog if m.get("houseFloor")]
            self.assertEqual({f["name"] for f in floors},{"Lower level","Upper level"})
            self.assertEqual({f["haFloorId"] for f in floors},{"downstairs","upstairs"})
            store.replace("kitchen",package(manifest_change={"housePlacement":placement()}))
            restored=models.ModelStore(directory).open()
            self.assertEqual(restored.models[0]["housePlacement"]["floors"][0]["haFloorId"],"downstairs")
            with self.assertRaises(ValueError):
                restored.update_room("kitchen",{"floorLinks":{"first":"same","second":"same"}})
            self.assertEqual(restored.models[0]["housePlacement"]["floors"][0]["haFloorId"],"downstairs")

    def test_house_views_preserve_marker_edits_without_affecting_room_views(self):
        with tempfile.TemporaryDirectory() as directory:
            store=models.ModelStore(directory).open()
            store.install(package(manifest_change={"housePlacement":placement()}))
            whole=next(m for m in store.catalog() if m.get("houseView") and not m.get("houseFloor"))
            value={"schemaVersion":1,"id":"house-overview","title":"House","height":500,"markers":{"ceiling":{"size":44}},"layers":[{"model":whole["id"],"view":"front","heading":0,"tilt":28,"zoom":1}]}
            self.assertEqual(store.put_component(value)["markers"]["ceiling"]["size"],44)
            value["id"]="room-overview";value["layers"][0]["model"]="kitchen"
            self.assertEqual(store.put_component(value)["markers"]["ceiling"]["size"],44)

    def test_metadata_file_and_manifest_must_agree(self):
        p=placement()
        with tempfile.TemporaryDirectory() as directory:
            store=models.ModelStore(directory).open()
            store.install(package(extra={"house-placement.json":json.dumps(p)}))
            self.assertEqual(store.models[0]["housePlacement"],p)
            with self.assertRaises(ValueError):
                store.replace("kitchen",package(extra={"house-placement.json":json.dumps(placement("other"))},manifest_change={"housePlacement":p}))
            self.assertEqual(store.models[0]["housePlacement"],p)

    def test_malformed_placements_and_memberships_rejected(self):
        for mutate in (lambda p:p["transform"].__setitem__(0,2),lambda p:p["transform"].__setitem__(0,-1),lambda p:p["floorIds"].append("missing"),lambda p:p["floors"][0].update(maxY=0),lambda p:p["transform"].__setitem__(12,True)):
            p=placement();mutate(p)
            with self.assertRaises(ValueError):models.validate_manifest({**json.loads(zipfile.ZipFile(BytesIO(package())).read("manifest.json")),"housePlacement":p})
