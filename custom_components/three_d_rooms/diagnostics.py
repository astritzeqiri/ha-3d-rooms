"""Diagnostics download: versions, room counts, storage size and optimization status.

Room and view names, entity ids and household data are left out; rooms and
views are listed by their ids only.
"""

from __future__ import annotations

from homeassistant.const import __version__ as HA_VERSION

from .const import DOMAIN, VERSION
from .health import library_summary
from .repairs import entity_exists


async def async_get_config_entry_diagnostics(hass, entry):
    data = hass.data.get(DOMAIN, {})
    runtime = data.get("runtime")
    out = {
        "integration_version": VERSION,
        "home_assistant_version": HA_VERSION,
        "assets_version": data.get("assets_version"),
        "loaded": runtime is not None,
    }
    if runtime is None:
        return out
    exists = entity_exists(hass)
    out["library"] = await hass.async_add_executor_job(library_summary, runtime.store, exists)
    optimizer = runtime.optimizer
    out["optimizer_running"] = bool(optimizer is not None and not optimizer.done())
    from homeassistant.helpers import issue_registry as ir

    out["repairs"] = sorted(
        issue_id for domain, issue_id in ir.async_get(hass).issues if domain == DOMAIN
    )
    return out
