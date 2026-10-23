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
