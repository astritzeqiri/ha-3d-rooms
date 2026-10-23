"""Run with Python unittest; validation does not require Home Assistant."""

import importlib.util
from io import BytesIO
import json
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location(
    "rooms_models",
    Path(__file__).parents[1] / "custom_components/three_d_rooms/models.py",
)
models = importlib.util.module_from_spec(spec)
spec.loader.exec_module(models)


def package(extra=None, manifest_change=None, document=None, bindings=None):
    manifest = {
        "schemaVersion": 1,
        "id": "kitchen",
        "title": "Kitchen",
        "units": "meters",
        "up": "Y",
        "scene": "scene.glb",
        "controls": [
            {
                "id": "ceiling",
                "label": "Ceiling",
                "type": "light",
                "position": [0, 2, 0],
                "capabilities": ["on_off", "brightness"],
                "nodeIds": ["fixture"],
            }
        ],
    }
    manifest.update(manifest_change or {})
    doc = json.dumps(
        document
        or {
            "asset": {"version": "2.0"},
            "nodes": [{"extras": {"controlId": "fixture"}}],
        }
    ).encode()
    doc += b" " * (-len(doc) % 4)
    glb = struct.pack("<4sIIII", b"glTF", 2, len(doc) + 20, len(doc), 0x4E4F534A) + doc
    output = BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("manifest.json", json.dumps(manifest))
        archive.writestr("scene.glb", glb)
        if bindings is not None:
            archive.writestr("bindings.json", json.dumps(bindings))
        for name, value in (extra or {}).items():
            archive.writestr(name, value)
    return output.getvalue()


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = models.ModelStore(self.temp.name).open()

    def test_daylight_import_persistence_and_settings_validation(self):
        daylight = {"mode": "night", "entity": "sun.sun", "windows": [
            {"id": "window", "nodeId": "glass", "position": [0, 2, 1], "inward": [0, 0, -1], "width": 1, "height": 1}
        ]}
        document = {"asset": {"version": "2.0"}, "nodes": [{"extras": {"controlId": "fixture", "daylightWindowId": "glass"}}]}
        self.store.install(package(manifest_change={"daylight": daylight}, document=document))
        self.store.set_daylight("kitchen", {"mode": "auto", "entity": "sun.sun"})
        reopened = models.ModelStore(self.temp.name).open()
        self.assertEqual(reopened.find("kitchen")["daylight"]["mode"], "auto")
        self.assertEqual(reopened.find("kitchen")["daylight"]["windows"], daylight["windows"])
        for settings in ({"mode": "bad", "entity": "sun.sun"}, {"mode": "auto", "entity": "light.sun"}):
            with self.assertRaises(ValueError):
                reopened.set_daylight("kitchen", settings)
        with self.assertRaises(ValueError):
            models.validate_daylight({**daylight, "windows": [{**daylight["windows"][0], "coverId": "missing"}]}, [])
        with self.assertRaises(ValueError):
            self.store.install(package(manifest_change={"id": "broken", "daylight": daylight}))

    def test_cover_import_binding_export_roundtrip_and_domain_validation(self):
        control = {"id": "shade", "label": "Shade", "type": "cover", "position": [0, 2, 0],
                   "nodeIds": ["fixture"], "defaultPosition": 85, "capabilities": ["open_close", "position", "stop"]}
        manifest = {"controls": [control]}
        with tempfile.TemporaryDirectory() as directory:
            store = models.ModelStore(directory).open()
            store.install(package(manifest_change=manifest))
            store.bind("kitchen", "shade", "cover.demo")
            with self.assertRaises(ValueError):
                store.bind("kitchen", "shade", "light.demo")
            self.assertEqual(models.ModelStore(directory).open().find("kitchen")["bindings"], {"shade": "cover.demo"})
            with tempfile.TemporaryDirectory() as restored:
                migrated = models.ModelStore(restored).open()
                migrated.install(store.export("kitchen"))
                self.assertEqual(migrated.find("kitchen")["bindings"], {"shade": "cover.demo"})
        with self.assertRaises(ValueError):
            models.validate_bindings({"shade": "light.demo"}, manifest)
        with zipfile.ZipFile(BytesIO(package(manifest_change=manifest))) as archive:
            valid_manifest = json.loads(archive.read("manifest.json"))
        for bad in (True, -1, 101, "85"):
            with self.assertRaises(ValueError):
                models.validate_manifest({**valid_manifest, "controls": [{**control, "defaultPosition": bad}]})

    def test_room_area_identity_is_local_persistent_and_atomic(self):
        self.store.install(package(bindings={"ceiling": "light.kitchen"}))
        revision = self.store.revision("kitchen")
        self.store.update_room("kitchen", {"title": "My kitchen", "areaId": "kitchen"})
        reopened = models.ModelStore(self.temp.name).open()
        self.assertEqual(reopened.find("kitchen")["areaId"], "kitchen")
        self.assertEqual(reopened.find("kitchen")["title"], "My kitchen")
        self.assertEqual(reopened.find("kitchen")["bindings"], {"ceiling": "light.kitchen"})
        self.assertEqual(reopened.revision("kitchen"), revision)
        with zipfile.ZipFile(BytesIO(reopened.export("kitchen"))) as archive:
            exported = json.loads(archive.read("manifest.json"))
            self.assertEqual(exported["title"], "My kitchen")
            self.assertNotIn("areaId", exported)
        before = self.store.catalog()
        with patch.object(self.store, "save", side_effect=OSError("disk full")):
            with self.assertRaises(OSError):
                self.store.update_room("kitchen", {"areaId": "other"})
        self.assertEqual(self.store.catalog(), before)
        for invalid in ({"title": ""}, {"areaId": 42}, {"areaId": True}, {"id": "other"}):
            with self.assertRaises(ValueError):
                self.store.update_room("kitchen", invalid)
        self.store.update_room("kitchen", {"areaId": ""})
        self.assertEqual(self.store.find("kitchen")["areaId"], "")

    def test_model_roundtrip_preserves_mappings_and_private_storage(self):
        self.store.install(package(bindings={"ceiling": "light.kitchen"}))
        exported = self.store.export("kitchen")
        with tempfile.TemporaryDirectory() as other:
            second = models.ModelStore(other).open()
            second.install(exported)
            self.assertEqual(
                second.catalog()[0]["bindings"], {"ceiling": "light.kitchen"}
            )
        self.assertNotIn("folder", self.store.catalog()[0])
        reopened = models.ModelStore(self.temp.name).open()
        self.assertEqual(reopened.catalog(), self.store.catalog())
        self.assertTrue(reopened.scene_path("kitchen").is_file())

    def test_paths_executables_external_resources_and_unknown_nodes_rejected(self):
        invalid = [
            package(extra={"../secret": b"bad"}),
            package(extra={"script.js": b"bad"}),
            package(document={"images": [{"uri": "https://example.test/photo.jpg"}]}),
            package(document={"nodes": []}),
            package(bindings={"ceiling": "lock.front_door"}),
            package(manifest_change={"id": "../bad"}),
            package(manifest_change={"ambient": True}),
        ]
        for data in invalid:
            with self.subTest(size=len(data)), self.assertRaises(ValueError):
                self.store.install(data)
        self.assertEqual(self.store.catalog(), [])
        self.assertEqual(list((Path(self.temp.name) / "models").iterdir()), [])

    def test_duplicate_bindings_delete_and_catalog_failure_rollback(self):
        self.store.install(package())
        with self.assertRaises(ValueError):
            self.store.install(package())
        self.store.bind("kitchen", "ceiling", "switch.ceiling")
        with self.assertRaises(ValueError):
            self.store.bind("kitchen", "missing", "light.ceiling")
        before = self.store.catalog()
        with patch.object(models.os, "replace", side_effect=OSError("disk full")):
            with self.assertRaises(OSError):
                self.store.bind("kitchen", "ceiling", "light.new")
        self.assertEqual(before, self.store.catalog())
        self.store.remove("kitchen")
        self.assertEqual(models.ModelStore(self.temp.name).open().catalog(), [])

    def test_compressed_scene_cache_preserves_original_and_revision(self):
        import gzip

        self.store.install(package())
        before = self.store.catalog()[0]["sceneRevision"]
        raw = self.store.scene_bytes("kitchen")
        compressed = self.store.scene_bytes("kitchen", True)
        self.assertEqual(gzip.decompress(compressed), raw)
        self.assertEqual(self.store.scene_bytes("kitchen", True), compressed)
        self.store.bind("kitchen", "ceiling", "light.kitchen")
        self.assertEqual(self.store.catalog()[0]["sceneRevision"], before)
        self.store.remove("kitchen")
        self.store.install(package())
        self.assertNotEqual(self.store.catalog()[0]["sceneRevision"], before)

    def test_expansion_cap_and_duplicate_archive_entries(self):
        with patch.object(models, "MAX_EXPANDED", 5):
            with self.assertRaises(ValueError):
                self.store.install(package())
        output = BytesIO(package())
        with zipfile.ZipFile(output, "a") as archive:
            archive.writestr("scene.glb", b"duplicate")
        with self.assertRaises(ValueError):
            self.store.install(output.getvalue())


if __name__ == "__main__":
    unittest.main()


class ComponentTests(unittest.TestCase):
    def component(self):
        return {"schemaVersion": 1, "id": "kitchen-view", "title": "Kitchen overview", "height": 500,
                "layers": [{"model": "kitchen", "view": "front", "heading": 90, "tilt": 28, "zoom": 1.5}]}

    def test_component_persistence_and_independent_views(self):
        with tempfile.TemporaryDirectory() as directory:
            store = models.ModelStore(directory).open()
            store.install(package())
            first = self.component()
            store.put_component(first)
            second = {**first, "id": "kitchen-close", "title": "Close-up"}
            store.put_component(second)
            reopened = models.ModelStore(directory).open()
            self.assertEqual(len(reopened.components), 2)
            self.assertEqual(reopened.components[0]["layers"][0]["zoom"], 1.5)
            reopened.bind("kitchen", "ceiling", "light.kitchen")
            self.assertEqual(len(models.ModelStore(directory).open().components), 2)
            reopened.remove_component(first["id"])
            self.assertEqual(len(models.ModelStore(directory).open().components), 1)
            self.assertEqual(len(reopened.models), 1)

    def test_component_preserves_camera_snapshot_and_rejects_invalid_geometry(self):
        from copy import deepcopy
        camera = {"projection": "perspective", "position": [3, 7, -4], "target": [.7, 1, .4], "up": [0, 1, 0], "aspect": 1.8, "zoom": 1, "referenceZoom": 1.3, "heading": 143.2, "tilt": 48, "fov": 45}
        value = self.component()
        value["layers"][0].update(camera=camera, tilt=48, heading=143.2, zoom=1.3)
        with tempfile.TemporaryDirectory() as directory:
            store = models.ModelStore(directory).open()
            store.install(package())
            store.put_component(value)
            self.assertEqual(models.ModelStore(directory).open().components[0]["layers"][0]["camera"], camera)
        for change in ({"position": [float("inf"), 0, 0]}, {"projection": "orthographic"}, {"referenceZoom": 0}, {"fov": True}):
            bad = deepcopy(value)
            bad["layers"][0]["camera"].update(change)
            with self.assertRaises(ValueError):
                models.validate_component(bad, ["kitchen"])

    def test_invalid_components_and_failed_write_preserve_catalog(self):
        from copy import deepcopy
        for key, value in (("zoom", 0), ("heading", float("nan")), ("tilt", 181)):
            component = self.component()
            component["layers"][0][key] = value
            with self.assertRaises(ValueError):
                models.validate_component(component, ["kitchen"])
        with self.assertRaises(ValueError):
            models.validate_component(self.component(), [])
        with tempfile.TemporaryDirectory() as directory:
            store = models.ModelStore(directory).open()
            store.install(package())
            store.put_component(self.component())
            previous = deepcopy(store.components)
            with patch.object(store, "save", side_effect=OSError("disk unavailable")):
                with self.assertRaises(OSError):
                    store.put_component({**self.component(), "title": "Changed"})
            self.assertEqual(store.components, previous)
