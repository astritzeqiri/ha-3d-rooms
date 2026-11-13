"""Repairs: rooms or views pointing at removed entities, and failed optimizations.

Issues are recomputed after Home Assistant starts, whenever the library
changes and when the entity registry changes (debounced). Each one has a fix
flow: disconnect the removed entities, or try the optimization again.
"""

from __future__ import annotations

import logging

from homeassistant import data_entry_flow
from homeassistant.components.repairs import ConfirmRepairFlow, RepairsFlow
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import CoreState, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import issue_registry as ir
from homeassistant.helpers.debounce import Debouncer

from .const import DOMAIN
from .health import failed_optimizations, missing_room_entities, missing_view_entities

LOGGER = logging.getLogger(__name__)
ROOM_ISSUE = "missing_entities_"
VIEW_ISSUE = "missing_view_entities_"
OPTIMIZE_ISSUE = "optimization_failed_"
SHOWN = 5


def entity_exists(hass):
    """A snapshot test, safe to use from executor threads: state or registry entry."""
    known = set(hass.states.async_entity_ids()) | set(er.async_get(hass).entities.keys())
    return known.__contains__


def listing(entity_ids):
    shown = ", ".join(entity_ids[:SHOWN])
    more = len(entity_ids) - SHOWN
    return f"{shown} and {more} more" if more > 0 else shown


class HealthMonitor:
    """Keeps this integration's Repairs issues in step with the library."""

    def __init__(self, hass, runtime):
        self.hass = hass
        self.runtime = runtime
        self.unsubscribe = []
        self.debouncer = Debouncer(
            hass, LOGGER, cooldown=5, immediate=False, function=self.async_check
        )

    @callback
    def _request(self, _event=None):
        self.debouncer.async_schedule_call()

    @callback
    def _started(self, _event=None):
        self.hass.async_create_task(self.async_check(), eager_start=True)

    @callback
    def async_start(self):
        self.unsubscribe.append(self.hass.bus.async_listen("three_d_rooms_updated", self._request))
        self.unsubscribe.append(
            self.hass.bus.async_listen(er.EVENT_ENTITY_REGISTRY_UPDATED, self._request)
        )
        # Before start, integrations are still adding their entities.
        if self.hass.state is CoreState.running:
            self._started()
        else:
            self.unsubscribe.append(
                self.hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, self._started)
            )

    @callback
    def async_stop(self):
        for unsubscribe in self.unsubscribe:
            try:
                unsubscribe()
            except (ValueError, KeyError):  # a run-once listener that already ran
                pass
        self.unsubscribe.clear()
        self.debouncer.async_cancel()

    async def async_check(self):
        store = self.runtime.store
        exists = entity_exists(self.hass)
        rooms = missing_room_entities(store, exists)
        views = missing_view_entities(store, exists)
        failed = await self.hass.async_add_executor_job(failed_optimizations, store)
        titles = {m["id"]: m["title"] for m in store.models}
        view_titles = {v["id"]: v["title"] for v in store.components}
        wanted = {}
        for model_id, gone in rooms.items():
            wanted[ROOM_ISSUE + model_id] = (
                "missing_entities",
                {"room": titles[model_id], "count": str(len(gone)), "entities": listing(gone)},
                {"model": model_id, "entities": gone},
            )
        for view_id, gone in views.items():
            wanted[VIEW_ISSUE + view_id] = (
                "missing_view_entities",
                {"view": view_titles[view_id], "count": str(len(gone)), "entities": listing(gone)},
                {"view": view_id, "entities": gone},
            )
        for model_id in failed:
            wanted[OPTIMIZE_ISSUE + model_id] = (
                "optimization_failed",
                {"room": titles[model_id]},
                {"model": model_id},
            )
        for issue_id, (key, placeholders, data) in wanted.items():
            ir.async_create_issue(
                self.hass,
                DOMAIN,
                issue_id,
                is_fixable=True,
                is_persistent=False,
                severity=ir.IssueSeverity.WARNING,
                translation_key=key,
                translation_placeholders=placeholders,
                data=data,
            )
        registry = ir.async_get(self.hass)
        for domain, issue_id in list(registry.issues):
            if domain == DOMAIN and issue_id not in wanted:
                ir.async_delete_issue(self.hass, DOMAIN, issue_id)


def clear_issues(hass):
    """Remove every issue of this integration (it is being unloaded)."""
    registry = ir.async_get(hass)
    for domain, issue_id in list(registry.issues):
        if domain == DOMAIN:
            ir.async_delete_issue(hass, DOMAIN, issue_id)


class _ActionFlow(ConfirmRepairFlow):
    """Confirm, run the fix, then let the monitor drop the issue."""

    def __init__(self, data):
        super().__init__()
        self.data = data or {}

    async def async_step_confirm(self, user_input=None) -> data_entry_flow.FlowResult:
        if user_input is not None:
            runtime = self.hass.data.get(DOMAIN, {}).get("runtime")
            if runtime is None:
                return self.async_abort(reason="not_loaded")
            try:
                await self.fix(runtime)
            except ValueError:
                return self.async_abort(reason="gone")
            self.hass.bus.async_fire("three_d_rooms_updated")
            monitor = self.hass.data[DOMAIN].get("health")
            if monitor is not None:
                await monitor.async_check()
            return self.async_create_entry(data={})
        issue = ir.async_get(self.hass).async_get_issue(DOMAIN, self.issue_id)
        return self.async_show_form(
            step_id="confirm",
            description_placeholders=issue.translation_placeholders if issue else None,
        )

    async def fix(self, runtime):
        raise NotImplementedError


class UnbindRoomFlow(_ActionFlow):
    async def fix(self, runtime):
        await runtime.work(runtime.store.unbind_entities, self.data["model"], self.data["entities"])


class DropViewEntitiesFlow(_ActionFlow):
    async def fix(self, runtime):
        await runtime.work(runtime.store.drop_view_entities, self.data["view"], self.data["entities"])


class RetryOptimizeFlow(_ActionFlow):
    async def fix(self, runtime):
        await runtime.work(runtime.store.retry_optimizations, [self.data["model"]])
        runtime.schedule_optimize()


async def async_create_fix_flow(hass, issue_id, data) -> RepairsFlow:
    if issue_id.startswith(ROOM_ISSUE):
        return UnbindRoomFlow(data)
    if issue_id.startswith(VIEW_ISSUE):
        return DropViewEntitiesFlow(data)
    if issue_id.startswith(OPTIMIZE_ISSUE):
        return RetryOptimizeFlow(data)
    return ConfirmRepairFlow()
