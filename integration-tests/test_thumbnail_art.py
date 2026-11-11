"""Transparent room previews: the gallery draws them over the view's live background."""
import base64
import unittest

from test_models import models


def webp(extra=b"x" * 8):
    body = b"WEBP" + extra
    return b"RIFF" + len(body).to_bytes(4, "little") + body


def url(data):
    return "data:image/webp;base64," + base64.b64encode(data).decode()


class ThumbnailArtTests(unittest.TestCase):
    def test_accepts_a_well_formed_webp(self):
        value = url(webp())
        self.assertEqual(models.validate_thumbnail_art(value), value)

    def test_rejects_other_formats_sizes_and_truncated_files(self):
        for bad in (
            "data:image/png;base64,AAAA",
            "data:image/jpeg;base64,AAAA",
            "http://example.com/a.webp",
            url(b"RIFF\x00\x00\x00\x00JUNKxxxx"),
            url(webp()[:-1]),
            "data:image/webp;base64," + "A" * 140001,
            None,
        ):
            with self.assertRaises(ValueError, msg=str(bad)[:40]):
                models.validate_thumbnail_art(bad)


if __name__ == "__main__":
    unittest.main()
