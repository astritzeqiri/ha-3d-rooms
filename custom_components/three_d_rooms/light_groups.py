"""Room-local light groups; original fixtures and bindings remain recoverable."""
from copy import deepcopy
import re


def validate_light_groups(value, controls):
    if not isinstance(value, list) or len(value) > 100:
        raise ValueError("Provide up to 100 light groups.")
    lights = {c["id"] for c in controls if c["type"] == "light"}
    ids, members = set(), set()
    clean = []
    for group in value:
        if (not isinstance(group, dict) or set(group) != {"id", "label", "controls", "entityId"}
                or not isinstance(group["id"], str) or not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,79}", group["id"])
                or group["id"] in ids or group["id"] in {"constructor", "prototype"}
                or not isinstance(group["label"], str) or not group["label"].strip() or len(group["label"]) > 160
                or not isinstance(group["controls"], list) or not 2 <= len(group["controls"]) <= 200
                or any(not isinstance(c, str) or c not in lights or c in members for c in group["controls"])
                or len(set(group["controls"])) != len(group["controls"])
                or not isinstance(group["entityId"], str)
                or (group["entityId"] and not re.fullmatch(r"(?:light|switch)\.[a-z0-9_]+", group["entityId"]))):
            raise ValueError("Give each group a name, at least two distinct room lights and one compatible entity. Lights can belong to only one group.")
        ids.add(group["id"])
        members.update(group["controls"])
        clean.append({**deepcopy(group), "label": group["label"].strip()})
    return clean


def position_group_markers(controls):
    groups = {}
    for c in controls:
        if c.get("lightGroup"):
            groups.setdefault(c["lightGroup"], []).append(c)
    for members in groups.values():
        anchor = [sum(c["position"][i] for c in members) / len(members) for i in range(3)]
        for i, c in enumerate(members):
            c["lightGroupPrimary"] = i == 0
            c["markerPosition"] = anchor
            if i == 0:
                c["label"] = c["lightGroupLabel"]
    return controls


def apply_light_groups(model):
    model = deepcopy(model)
    for group in model.get("lightGroups", []):
        hidden = any(c.get("hidden") for c in model["controls"] if c["id"] in group["controls"])
        for c in model["controls"]:
            if c["id"] not in group["controls"]:
                continue
            if hidden:
                c["hidden"] = True
            c["sourceLabel"] = c["label"]
            c["lightGroup"] = group["id"]
            c["lightGroupLabel"] = group["label"]
            if group["entityId"]:
                model["bindings"][c["id"]] = group["entityId"]
            else:
                model["bindings"].pop(c["id"], None)
    position_group_markers(model["controls"])
    return model


def preserved_groups(previous, controls):
    ids = {c["id"] for c in controls if c["type"] == "light"}
    groups = [{**g, "controls": [c for c in g["controls"] if c in ids]} for g in previous.get("lightGroups", [])]
    return [g for g in groups if len(g["controls"]) >= 2]
