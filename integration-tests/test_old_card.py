"""An old 3D Rooms card added as a dashboard resource is found for Repairs."""
import importlib.util
import sys
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "rooms_test.health", Path(__file__).parents[1] / "custom_components/three_d_rooms/health.py"
)
health = importlib.util.module_from_spec(spec)
sys.modules.setdefault("rooms_test.health", health)
spec.loader.exec_module(health)


class OldCardTests(unittest.TestCase):
    def test_finds_old_card_resources_but_not_the_integrations(self):
        items = [
            {"id": "a", "type": "module", "url": "/hacsfiles/ha-3d-rooms/ha-3d-rooms.js?hacstag=123"},
            {"id": "b", "type": "module", "url": "/local/three-d-rooms-card-0.31.0.js"},
            {"id": "c", "type": "module", "url": "/three_d_rooms_static/three-d-rooms-card.js?v=0.52.0"},
            {"id": "d", "type": "module", "url": "/hacsfiles/button-card/button-card.js"},
            {"id": "e", "type": "css", "url": None},
        ]
        found = health.stale_card_resources(items, "/three_d_rooms_static")
        self.assertEqual([item["id"] for item in found], ["a", "b"])
        self.assertEqual(health.stale_card_resources([], "/three_d_rooms_static"), [])
        self.assertEqual(health.stale_card_resources(None, "/three_d_rooms_static"), [])


if __name__ == "__main__":
    unittest.main()
