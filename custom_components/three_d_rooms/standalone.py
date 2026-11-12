"""A bare full-screen page that shows one saved dashboard view.

The page has no Home Assistant sidebar, header or menu. It carries no data: the
browser signs in with the Home Assistant login it already holds (or is sent to
the normal Home Assistant login) and then talks to the authenticated APIs, so
serving the HTML itself needs no authentication.
"""

from __future__ import annotations

import json
import re
from html import escape

from aiohttp import web
from homeassistant.components.http import HomeAssistantView

try:
    from homeassistant.components.frontend import DATA_EXTRA_MODULE_URL
except ImportError:  # A Home Assistant without this key: no extra modules.
    DATA_EXTRA_MODULE_URL = None

from .const import DOMAIN, STATIC_URL

VIEW_ID = re.compile(r"^[a-z0-9][a-z0-9_-]{0,79}$")
STANDALONE_URL = "/three_d_rooms_view"

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#101715">
<meta name="robots" content="noindex">
<link rel="icon" href="data:,">
<title>3D Rooms</title>
<style>html,body{margin:0;background:#101715;color:#edf2eb;font:14px/1.5 system-ui;overscroll-behavior:none;overflow:hidden}body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}input,textarea{-webkit-user-select:text;user-select:text}three-d-rooms-card{display:block;position:absolute;top:0;left:0;width:100%;height:100vh;height:var(--three-d-rooms-page-height,100dvh)}.status{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}</style>
</head>
<body data-view="@VIEW@" data-modules="@MODULES@">
<div class="status" id="status" role="status">Connecting to Home Assistant…</div>
<script type="module" src="@STATIC@/three-d-rooms-card.js?v=@VERSION@"></script>
<script type="module" src="@STATIC@/three-d-rooms-standalone.js?v=@VERSION@"></script>
</body>
</html>
"""


def extra_modules(hass):
    """The user's own frontend modules (such as custom icon sets), minus ours."""
    manager = hass.data.get(DATA_EXTRA_MODULE_URL) if DATA_EXTRA_MODULE_URL else None
    urls = getattr(manager, "urls", None) or []
    return sorted(u for u in urls if isinstance(u, str) and STATIC_URL not in u)


class StandalonePageView(HomeAssistantView):
    """`/three_d_rooms_view/<saved view id>`: the saved view alone, full screen."""

    url = STANDALONE_URL + "/{view_id}"
    name = "three_d_rooms:standalone"
    requires_auth = False

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request, view_id):
        version = self.hass.data.get(DOMAIN, {}).get("assets_version")
        if not VIEW_ID.fullmatch(view_id):
            raise web.HTTPNotFound()
        if version is None:
            raise web.HTTPServiceUnavailable(text="3D Rooms is not set up.")
        return web.Response(
            text=PAGE.replace("@VIEW@", escape(view_id, quote=True))
            .replace("@MODULES@", escape(json.dumps(extra_modules(self.hass)), quote=True))
            .replace("@STATIC@", STATIC_URL)
            .replace("@VERSION@", escape(version, quote=True)),
            content_type="text/html",
            headers={
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
                "Referrer-Policy": "same-origin",
            },
        )
