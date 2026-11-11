"""Marker icons: any HA icon name (MDI or a custom set); frontend and backend agree."""
import re
import unittest
from pathlib import Path

from test_models import models

ICONS = Path(__file__).parents[1] / "rooms-app/shared/marker-icons.mjs"


class MarkerIconTests(unittest.TestCase):
    def test_patterns_match(self):
        js = re.search(r"MARKER_ICON_PATTERN =\s*/\^(.*)\$/;", ICONS.read_text())[1]
        self.assertEqual(js, models.MARKER_ICON.pattern.removesuffix("\\Z"))

    def test_validation(self):
        good = set(re.findall(r'\["(mdi:[a-z0-9-]+)"', ICONS.read_text())) | {
            "mdi:printer-3d-nozzle", "local:front-door", "local:Lamp_2.v1", "phu:light-ceiling", "custom-set:x"}
        for icon in good:
            self.assertEqual(models.validate_markers({"lamp": {"icon": icon}})["lamp"]["icon"], icon)
        for bad in ({"lamp": {"icon": "door"}}, {"lamp": {"icon": "Mdi:door"}}, {"lamp": {"icon": "local:"}},
                    {"lamp": {"icon": "local:a b"}}, {"lamp": {"icon": "local:x\"y"}}, {"lamp": {"icon": "local:<svg>"}},
                    {"lamp": {"icon": "local:" + "a" * 97}}, {"lamp": {"icon": 3}}, {"_defaults": {"icon": "mdi:lamp"}}):
            with self.assertRaises(ValueError):
                models.validate_markers(bad)


if __name__ == "__main__":
    unittest.main()

    def test_inactive_icon_is_validated_like_the_active_icon(self):
        clean = models.validate_markers({"lamp": {"icon": "mdi:lightbulb", "icon_off": "local:lamp-off"}})
        self.assertEqual(clean["lamp"], {"icon": "mdi:lightbulb", "icon_off": "local:lamp-off"})
        for bad in ({"lamp": {"icon_off": "lamp"}}, {"lamp": {"icon_off": 3}}, {"_defaults": {"icon_off": "mdi:lamp"}}):
            with self.assertRaises(ValueError):
                models.validate_markers(bad)
