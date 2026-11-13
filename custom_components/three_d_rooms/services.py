"""Services for automations and scripts: reload the library, export a room."""

from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path

try:
    import probatio as vol
except ImportError:  # Home Assistant versions before the schema migration.
    import voluptuous as vol

from homeassistant.core import ServiceCall, ServiceResponse, SupportsResponse
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN

EXPORT_FOLDER = "3d_rooms_exports"
FILENAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 ._-]{0,99}$")

RELOAD_SCHEMA = vol.Schema({vol.Optional("retry_optimizations", default=False): cv.boolean})
EXPORT_SCHEMA = vol.Schema(
    {vol.Required("room"): cv.string, vol.Optional("filename"): cv.string}
)


def _runtime(hass):
    runtime = hass.data.get(DOMAIN, {}).get("runtime")
    if runtime is None:
        raise ServiceValidationError("3D Rooms is not set up.")
    return runtime


def export_name(title, filename=None):
    """A safe file name in the export folder, ending in .zip."""
    if filename:
        name = filename.strip()
        if name.lower().endswith(".zip"):
            name = name[:-4]
        if not FILENAME.fullmatch(name) or ".." in name:
            raise ServiceValidationError(
                "Use a file name of letters, numbers, spaces, dots, dashes or underscores."
            )
    else:
        slug = re.sub(r"[^a-z0-9]+", "-", title.casefold()).strip("-") or "room"
        name = f"{slug}-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    return f"{name}.zip"


def _write(path: Path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".zip.tmp")
    temporary.write_bytes(data)
    temporary.replace(path)


async def _reload(call: ServiceCall) -> None:
    hass = call.hass
    runtime = _runtime(hass)
    async with runtime.lock:
        if call.data["retry_optimizations"]:
            await hass.async_add_executor_job(runtime.store.retry_optimizations)
        try:
            await hass.async_add_executor_job(runtime.store.open)
        except (OSError, ValueError) as error:
            raise HomeAssistantError(f"Could not read the 3D Rooms library: {error}") from error
    runtime.schedule_optimize()
    # Open cards, the manager and Repairs all pick the library up again.
    hass.bus.async_fire("three_d_rooms_updated")


async def _export(call: ServiceCall) -> ServiceResponse:
    hass = call.hass
    runtime = _runtime(hass)
    try:
        model = runtime.store.find_room(call.data["room"])
    except ValueError as error:
        raise ServiceValidationError(str(error)) from error
    path = Path(hass.config.path(EXPORT_FOLDER, export_name(model["title"], call.data.get("filename"))))
    try:
        data = await runtime.work(runtime.store.export, model["id"])
        await hass.async_add_executor_job(_write, path, data)
    except (OSError, ValueError) as error:
        raise HomeAssistantError(f"Could not export {model['title']}: {error}") from error
    return {"room": model["id"], "title": model["title"], "path": str(path), "bytes": len(data)}


def async_register_services(hass):
    hass.services.async_register(DOMAIN, "reload", _reload, schema=RELOAD_SCHEMA)
    hass.services.async_register(
        DOMAIN,
        "export_room",
        _export,
        schema=EXPORT_SCHEMA,
        supports_response=SupportsResponse.OPTIONAL,
    )
