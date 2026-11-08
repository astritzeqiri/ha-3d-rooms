"""Match rooms and device mappings when a full house is replaced.

Rooms placed in the house authoring app get a fresh ``roomId`` whenever they
are re-added to the layout, so the same physical room can arrive with a new
identity. Rooms therefore match by ``roomId`` first and then by name, and each
device mapping follows its control by ID first and then by name and type. The
user can override every suggestion; the same functions build the preview and
apply the confirmed choices, so both always agree.
"""

from __future__ import annotations

from copy import deepcopy
import re

MAX_CHOICES = 6000


def normalized(value):
    """Compare names without case, punctuation or spacing differences."""
    return " ".join(re.sub(r"[\W_]+", " ", str(value or "").casefold()).split())


def control_name(control):
    return control.get("label") or control.get("name") or control["id"]


def validate_choices(value):
    """Choices are {"rooms": {roomId: modelId | ""}, "controls": {roomId: {old: new | ""}}}."""
    if value is None:
        return {"rooms": {}, "controls": {}}
    if not isinstance(value, dict) or set(value) - {"rooms", "controls"}:
        raise ValueError("Invalid room matching choices.")
    rooms, controls = value.get("rooms", {}), value.get("controls", {})
    text = lambda v: isinstance(v, str) and len(v) <= 120
    if (not isinstance(rooms, dict) or not isinstance(controls, dict)
            or not all(text(k) and text(v) for k, v in rooms.items())
            or not all(text(k) and isinstance(m, dict) and all(text(a) and text(b) for a, b in m.items())
                       for k, m in controls.items())):
        raise ValueError("Invalid room matching choices.")
    return {"rooms": dict(rooms), "controls": {k: dict(v) for k, v in controls.items()}}


def match_rooms(old, pending, choices):
    """Return {incoming roomId: (previous model or None, how)}; each old room is used once."""
    by_id = {m["id"]: m for m in old}
    by_room = {m["housePlacement"]["roomId"]: m for m in old}
    used, result = set(), {}
    incoming = [m["housePlacement"]["roomId"] for m in pending]
    for room_id, model_id in choices["rooms"].items():
        if room_id not in incoming:
            raise ValueError("A room choice refers to a room that is not in this ZIP.")
        if model_id and (model_id not in by_id or model_id in used):
            raise ValueError("Each existing room can be replaced by only one room from the ZIP.")
        if model_id:
            used.add(model_id)
        result[room_id] = (by_id.get(model_id), "manual")
    for model in pending:
        room_id = model["housePlacement"]["roomId"]
        previous = by_room.get(room_id)
        if room_id not in result and previous and previous["id"] not in used:
            used.add(previous["id"])
            result[room_id] = (previous, "id")
    titles = {}
    for model in old:
        if model["id"] not in used:
            titles.setdefault(normalized(model["title"]), []).append(model)
    wanted = {}
    for model in pending:
        if model["housePlacement"]["roomId"] not in result:
            wanted.setdefault(normalized(model["title"]), []).append(model)
    for name, models in wanted.items():
        candidates = titles.get(name, [])
        if len(models) == 1 and len(candidates) == 1:
            used.add(candidates[0]["id"])
            result[models[0]["housePlacement"]["roomId"]] = (candidates[0], "name")
    for model in pending:
        result.setdefault(model["housePlacement"]["roomId"], (None, None))
    return result


def match_controls(previous, model, overrides, compatible):
    """Map each previous control ID to an incoming control ID (or None).

    Returns (control map, mapping rows for the review). Rows describe every
    previous device mapping and the compatible incoming controls it may use.
    """
    incoming = {c["id"]: c for c in model["controls"]}
    old = {c["id"]: c for c in previous["controls"]}
    bindings = previous.get("bindings", {})
    fits = lambda old_id, new_id: (old_id not in bindings
                                   or compatible(incoming[new_id], bindings[old_id]))
    same_kind = lambda a, b: a.get("type") == b.get("type")
    cmap, how = {}, {}
    for old_id, new_id in overrides.items():
        if old_id not in old:
            raise ValueError("A device choice refers to a device that is not in the existing room.")
        if new_id and (new_id not in incoming or not fits(old_id, new_id)):
            raise ValueError(f"{control_name(old[old_id])} cannot be connected to that device.")
        cmap[old_id], how[old_id] = new_id or None, "manual"
    taken = {v for v in cmap.values() if v}
    for old_id in old:
        if old_id not in cmap and old_id in incoming and old_id not in taken and fits(old_id, old_id):
            cmap[old_id], how[old_id] = old_id, "id"
            taken.add(old_id)
    names = {}
    for control in model["controls"]:
        if control["id"] not in taken:
            names.setdefault(normalized(control_name(control)), []).append(control)
    for old_id, control in old.items():
        if old_id in cmap:
            continue
        candidates = [c for c in names.get(normalized(control_name(control)), [])
                      if c["id"] not in taken and same_kind(c, control) and fits(old_id, c["id"])]
        if len(candidates) == 1:
            cmap[old_id], how[old_id] = candidates[0]["id"], "name"
            taken.add(candidates[0]["id"])
        else:
            cmap[old_id], how[old_id] = None, None
    targets = [v for k, v in cmap.items() if v and k in bindings]
    if len(targets) != len(set(targets)):
        raise ValueError("Two device mappings cannot use the same device in the new room.")
    rows = [{"control": old_id, "label": control_name(old.get(old_id, {"id": old_id})),
             "entity": entity, "target": cmap.get(old_id), "matchedBy": how.get(old_id),
             "options": [c["id"] for c in model["controls"] if compatible(c, entity)]}
            for old_id, entity in bindings.items()]
    return cmap, rows


def translated(previous, cmap):
    """A copy of the previous room whose control IDs follow the control map."""
    result = deepcopy(previous)
    result["controls"] = [{**c, "id": cmap[c["id"]]} for c in previous["controls"] if cmap.get(c["id"])]
    result["bindings"] = {cmap[k]: v for k, v in previous.get("bindings", {}).items() if cmap.get(k)}
    result["lightGroups"] = [{**g, "controls": [cmap[c] for c in g["controls"] if cmap.get(c)]}
                             for g in previous.get("lightGroups", [])]
    return result


def review(old, pending, compatible):
    """Every incoming room's suggested match plus mapping rows for every possible existing room."""
    suggested = match_rooms(old, pending, {"rooms": {}, "controls": {}})
    rooms = []
    for model in pending:
        room_id = model["housePlacement"]["roomId"]
        previous, how = suggested[room_id]
        candidates = {}
        for candidate in old:
            try:
                candidates[candidate["id"]] = match_controls(candidate, model, {}, compatible)[1]
            except ValueError:
                candidates[candidate["id"]] = []
        rooms.append({"roomId": room_id, "title": model["title"],
                      "match": previous["id"] if previous else None, "matchedBy": how,
                      "controls": [{"id": c["id"], "label": control_name(c), "type": c.get("type")}
                                   for c in model["controls"]],
                      "mappings": candidates})
    return rooms
