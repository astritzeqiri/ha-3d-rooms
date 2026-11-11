"""Room buttons of a house view live in the saved view's markers (`_rooms`)."""
import unittest

from test_models import models


class RoomButtonTests(unittest.TestCase):
    def test_modes_positions_and_empty_entries(self):
        clean = models.validate_markers({
            "lamp": {"size": 44},
            "_rooms": {
                "office": {"mode": "always", "position": [1, 2.5, -3]},
                "hall": {"mode": "auto"},
                "den": {},
                "attic": {"mode": "never"},
            },
        })
        self.assertEqual(clean["_rooms"], {
            "office": {"mode": "always", "position": [1.0, 2.5, -3.0]},
            "attic": {"mode": "never"},
        })
        self.assertEqual(clean["lamp"], {"size": 44})
        self.assertNotIn("_rooms", models.validate_markers({"_rooms": {"hall": {}}}))

    def test_rejects_bad_values(self):
        for bad in (None, [], {"Bad Id": {}}, {"office": {"mode": "sometimes"}},
                    {"office": {"position": [1, 2]}}, {"office": {"position": [1, 2, float("inf")]}},
                    {"office": {"position": [1, 2, 5000]}}, {"office": {"extra": 1}}, {"office": []},
                    {f"r{i}": {} for i in range(65)}):
            with self.assertRaises(ValueError, msg=bad):
                models.validate_markers({"_rooms": bad})

    def test_a_room_may_choose_its_opening_angle(self):
        clean = models.validate_markers({"_rooms": {"office": {"heading": 90, "tilt": 55.5}, "hall": {"tilt": 0}}})
        self.assertEqual(clean["_rooms"], {"office": {"heading": 90.0, "tilt": 55.5}, "hall": {"tilt": 0.0}})
        for bad in ({"heading": 360}, {"heading": -1}, {"heading": "90"}, {"tilt": 181}, {"tilt": float("nan")}, {"tilt": True}):
            with self.assertRaises(ValueError, msg=bad):
                models.validate_markers({"_rooms": {"office": bad}})

    def test_a_room_button_can_have_its_own_size(self):
        clean = models.validate_markers({"_rooms": {"office": {"size": 40}, "hall": {"size": 30}, "den": {"size": 24, "mode": "always"}}})
        self.assertEqual(clean["_rooms"], {"office": {"size": 40}, "den": {"size": 24, "mode": "always"}})
        for bad in (19, 65, 30.5, "40", True, None):
            with self.assertRaises(ValueError, msg=bad):
                models.validate_markers({"_rooms": {"office": {"size": bad}}})

    def test_a_view_may_have_an_automatic_height(self):
        def view(height):
            return {"schemaVersion": 1, "id": "house-view", "title": "House", "height": height,
                    "layers": [{"model": "house", "view": "front", "heading": 0, "tilt": 28, "zoom": 1}]}
        self.assertEqual(models.validate_component(view("auto"), ["house"])["height"], "auto")
        self.assertEqual(models.validate_component(view(640), ["house"])["height"], 640)
        for bad in (179, 1601, 400.5, "400", "Auto", None, True):
            with self.assertRaises(ValueError, msg=bad):
                models.validate_component(view(bad), ["house"])

    def test_survives_saving_a_view(self):
        component = {"schemaVersion": 1, "id": "house-view", "title": "House", "height": 500,
                     "markers": {"_rooms": {"office": {"mode": "always", "position": [1, 2, 3]}}},
                     "layers": [{"model": "house", "view": "front", "heading": 0, "tilt": 28, "zoom": 1}]}
        saved = models.validate_component(component, ["house"])
        self.assertEqual(saved["markers"]["_rooms"]["office"]["mode"], "always")


if __name__ == "__main__":
    unittest.main()
