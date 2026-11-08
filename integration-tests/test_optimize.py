"""Server-made lighter scene copies. Requires Pillow (bundled with Home Assistant)."""

import importlib.util
from io import BytesIO
import json
from pathlib import Path
import struct
import sys
import tempfile
import types
import unittest
import zipfile

try:
    from PIL import Image
except ImportError:  # pragma: no cover - Home Assistant always ships Pillow
    Image = None

ROOT = Path(__file__).parents[1] / "custom_components/three_d_rooms"
package_module = types.ModuleType("rooms_optimize_test")
package_module.__path__ = [str(ROOT)]
sys.modules["rooms_optimize_test"] = package_module


def load(name):
    spec = importlib.util.spec_from_file_location(f"rooms_optimize_test.{name}", ROOT / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


optimize = load("optimize")
models = load("models")


def png(size, color, alpha=False):
    output = BytesIO()
    Image.new("RGBA" if alpha else "RGB", size, color).save(output, "PNG")
    return output.getvalue()


def scene(images, document_extra=None):
    """A GLB whose geometry views share bytes, like real exporter output."""
    geometry = struct.pack("<9f", 0, 0, 0, 1, 0, 0, 0, 1, 0)
    binary = bytearray(geometry)
    views = [
        {"buffer": 0, "byteOffset": 0, "byteLength": 36},
        {"buffer": 0, "byteOffset": 0, "byteLength": 36},  # shares the same bytes
    ]
    doc_images = []
    for data in images:
        binary.extend(b"\0" * (-len(binary) % 4))
        views.append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(data)})
        doc_images.append({"bufferView": len(views) - 1, "mimeType": "image/png"})
        binary.extend(data)
    binary.extend(b"\0" * (-len(binary) % 4))
    doc = {
        "asset": {"version": "2.0"},
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": views,
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3", "min": [0, 0, 0], "max": [1, 1, 0]},
            {"bufferView": 1, "componentType": 5126, "count": 3, "type": "VEC3"},
        ],
        "images": doc_images,
        "textures": [{"source": i} for i in range(len(images))],
        "materials": [
            {"pbrMetallicRoughness": {"baseColorTexture": {"index": 0}}, "normalTexture": {"index": len(images) - 1}}
        ],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1}, "material": 0}]}],
        "nodes": [{"mesh": 0, "name": "Lamp", "extras": {"controlId": "fixture"}}],
        "scenes": [{"nodes": [0]}],
        **(document_extra or {}),
    }
    return optimize.write_glb(doc, bytes(binary))


MANIFEST = {
    "schemaVersion": 1,
    "id": "kitchen",
    "title": "Kitchen",
    "units": "meters",
    "up": "Y",
    "scene": "scene.glb",
    "controls": [
        {"id": "ceiling", "label": "Ceiling", "type": "light", "position": [0, 2, 0],
         "capabilities": ["on_off"], "nodeIds": ["fixture"]}
    ],
}


def room_zip(glb):
    output = BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("manifest.json", json.dumps(MANIFEST))
        archive.writestr("scene.glb", glb)
    return output.getvalue()


@unittest.skipIf(Image is None, "Pillow is not installed")
class OptimizeSceneTests(unittest.TestCase):
    def test_duplicate_images_are_stored_once_and_large_ones_capped_as_webp(self):
        big = png((1600, 800), (200, 40, 30))
        normal = png((64, 64), (128, 128, 255))
        source = scene([big, big, normal])
        doc0, binary0 = optimize.read_glb(source)
        result = optimize.optimize_glb(source, 512)
        doc, binary = optimize.read_glb(result)

        self.assertLess(len(result), len(source))
        self.assertEqual(len(doc["images"]), 2)
        # Both copies of the large image now point at one WebP image of at most 512 px.
        webp = doc["textures"][0]["extensions"]["EXT_texture_webp"]["source"]
        self.assertEqual(doc["textures"][1]["extensions"]["EXT_texture_webp"]["source"], webp)
        self.assertNotIn("source", doc["textures"][0])
        view = doc["bufferViews"][doc["images"][webp]["bufferView"]]
        with Image.open(BytesIO(binary[view["byteOffset"] : view["byteOffset"] + view["byteLength"]])) as image:
            self.assertEqual(image.format, "WEBP")
            self.assertEqual(image.size, (512, 256))
        self.assertIn("EXT_texture_webp", doc["extensionsRequired"])
        # Geometry, nodes and metadata are unchanged, and shared views still share bytes.
        self.assertEqual(doc["nodes"], doc0["nodes"])
        self.assertEqual(doc["meshes"], doc0["meshes"])
        self.assertEqual(doc["accessors"], doc0["accessors"])
        self.assertEqual(doc["bufferViews"][0]["byteOffset"], doc["bufferViews"][1]["byteOffset"])
        start = doc["bufferViews"][0]["byteOffset"]
        self.assertEqual(binary[start : start + 36], binary0[:36])
        self.assertEqual(doc["buffers"][0]["byteLength"], len(binary))

    def test_small_images_that_would_grow_are_kept_byte_for_byte(self):
        tiny = png((4, 4), (10, 10, 10))
        source = scene([tiny])
        doc, binary = optimize.read_glb(optimize.optimize_glb(source, 512))
        view = doc["bufferViews"][doc["images"][0]["bufferView"]]
        if doc["images"][0]["mimeType"] == "image/png":
            self.assertEqual(binary[view["byteOffset"] : view["byteOffset"] + view["byteLength"]], tiny)
            self.assertEqual(doc["textures"][0], {"source": 0})

    def test_transparent_images_keep_alpha(self):
        source = scene([png((900, 900), (0, 200, 0, 90), alpha=True), png((8, 8), (128, 128, 255))])
        doc, binary = optimize.read_glb(optimize.optimize_glb(source, 512))
        view = doc["bufferViews"][doc["images"][0]["bufferView"]]
        with Image.open(BytesIO(binary[view["byteOffset"] : view["byteOffset"] + view["byteLength"]])) as image:
            self.assertEqual(image.mode, "RGBA")
            self.assertLess(abs(image.getpixel((5, 5))[3] - 90), 4)

    def test_store_serves_variants_with_revisions_and_keeps_the_upload(self):
        source = scene([png((1600, 1600), (90, 90, 90)), png((8, 8), (128, 128, 255))])
        with tempfile.TemporaryDirectory() as directory:
            store = models.ModelStore(directory).open()
            store.install(room_zip(source))
            before = store.revision("kitchen")
            self.assertEqual(store.scene_bytes("kitchen", variant="phone"), source)
            self.assertEqual(store.pending_optimizations(), [("kitchen", store.find("kitchen")["folder"])])

            self.assertTrue(store.optimize_room("kitchen", store.find("kitchen")["folder"]))
            after = store.revision("kitchen")
            self.assertNotEqual(after, before)
            self.assertEqual(store.pending_optimizations(), [])
            self.assertEqual(store.scene_bytes("kitchen"), source)
            phone = store.scene_bytes("kitchen", variant="phone")
            full = store.scene_bytes("kitchen", variant="full")
            self.assertLess(len(phone), len(source))
            self.assertNotEqual(phone, full)
            self.assertEqual(store.export("kitchen")[:2], b"PK")
            with zipfile.ZipFile(BytesIO(store.export("kitchen"))) as archive:
                self.assertEqual(archive.read("scene.glb"), source)
            # A reopened store (Home Assistant restart) advertises the same revision.
            self.assertEqual(models.ModelStore(directory).open().revision("kitchen"), after)
            with self.assertRaises(ValueError):
                store.scene_bytes("kitchen", variant="tiny")

    def test_browser_copies_must_match_the_upload_and_its_metadata(self):
        source = scene([png((64, 64), (90, 90, 90))])
        with tempfile.TemporaryDirectory() as directory:
            store = models.ModelStore(directory).open()
            store.install(room_zip(source))
            model = store.find("kitchen")
            current = store.source_revision(model)
            with self.assertRaisesRegex(ValueError, "replaced"):
                store.put_web_variant("kitchen", "phone", source, "old")
            renamed = json.loads(json.dumps(optimize.read_glb(source)[0]))
            renamed["nodes"][0]["name"] = "Other"
            with self.assertRaisesRegex(ValueError, "metadata"):
                store.put_web_variant("kitchen", "phone", optimize.write_glb(renamed, optimize.read_glb(source)[1]), current)
            draco = json.loads(json.dumps(optimize.read_glb(source)[0]))
            draco["extensionsRequired"] = ["KHR_draco_mesh_compression"]
            with self.assertRaisesRegex(ValueError, "Unsupported"):
                store.put_web_variant("kitchen", "phone", optimize.write_glb(draco, optimize.read_glb(source)[1]), current)

            result = store.put_web_variant("kitchen", "phone", source + b"", current)
            self.assertEqual(result["variant"], "phone")
            self.assertEqual(store.optimization_status("kitchen")["variants"]["phone"]["kind"], "web")
            # Browser copies win over server copies, which are no longer needed for that variant.
            store.optimize_room("kitchen", model["folder"])
            self.assertTrue(store.scene_file("kitchen", "phone").name.startswith("scene.web-"))
            self.assertTrue(store.scene_file("kitchen", "full").name.startswith("scene.s"))


if __name__ == "__main__":
    unittest.main()
