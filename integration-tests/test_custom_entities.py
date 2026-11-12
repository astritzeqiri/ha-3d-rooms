"""Extra entities of a view live in its markers (`_entities`)."""
import unittest

from test_models import models


class CustomEntityTests(unittest.TestCase):
    def test_entities_keep_entity_spot_and_non_default_options(self):
        clean = models.validate_markers({
            "lamp": {"size": 44},
            "_entities": {
                "e1": {"entity": "sensor.hall_temp", "position": [1, 1.2, -2]},
                "e2": {"entity": "switch.fan", "position": [0, 0, 0], "room": "office", "name": "  Fan ",
                       "icon": "mdi:fan", "size": 44, "show_state": False},
                "e3": {"entity": "light.x", "position": [0, 0, 0], "size": 32, "show_state": True, "name": " "},
            },
        })
        self.assertEqual(clean["_entities"], {
            "e1": {"entity": "sensor.hall_temp", "position": [1.0, 1.2, -2.0]},
            "e2": {"entity": "switch.fan", "position": [0.0, 0.0, 0.0], "room": "office", "name": "Fan",
                   "icon": "mdi:fan", "size": 44, "show_state": False},
            "e3": {"entity": "light.x", "position": [0.0, 0.0, 0.0], "size": 32, "show_state": True},
        })
        self.assertEqual(clean["lamp"], {"size": 44})
        self.assertNotIn("_entities", models.validate_markers({"_entities": {}}))

    def test_rejects_bad_values(self):
        ok = {"entity": "sensor.a", "position": [0, 0, 0]}
        for bad in (None, [], {"Bad Id": ok}, {"e1": {**ok, "entity": "not an entity"}},
                    {"e1": {"position": [0, 0, 0]}}, {"e1": {**ok, "position": [0, 0]}},
                    {"e1": {**ok, "position": [0, 0, 5000]}}, {"e1": {**ok, "position": [0, float("nan"), 0]}},
                    {"e1": {**ok, "size": 12}}, {"e1": {**ok, "size": True}}, {"e1": {**ok, "icon": "fan"}},
                    {"e1": {**ok, "show_state": "no"}}, {"e1": {**ok, "room": "Bad Room"}},
                    {"e1": {**ok, "name": "x" * 81}}, {"e1": {**ok, "extra": 1}},
                    {f"e{i}": ok for i in range(49)}):
            with self.assertRaises(ValueError, msg=bad):
                models.validate_markers({"_entities": bad})

    def test_an_entity_may_have_an_icon_per_look(self):
        clean = models.validate_markers({"_entities": {"e1": {
            "entity": "cover.g", "position": [0, 0, 0], "icon": "mdi:garage-open", "icon_off": "mdi:garage"}}})
        self.assertEqual(clean["_entities"]["e1"]["icon_off"], "mdi:garage")
        with self.assertRaises(ValueError):
            models.validate_markers({"_entities": {"e1": {"entity": "cover.g", "position": [0, 0, 0], "icon_off": "garage"}}})

    def test_an_entity_can_be_hidden(self):
        clean = models.validate_markers({"_entities": {
            "e1": {"entity": "sensor.a", "position": [0, 0, 0], "visible": False},
            "e2": {"entity": "sensor.b", "position": [0, 0, 0], "visible": True}}})
        self.assertEqual(clean["_entities"]["e1"]["visible"], False)
        self.assertEqual(clean["_entities"]["e2"]["visible"], True)
        with self.assertRaises(ValueError):
            models.validate_markers({"_entities": {"e1": {"entity": "sensor.a", "position": [0, 0, 0], "visible": "no"}}})

    def test_a_saved_view_keeps_its_extra_entities(self):
        view = {"schemaVersion": 1, "id": "hall-view", "title": "Hall", "height": 500,
                "markers": {"_entities": {"e1": {"entity": "sensor.a", "position": [0, 1, 0]}}},
                "layers": [{"model": "hall", "view": "front", "heading": 0, "tilt": 28, "zoom": 1}]}
        clean = models.validate_component(view, ["hall"])
        self.assertEqual(clean["markers"], {"_entities": {"e1": {"entity": "sensor.a", "position": [0.0, 1.0, 0.0]}}})


if __name__ == "__main__":
    unittest.main()
