"""Library health shared by diagnostics, Repairs and services.

Pure functions over the model store: no Home Assistant imports, so the host
tests can run them. ``exists(entity_id)`` says whether Home Assistant still
knows an entity (a state or an entity registry entry).
"""

from __future__ import annotations

import os
from pathlib import Path


def room_entities(model):
    """``[(control_id, entity_id)]`` a room uses, light-group entities included."""
    pairs = list(model.get("bindings", {}).items())
    for group in model.get("lightGroups", []):
        if group.get("entityId"):
            pairs.extend((control, group["entityId"]) for control in group["controls"])
    seen, out = set(), []
    for control, entity in pairs:
        if entity and (control, entity) not in seen:
            seen.add((control, entity))
            out.append((control, entity))
    return out


def view_entities(view):
    """``[(item_id, entity_id)]`` added to a saved view as extra entities."""
    items = (view.get("markers") or {}).get("_entities") or {}
    return [(key, item["entity"]) for key, item in items.items() if item.get("entity")]


def missing_room_entities(store, exists):
    """``{model_id: sorted missing entity ids}`` for rooms with a gone entity."""
    found = {}
    for model in store.models:
        gone = sorted({e for _, e in room_entities(model) if not exists(e)})
        if gone:
            found[model["id"]] = gone
    return found


def missing_view_entities(store, exists):
    """``{view_id: sorted missing entity ids}`` for saved views."""
    found = {}
    for view in store.components:
        gone = sorted({e for _, e in view_entities(view) if not exists(e)})
        if gone:
            found[view["id"]] = gone
    return found


def failed_optimizations(store):
    """Room ids whose lighter phone/desktop copies could not be made."""
    return [m["id"] for m in store.models if store.optimization_failed(m["id"])]


def folder_bytes(path):
    total = 0
    for root, _, files in os.walk(path):
        for name in files:
            try:
                total += (Path(root) / name).stat().st_size
            except OSError:
                pass
    return total


def library_summary(store, exists):
    """Diagnostics: counts, sizes and status, without names or entity ids."""
    rooms = []
    for model in store.models:
        folder = store.directory / "models" / model["folder"]
        try:
            optimization = store.optimization_status(model["id"])
        except (OSError, ValueError):
            optimization = None
        types = {}
        for control in model.get("controls", []):
            kind = control.get("type", "light")
            types[kind] = types.get(kind, 0) + 1
        used = room_entities(model)
        placement = model.get("housePlacement") or {}
        rooms.append(
            {
                "id": model["id"],
                "in_house": bool(placement),
                "floors": len(placement.get("floors", [])),
                "controls": types,
                "bound_controls": len({c for c, _ in used}),
                "missing_entities": len({e for _, e in used if not exists(e)}),
                "light_groups": len(model.get("lightGroups", [])),
                "imported_at": model.get("importedAt"),
                "storage_bytes": folder_bytes(folder),
                "optimization": optimization,
                "optimization_failed": store.optimization_failed(model["id"]),
            }
        )
    views = [
        {
            "id": view["id"],
            "rooms": [layer.get("model") for layer in view.get("layers", [])],
            "extra_entities": len(view_entities(view)),
            "missing_entities": len({e for _, e in view_entities(view) if not exists(e)}),
            "background": view.get("background"),
        }
        for view in store.components
    ]
    catalog = store.directory / "catalog.json"
    return {
        "rooms": len(store.models),
        "houses": len(
            {m["housePlacement"]["houseId"] for m in store.models if m.get("housePlacement")}
        ),
        "saved_views": len(store.components),
        "storage_bytes": folder_bytes(store.directory),
        "catalog_bytes": catalog.stat().st_size if catalog.exists() else 0,
        "room_details": rooms,
        "view_details": views,
    }
