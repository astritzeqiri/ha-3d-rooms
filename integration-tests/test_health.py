"""Library health used by diagnostics, Repairs and services (host-runnable)."""

import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest

ROOT = Path(__file__).parents[1] / "custom_components/three_d_rooms"
package_module = types.ModuleType("rooms_health_test")
package_module.__path__ = [str(ROOT)]
sys.modules["rooms_health_test"] = package_module


def load(name):
    spec = importlib.util.spec_from_file_location(f"rooms_health_test.{name}", ROOT / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


try:
    models = load("models")
    health = load("health")
except ImportError as error:  # pragma: no cover - optional imaging libraries
    models = health = None
    SKIP = str(error)
else:
    SKIP = ""

FOLDER = "a" * 32


def room(**extra):
    return {
        "id": "kitchen",
        "title": "Kitchen",
        "folder": FOLDER,
        "importedAt": "2026-11-13T00:00:00+00:00",
        "controls": [
            {"id": "ceiling", "type": "light", "capabilities": ["on_off"]},
            {"id": "spot-a", "type": "light", "capabilities": ["on_off"]},
            {"id": "spot-b", "type": "light", "capabilities": ["on_off"]},
        ],
        "bindings": {"ceiling": "light.kitchen", "spot-a": "light.gone"},
        **extra,
    }


def view(entities):
    return {
        "schemaVersion": 1,
        "id": "overview",
        "title": "Overview",
        "markers": {"_entities": {key: {"entity": e} for key, e in entities.items()}},
        "layers": [{"model": "kitchen"}],
    }


@unittest.skipIf(models is None, SKIP)
class HealthTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = models.ModelStore(self.temp.name)
        (self.store.directory / "models" / FOLDER).mkdir(parents=True)
        (self.store.directory / "models" / FOLDER / "scene.glb").write_bytes(b"x" * 100)
        self.store.models = [room()]
        self.store.components = [view({"door": "cover.garage", "old": "sensor.gone"})]
        self.exists = {"light.kitchen", "cover.garage"}.__contains__

    def test_finds_removed_entities_in_rooms_groups_and_views(self):
        self.store.models = [
            room(lightGroups=[{"id": "spots", "label": "Spots", "controls": ["spot-b"], "entityId": "light.old_group"}])
        ]
        self.assertEqual(
            health.missing_room_entities(self.store, self.exists),
            {"kitchen": ["light.gone", "light.old_group"]},
        )
        self.assertEqual(
            health.missing_view_entities(self.store, self.exists), {"overview": ["sensor.gone"]}
        )

    def test_unbind_keeps_the_devices_and_other_connections(self):
        removed = self.store.unbind_entities("kitchen", ["light.gone"])
        self.assertEqual(removed, ["spot-a"])
        self.assertEqual(self.store.models[0]["bindings"], {"ceiling": "light.kitchen"})
        self.assertEqual(len(self.store.models[0]["controls"]), 3)
        saved = json.loads((self.store.directory / "catalog.json").read_text())
        self.assertEqual(saved["models"][0]["bindings"], {"ceiling": "light.kitchen"})
        self.assertEqual(self.store.unbind_entities("kitchen", ["light.gone"]), [])

    def test_failed_optimizations_can_be_retried(self):
        marker = self.store.directory / "models" / FOLDER / f"scene.s{models.SERVER_VERSION}.failed"
        self.assertEqual(health.failed_optimizations(self.store), [])
        marker.touch()
        self.assertEqual(health.failed_optimizations(self.store), ["kitchen"])
        self.assertEqual(self.store.retry_optimizations(), ["kitchen"])
        self.assertFalse(marker.exists())

    def test_find_room_by_id_or_unique_title(self):
        self.assertEqual(self.store.find_room("kitchen")["id"], "kitchen")
        self.assertEqual(self.store.find_room(" kitchen ")["id"], "kitchen")
        self.assertEqual(self.store.find_room("KITCHEN")["id"], "kitchen")
        with self.assertRaises(ValueError):
            self.store.find_room("Attic")
        self.store.models.append({**room(), "id": "kitchen-2"})
        with self.assertRaises(ValueError):
            self.store.find_room("Kitchen")

    def test_summary_has_counts_and_sizes_but_no_names_or_entities(self):
        summary = health.library_summary(self.store, self.exists)
        self.assertEqual(summary["rooms"], 1)
        self.assertEqual(summary["saved_views"], 1)
        self.assertGreaterEqual(summary["storage_bytes"], 100)
        detail = summary["room_details"][0]
        self.assertEqual(detail["controls"], {"light": 3})
        self.assertEqual(detail["bound_controls"], 2)
        self.assertEqual(detail["missing_entities"], 1)
        self.assertEqual(summary["view_details"][0]["missing_entities"], 1)
        text = json.dumps(summary)
        for private in ("Kitchen", "Overview", "light.kitchen", "light.gone", "sensor.gone"):
            self.assertNotIn(private, text)


if __name__ == "__main__":
    unittest.main()
