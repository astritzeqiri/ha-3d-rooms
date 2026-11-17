"""Robot vacuums map only to vacuum entities and send only supported actions."""
import json
import sys
import types
import unittest
import zipfile
from io import BytesIO

from test_models import models, package

VACUUM = {"id": "corridor-vacuum", "label": "Robot vacuum", "type": "vacuum", "position": [0, 0, 0],
          "facing": [0, 0, 1], "capabilities": ["start", "pause", "stop", "return_home", "locate"]}


def manifest():
    with zipfile.ZipFile(BytesIO(package())) as archive:
        return json.loads(archive.read("manifest.json"))


class VacuumTests(unittest.TestCase):
    def test_manifest_capabilities_facing_and_bindings(self):
        m = manifest()
        m["controls"] = m["controls"] + [VACUUM]
        clean = models.validate_manifest(m)["controls"][1]
        self.assertEqual((clean["type"], clean["facing"]), ("vacuum", [0, 0, 1]))
        self.assertTrue(models.compatible_entity(VACUUM, "vacuum.bubi_5_roborock"))
        for entity in ("light.vacuum", "switch.vacuum", "lock.vacuum", "button.vacuum"):
            self.assertFalse(models.compatible_entity(VACUUM, entity))
        models.validate_bindings({"corridor-vacuum": "vacuum.bubi_5_roborock"}, m)
        for caps in ([], ["pause"], ["start", "clean_everything"], ["on_off"]):
            with self.assertRaises(ValueError):
                models.validate_manifest({**m, "controls": [{**VACUUM, "capabilities": caps}]})
        for facing in ([0, 1, 0], [0, 0, 2], [1, 0], "north"):
            with self.assertRaises(ValueError):
                models.validate_manifest({**m, "controls": [{**VACUUM, "facing": facing}]})
        with self.assertRaises(ValueError):
            models.validate_manifest({**m, "controls": [{**m["controls"][0], "facing": [0, 0, 1]}]})
        without = {k: v for k, v in VACUUM.items() if k != "facing"}
        self.assertNotIn("facing", models.validate_manifest({**m, "controls": [without]})["controls"][0])

    def test_house_views_rotate_facing(self):
        placed_direction = sys.modules["rooms_test.house"].placed_direction
        quarter = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 5, 2, 3, 1]
        self.assertEqual(placed_direction([0, 0, 1], quarter), [1, 0, 0])

    def test_commands_need_model_capability_and_vacuum_feature(self):
        api = load_api()

        class Entity:
            domain = "vacuum"
            attributes = {"supported_features": 8192 | 4 | 16 | 512}

        self.assertEqual(api.vacuum_command({"action": "start"}, VACUUM, Entity()), ("start", {}))
        self.assertEqual(api.vacuum_command({"action": "return_to_base"}, VACUUM, Entity()), ("return_to_base", {}))
        for action in ("stop", "clean_spot", "turn_on", None):  # stop not supported by this entity
            with self.assertRaises(ValueError):
                api.vacuum_command({"action": action}, VACUUM, Entity())
        with self.assertRaises(ValueError):
            api.vacuum_command({"action": "locate"}, {**VACUUM, "capabilities": ["start"]}, Entity())
        other = Entity()
        other.domain = "lock"
        with self.assertRaises(ValueError):
            api.vacuum_command({"action": "start"}, VACUUM, other)


def load_api():
    """api.py imports Home Assistant; read just the vacuum helper from its source."""
    import ast
    from pathlib import Path
    source = Path(models.__file__).with_name("api.py").read_text()
    tree = ast.parse(source)
    wanted = [n for n in tree.body if (isinstance(n, ast.Assign) and any(getattr(t, "id", "") == "VACUUM_ACTIONS" for t in n.targets))
              or (isinstance(n, ast.FunctionDef) and n.name == "vacuum_command")]
    namespace = {}
    exec(compile(ast.Module(body=wanted, type_ignores=[]), "api.py", "exec"), namespace)
    return types.SimpleNamespace(**namespace)


if __name__ == "__main__":
    unittest.main()
