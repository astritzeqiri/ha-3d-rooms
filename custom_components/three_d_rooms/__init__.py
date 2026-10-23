"""3D Rooms: one local integration with an included sidebar and dashboard card."""

from pathlib import Path

from homeassistant.components import frontend, panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig
from .api import (
    ModelAssetView,
    ModelReplaceView,
    ModelUploadView,
    RoomsRuntime,
    websocket_request,
)
from .const import DOMAIN, STATIC_URL, VERSION
from .models import ModelStore


async def async_setup(hass, config):
    """Register code-only static assets and authenticated APIs once per process."""
    await hass.http.async_register_static_paths(
        [StaticPathConfig(STATIC_URL, str(Path(__file__).parent / "frontend"), False)]
    )
    hass.http.register_view(ModelUploadView(hass))
    hass.http.register_view(ModelReplaceView(hass))
    hass.http.register_view(ModelAssetView(hass))
    websocket_api.async_register_command(hass, websocket_request)
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass, entry):
    """Open the persistent library and expose the bundled UI."""
    store = ModelStore(hass.config.path(".storage", DOMAIN))
    await hass.async_add_executor_job(store.open)
    hass.data[DOMAIN]["runtime"] = RoomsRuntime(hass, store)
    module_url = f"{STATIC_URL}/three-d-rooms-card.js?v={VERSION}"
    # HA loads this ES module on every frontend, including dashboard-only visits.
    # No user-managed Lovelace resource or second HACS download is needed.
    frontend.add_extra_js_url(hass, module_url)
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=DOMAIN,
        webcomponent_name="three-d-rooms-panel",
        sidebar_title="3D Rooms",
        sidebar_icon="mdi:floor-plan",
        module_url=module_url,
        require_admin=True,
    )
    return True


async def async_unload_entry(hass, entry):
    """Hide the panel, while retaining models for a later setup or recovery."""
    runtime = hass.data[DOMAIN].get("runtime")
    if runtime is not None:
        async with runtime.lock:
            hass.data[DOMAIN].pop("runtime", None)
    frontend.async_remove_panel(hass, DOMAIN)
    return True
