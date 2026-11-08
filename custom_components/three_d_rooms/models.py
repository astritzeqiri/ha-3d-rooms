"""Bounded, embedded-only model packages and transactional local storage.

This module has no Home Assistant dependencies so archive validation can be
exercised independently of the running server.
"""

from __future__ import annotations

from .light_groups import validate_light_groups, apply_light_groups, preserved_groups
from copy import deepcopy
from datetime import datetime, timezone
from io import BytesIO
import json
import base64
import binascii
import gzip
import hashlib
import math
import os
from pathlib import Path
import re
import shutil
import stat
import struct
import tempfile
from uuid import uuid4
import zipfile

from .house import validate_placement, house_models

MAX_UPLOAD = 100 * 1024 * 1024
MAX_EXPANDED = 300 * 1024 * 1024
ID = re.compile(r"[a-z0-9][a-z0-9_-]{0,79}\Z")
ENTITY = re.compile(r"(?:climate|light|switch|cover|number|input_number|button|input_button|script|scene)\.[a-z0-9_]+\Z")
SAFE_FILE = re.compile(
    r"(?:manifest\.json|house-placement\.json|bindings\.json|scene\.glb|thumbnail\.(?:png|jpg|webp)|textures/[a-zA-Z0-9_./-]+)\Z"
)


def valid_id(value):
    return (
        isinstance(value, str)
        and ID.fullmatch(value)
        and value not in ("constructor", "prototype")
    )


def number(value):
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
    )


def vector(value):
    return (
        isinstance(value, list)
        and len(value) == 3
        and all(number(v) and abs(v) < 10000 for v in value)
    )


def validate_daylight(value, controls):
    if not isinstance(value, dict) or value.get("mode") not in ("day", "night", "auto"):
        raise ValueError("Choose Day, Night or Auto daylight.")
    if not isinstance(value.get("entity"), str) or not re.fullmatch(
        r"sun\.[a-z0-9_]+", value["entity"]
    ):
        raise ValueError("Choose a sun entity for automatic daylight.")
    windows = value.get("windows")
    if not isinstance(windows, list) or not 1 <= len(windows) <= 40:
        raise ValueError("Declare 1–40 daylight windows.")
    seen = set()
    for window in windows:
        if (
            not isinstance(window, dict)
            or not valid_id(window.get("id"))
            or window["id"] in seen
        ):
            raise ValueError("Daylight windows need unique stable IDs.")
        seen.add(window["id"])
        if (
            not valid_id(window.get("nodeId"))
            or not vector(window.get("position"))
            or not vector(window.get("inward"))
            or sum(v * v for v in window["inward"]) < .01
        ):
            raise ValueError("Declare each window's scene node, position and inward direction.")
        if any(
            not number(window.get(key)) or not .01 <= window[key] <= 30
            for key in ("width", "height")
        ):
            raise ValueError("Daylight window dimensions must be 0.01–30 meters.")
        if window.get("coverId") is not None and not any(
            c["id"] == window["coverId"] and c["type"] == "cover" for c in controls
        ):
            raise ValueError("Daylight windows must reference a declared cover.")
        if (
            not number(window.get("defaultPosition", 0))
            or not 0 <= window.get("defaultPosition", 0) <= 100
        ):
            raise ValueError("Invalid default daylight opening.")
    return deepcopy(value)


def validate_manifest(m):
    """Validate and return only supported manifest fields."""
    if (
        not isinstance(m, dict)
        or m.get("schemaVersion") != 1
        or not valid_id(m.get("id"))
    ):
        raise ValueError("Use a schemaVersion 1 model with a valid stable ID.")
    if (
        not isinstance(m.get("title"), str)
        or not m["title"].strip()
        or len(m["title"]) > 160
    ):
        raise ValueError("Provide a model title up to 160 characters.")
    if (
        m.get("units") != "meters"
        or m.get("up") != "Y"
        or m.get("scene") != "scene.glb"
    ):
        raise ValueError("Models must use meters, Y up, and scene.glb.")
    controls = m.get("controls")
    if not isinstance(controls, list) or len(controls) > 200:
        raise ValueError("Provide up to 200 controls.")
    seen = set()
    for c in controls:
        if not isinstance(c, dict) or not valid_id(c.get("id")) or c["id"] in seen:
            raise ValueError("Every control needs a unique stable ID.")
        seen.add(c["id"])
        if "hidden" in c and not isinstance(c["hidden"], bool):
            raise ValueError("Device hidden must be a boolean.")
        if (
            c.get("type") not in ("light", "cover", "number", "button", "climate")
            or not isinstance(c.get("label"), str)
            or not c["label"].strip()
            or len(c["label"]) > 160
        ):
            raise ValueError("Every control must be a labeled light, cover or number.")
        if not vector(c.get("position")):
            raise ValueError("Every control needs a position in meters.")
        if "intensity" in c and (
            not number(c["intensity"]) or not 0 <= c["intensity"] <= 100
        ):
            raise ValueError("Light intensity must be between 0 and 100.")
        if "color" in c and (
            not isinstance(c["color"], str)
            or not re.fullmatch(r"#[0-9a-fA-F]{6}", c["color"])
        ):
            raise ValueError("Use a six-digit hex light color.")
        if "nodeIds" in c and (
            not isinstance(c["nodeIds"], list)
            or not all(valid_id(n) for n in c["nodeIds"])
        ):
            raise ValueError("Invalid light scene node IDs.")
        if c["type"] == "cover" and c.get("motion") != "none" and (
            not c.get("nodeIds")
            or not number(c.get("defaultPosition", 0))
            or not 0 <= c.get("defaultPosition", 0) <= 100
        ):
            raise ValueError("Covers need scene nodes and a default position from 0 to 100.")
        if c["type"] == "number":
            if (not c.get("nodeIds") or not all(number(c.get(k)) for k in ("min", "max", "step", "defaultValue"))
                or not c["min"] < c["max"] or c["step"] <= 0
                or not c["min"] <= c["defaultValue"] <= c["max"] or c.get("unit") != "cm"):
                raise ValueError("Numbers need nodes, a valid centimetre range, step and default value.")
        if c.get("motion") is not None and (c["type"] != "cover" or c["motion"] != "none" or c.get("nodeIds")):
            raise ValueError("Command-only covers must have no moving scene nodes.")
        if c.get("group") is not None and (not valid_id(c["group"]) or not any(item.get("id") == c["group"] and item.get("type") == "number" for item in controls)):
            raise ValueError("Companion controls must reference a declared number.")
        caps = c.get("capabilities")
        if (
            not isinstance(caps, list)
            or ("more_info" if c["type"] == "climate" else "press" if c["type"] == "button" else "set_value" if c["type"] == "number" else "open_close" if c["type"] == "cover" else "on_off") not in caps
            or any(
                v not in (
                    ("more_info",) if c["type"] == "climate" else ("press",) if c["type"] == "button" else ("set_value",) if c["type"] == "number" else ("open_close", "position", "stop") if c["type"] == "cover"
                    else ("on_off", "brightness", "color", "color_temp")
                ) for v in caps
            )
        ):
            raise ValueError("Unsupported control capabilities.")
    if "appearance" in m:
        validate_appearance(m["appearance"])
    validate_light_groups(m.get("lightGroups", []), controls)
    validate_devices(m.get("devices", []), controls)
    if "deviceSettings" in m:
        validate_device_settings(m["deviceSettings"], m.get("devices", []))
    if "daylight" in m:
        validate_daylight(m["daylight"], controls)
    if "camera" in m and (
        not isinstance(m["camera"], dict)
        or not vector(m["camera"].get("position"))
        or not vector(m["camera"].get("target"))
    ):
        raise ValueError("Invalid model camera.")
    if "ambient" in m and (not number(m["ambient"]) or not 0.05 <= m["ambient"] <= 1):
        raise ValueError("Ambient light must be between 0.05 and 1.")
    if "floor" in m and (not isinstance(m["floor"], str) or len(m["floor"]) > 160):
        raise ValueError("Floor name must be up to 160 characters.")
    if "housePlacement" in m:
        m = {**m, "housePlacement": validate_placement(m["housePlacement"])}
    return {
        k: deepcopy(v)
        for k, v in m.items()
        if k
        in (
            "housePlacement",
            "schemaVersion",
            "id",
            "title",
            "floor",
            "units",
            "up",
            "scene",
            "controls",
            "camera",
            "ambient",
            "daylight",
            "devices",
            "deviceSettings",
            "lightGroups",
            "appearance",
        )
    }


def preserve_device_visibility(previous, incoming):
    old = {c["id"]: c for c in previous["controls"]}
    for control in incoming["controls"]:
        if control["id"] in old:
            if old[control["id"]].get("hidden"):
                control["hidden"] = True
            else:
                control.pop("hidden", None)


def validate_appearance(value):
    if not isinstance(value, list) or len(value) > 40:
        raise ValueError("Provide up to 40 optional architectural parts.")
    seen = set()
    for part in value:
        if (not isinstance(part, dict) or set(part) != {"id", "label", "visible"}
                or not valid_id(part.get("id")) or part["id"] in seen
                or not isinstance(part.get("label"), str) or not part["label"].strip()
                or len(part["label"]) > 160 or not isinstance(part.get("visible"), bool)):
            raise ValueError("Optional architecture needs unique IDs, labels and visibility.")
        seen.add(part["id"])
    return deepcopy(value)


def validate_devices(devices, controls):
    if not isinstance(devices, list) or len(devices) > 100:
        raise ValueError("Invalid devices.")
    seen, members = set(), set()
    for device in devices:
        if (not isinstance(device, dict) or not valid_id(device.get("id")) or device["id"] in seen
            or device.get("type") != "adjustable_desk" or not isinstance(device.get("label"), str)
            or not device["label"].strip() or len(device["label"]) > 160
            or not isinstance(device.get("macros"), list) or len(device["macros"]) != 4):
            raise ValueError("Invalid adjustable desk device.")
        seen.add(device["id"])
        roles = [(device.get("height"), "number"), (device.get("motion"), "cover")] + [(key, "button") for key in device["macros"]]
        for key, kind in roles:
            if not valid_id(key) or key in members or not any(c["id"] == key and c["type"] == kind for c in controls):
                raise ValueError("Desk roles must reference distinct compatible controls.")
            members.add(key)
        if next(c for c in controls if c["id"] == device["motion"]).get("motion") != "none":
            raise ValueError("Desk motion must be a command-only cover.")
    return deepcopy(devices)


def validate_device_settings(value, devices):
    if not isinstance(value, dict):
        raise ValueError("Invalid device settings.")
    clean = {}
    for key, settings in value.items():
        device = next((d for d in devices if d["id"] == key), None)
        if (not device or not isinstance(settings, dict) or set(settings) != {"macroNames"}
            or not isinstance(settings["macroNames"], dict)):
            raise ValueError("Invalid desk settings.")
        names = {}
        for control_id, name in settings["macroNames"].items():
            if control_id not in device["macros"] or not isinstance(name, str) or len(name) > 80:
                raise ValueError("Macro names must be at most 80 characters.")
            names[control_id] = name.strip()
        clean[key] = {"macroNames": names}
    return clean


def validate_camera_snapshot(value, view):
    """Accept only finite camera geometry, never arbitrary component properties."""
    def vector(v):
        return isinstance(v, list) and len(v) == 3 and all(number(n) and abs(n) < 10000 for n in v)

    def positive(n):
        return number(n) and 0 < n <= 10000

    if not isinstance(value, dict) or not all(vector(value.get(k)) for k in ("position", "target", "up")):
        raise ValueError("Invalid saved camera view.")
    if math.dist(value["position"], value["target"]) < 1e-8 or math.hypot(*value["up"]) < 1e-8:
        raise ValueError("Invalid saved camera view.")
    if not all(positive(value.get(k)) for k in ("aspect", "zoom", "referenceZoom")):
        raise ValueError("Invalid saved camera view.")
    if not number(value.get("heading")) or not 0 <= value["heading"] < 360 or not number(value.get("tilt")) or not 0 <= value["tilt"] <= 180:
        raise ValueError("Invalid saved camera view.")
    projection = "orthographic" if view == "floor" else "perspective"
    if value.get("projection") != projection:
        raise ValueError("Saved camera projection must match the selected view.")
    key = "halfHeight" if projection == "orthographic" else "fov"
    if (key == "halfHeight" and not positive(value.get(key))) or (key == "fov" and (not number(value.get(key)) or not 1 <= value[key] <= 179)):
        raise ValueError("Invalid saved camera projection.")
    return {k: deepcopy(value[k]) for k in ("projection", "position", "target", "up", "aspect", "zoom", "referenceZoom", "heading", "tilt", key)}


def validate_thumbnail(value):
    """Accept only small, fixed-size JPEG previews, never executable data URLs."""
    if not isinstance(value, str) or len(value) > 140000 or not re.fullmatch(r"data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}", value):
        raise ValueError("Choose a JPEG preview under 100 KB.")
    try:
        data = base64.b64decode(value[23:], validate=True)
    except (ValueError, binascii.Error) as error:
        raise ValueError("Invalid JPEG preview.") from error
    if not data.startswith(b"\xff\xd8") or not data.endswith(b"\xff\xd9"):
        raise ValueError("Invalid JPEG preview.")
    offset = 2
    while offset + 8 < len(data):
        if data[offset] != 255:
            break
        marker = data[offset + 1]
        size = int.from_bytes(data[offset + 2:offset + 4], "big")
        if size < 2 or offset + 2 + size > len(data):
            break
        if marker in (0xc0, 0xc1, 0xc2):
            if int.from_bytes(data[offset + 5:offset + 7], "big") == 400 and int.from_bytes(data[offset + 7:offset + 9], "big") == 640:
                return value
            break
        if marker == 0xda:
            break
        offset += 2 + size
    raise ValueError("Preview must be a 640 by 400 JPEG.")

def validate_markers(value):
    """Bounded, view-local control presentation. Coordinates are offsets, not geometry."""
    if not isinstance(value, dict) or len(set(value) - {"_defaults"}) > 128:
        raise ValueError("Use a device-marker settings object with at most 128 controls.")
    clean = {}
    for control_id, options in value.items():
        if ((control_id != "_defaults" and not valid_id(control_id)) or not isinstance(options, dict) or
                set(options) - {"visible", "show_label", "size", "placement", "offset"}):
            raise ValueError("Invalid device-marker settings.")
        if control_id == "_defaults" and "offset" in options:
            raise ValueError("View defaults cannot contain a position offset.")
        for key in ("visible", "show_label"):
            if key in options and not isinstance(options[key], bool):
                raise ValueError("Marker visibility and labels must be true or false.")
        if "size" in options and (not isinstance(options["size"], int) or isinstance(options["size"], bool) or not 24 <= options["size"] <= 64):
            raise ValueError("Marker size must be 24–64 pixels.")
        if "placement" in options and options["placement"] not in ("room", "tray"):
            raise ValueError("Choose room or tray for a device control.")
        if "offset" in options and (not isinstance(options["offset"], list) or len(options["offset"]) != 3 or
                any(not number(v) or abs(v) > 1000 for v in options["offset"])):
            raise ValueError("Marker offsets must be three finite values within 1000 metres.")
        clean[control_id] = deepcopy(options)
    return clean


def validate_component(value, model_ids):
    """Validate portable room views without accepting executable configuration."""
    if not isinstance(value, dict) or value.get("schemaVersion") != 1 or not valid_id(value.get("id")):
        raise ValueError("Use a version 1 component with a valid ID.")
    title = value.get("title")
    if not isinstance(title, str) or not title.strip() or len(title) > 160:
        raise ValueError("Give the component a name up to 160 characters.")
    layers = value.get("layers")
    if not isinstance(layers, list) or len(layers) != 1 or not isinstance(layers[0], dict):
        raise ValueError("This release supports one room per component.")
    layer = layers[0]
    if layer.get("model") not in model_ids:
        raise ValueError("Import the referenced room model first.")
    if layer.get("view") not in ("front", "floor"):
        raise ValueError("Choose perspective or floor view.")
    for key, minimum, maximum in (("heading", 0, 359.99), ("tilt", 0, 180), ("zoom", .01, 100)):
        if not number(layer.get(key)) or not minimum <= layer[key] <= maximum:
            raise ValueError(f"Invalid {key}.")
    height = value.get("height")
    if not isinstance(height, int) or isinstance(height, bool) or not 180 <= height <= 1600:
        raise ValueError("Height must be 180–1600 pixels.")
    if "show_title" in value and not isinstance(value["show_title"], bool):
        raise ValueError("Show title must be true or false.")
    clean_layer = {key: layer[key] for key in ("model", "view", "heading", "tilt", "zoom")}
    if "camera" in layer:
        clean_layer["camera"] = validate_camera_snapshot(layer["camera"], layer["view"])
    return {"schemaVersion": 1, "id": value["id"], "title": title.strip(), "height": height,
            **({"thumbnail": validate_thumbnail(value["thumbnail"])} if "thumbnail" in value else {}),
            **({"show_title": value["show_title"]} if "show_title" in value else {}),
            **({"markers": validate_markers(value["markers"])} if "markers" in value else {}),
            "layers": [clean_layer]}


def validate_glb(data, manifest):
    """Require glTF 2 with embedded resources and referenced control nodes."""
    if len(data) < 20 or data[:4] != b"glTF":
        raise ValueError("scene.glb must be a glTF 2 binary.")
    version, length, json_length, chunk = struct.unpack_from("<IIII", data, 4)
    if (
        version != 2
        or length != len(data)
        or chunk != 0x4E4F534A
        or 20 + json_length > length
    ):
        raise ValueError("Invalid GLB header or JSON length.")
    doc = json.loads(data[20 : 20 + json_length])
    if not isinstance(doc, dict):
        raise ValueError("Invalid glTF document.")
    for resource in doc.get("buffers", []) + doc.get("images", []):
        if resource.get("uri"):
            raise ValueError(
                "Embed textures and buffers; external URLs are not supported."
            )
    appearance_nodes = {n.get("extras", {}).get("appearanceId") for n in doc.get("nodes", [])}
    if any(p["id"] not in appearance_nodes for p in manifest.get("appearance", [])):
        raise ValueError("An architectural part references a missing scene node.")
    daylight_nodes = {n.get("extras", {}).get("daylightWindowId") for n in doc.get("nodes", [])}
    if any(w["nodeId"] not in daylight_nodes for w in manifest.get("daylight", {}).get("windows", [])):
        raise ValueError("A daylight window references a missing scene node.")
    nodes = {n.get("extras", {}).get("controlId") for n in doc.get("nodes", [])}
    for control in manifest["controls"]:
        if any(node not in nodes for node in control.get("nodeIds", [])):
            raise ValueError("A control references a missing scene node.")
        if control["type"] == "cover":
            for node_id in control.get("nodeIds", []):
                matches = [n for n in doc.get("nodes", []) if n.get("extras", {}).get("controlId") == node_id]
                hinges = [n for n in matches if "hingedDoor" in n.get("extras", {})]
                if hinges:
                    if len(matches) != 1:
                        raise ValueError("Hinged doors need unique scene roots.")
                    hinge = hinges[0]["extras"]["hingedDoor"]
                    if (not isinstance(hinge, dict) or hinge.get("axis") != "y"
                        or not all(number(hinge.get(k)) for k in ("closedAngle", "openAngle", "defaultPosition"))
                        or not 0 < abs(hinge["openAngle"] - hinge["closedAngle"]) <= math.pi
                        or hinge["defaultPosition"] != control.get("defaultPosition", 0)
                        or not hinges[0].get("children")):
                        raise ValueError("Invalid hinged door motion metadata.")
                slides = [n for n in matches if "slidingDoor" in n.get("extras", {})]
                if slides:
                    if len(matches) != 1 or hinges:
                        raise ValueError("Sliding doors need unique scene roots.")
                    slide = slides[0]["extras"]["slidingDoor"]
                    if (not isinstance(slide, dict) or slide.get("axis") != "x"
                        or not all(number(slide.get(k)) for k in ("closedOffset", "openOffset", "defaultPosition"))
                        or not 0 < abs(slide["openOffset"] - slide["closedOffset"]) <= 5
                        or slide["defaultPosition"] != control.get("defaultPosition", 0)
                        or not slides[0].get("children")):
                        raise ValueError("Invalid sliding door motion metadata.")
        if control["type"] == "number":
            for node_id in control["nodeIds"]:
                matches = [n for n in doc.get("nodes", []) if n.get("extras", {}).get("controlId") == node_id]
                if len(matches) != 1:
                    raise ValueError("Number controls need unique scene roots.")
                motion = matches[0].get("extras", {}).get("numberMotion", {})
                if (not isinstance(motion, dict) or not all(number(motion.get(k)) for k in ("min", "max", "restValue", "metersPerUnit", "defaultValue"))
                    or motion["metersPerUnit"] != .01
                    or motion["min"] != control["min"] or motion["max"] != control["max"]
                    or not motion["min"] <= motion["restValue"] <= motion["max"]
                    or motion["defaultValue"] != control["defaultValue"]):
                    raise ValueError("Invalid centimetre number motion metadata.")
                descendants = list(matches[0].get("children", [])); seen_parts = set(); parts = 0
                while descendants:
                    index = descendants.pop()
                    if not isinstance(index, int) or index in seen_parts or not 0 <= index < len(doc.get("nodes", [])):
                        raise ValueError("Invalid number motion hierarchy.")
                    seen_parts.add(index); child = doc["nodes"][index]
                    descendants.extend(child.get("children", []))
                    part = child.get("extras", {}).get("numberMotionPart")
                    if part is not None:
                        if (not isinstance(part, dict) or not number(part.get("baseY"))
                            or not number(part.get("factor")) or not 0 <= part["factor"] <= 1):
                            raise ValueError("Invalid number motion part.")
                        parts += 1
                if not parts:
                    raise ValueError("Number controls need moving scene parts.")


def compatible_entity(control, entity_id):
    """Light/switch mappings stay compatible; covers require cover entities."""
    return (
        isinstance(entity_id, str)
        and bool(ENTITY.fullmatch(entity_id))
        and (entity_id.split(".")[0] in ({"climate"} if control.get("type") == "climate" else {"button", "input_button", "script", "scene"} if control.get("type") == "button" else {"number", "input_number"} if control.get("type") == "number" else {"cover"} if control.get("type") == "cover" else {"light", "switch"}))
    )


def validate_bindings(bindings, manifest):
    controls = {c["id"]: c for c in manifest["controls"]}
    if not isinstance(bindings, dict) or any(
        key not in controls or not compatible_entity(controls[key], value)
        for key, value in bindings.items()
    ):
        raise ValueError(
            "Bindings must connect declared controls to matching light, switch, cover, climate or number entities."
        )
    return dict(bindings)


def extract_package(data, destination):
    """Extract only allowed regular files; enforce streamed expansion limits."""
    if len(data) > MAX_UPLOAD:
        raise ValueError("Upload exceeds 100 MB.")
    total, names = 0, set()
    with zipfile.ZipFile(BytesIO(data)) as archive:
        if len(archive.infolist()) > 2048:
            raise ValueError("Too many files in the model package.")
        for info in archive.infolist():
            name = info.filename
            if (
                not SAFE_FILE.fullmatch(name)
                or ".." in name
                or "\\" in name
                or name in names
                or info.is_dir()
                or stat.S_ISLNK(info.external_attr >> 16)
                or info.flag_bits & 1
            ):
                raise ValueError("Package contains an unsupported or unsafe path.")
            names.add(name)
            total += info.file_size
            if total > MAX_EXPANDED:
                raise ValueError("Expanded model exceeds 300 MB.")
            target = destination / name
            target.parent.mkdir(parents=True, exist_ok=True)
            actual = 0
            with archive.open(info) as source, target.open("wb") as output:
                while piece := source.read(1024 * 1024):
                    actual += len(piece)
                    if actual > info.file_size or actual > MAX_EXPANDED:
                        raise ValueError("Expanded file is too large.")
                    output.write(piece)
    raw_manifest = json.loads((destination / "manifest.json").read_text())
    if "house-placement.json" in names:
        placement = validate_placement(json.loads((destination / "house-placement.json").read_text()))
        if "housePlacement" in raw_manifest and validate_placement(raw_manifest["housePlacement"]) != placement:
            raise ValueError("The room and placement file disagree.")
        raw_manifest["housePlacement"] = placement
    manifest = validate_manifest(raw_manifest)
    validate_glb((destination / "scene.glb").read_bytes(), manifest)
    bindings = (
        validate_bindings(
            json.loads((destination / "bindings.json").read_text()), manifest
        )
        if "bindings.json" in names
        else {}
    )
    return manifest, bindings


class ModelStore:
    """Catalog writes commit atomically before old model files are removed.

    Caller serializes mutations with its asyncio lock; file work runs in an
    executor. A failed import or catalog write leaves the previous state intact.
    """

    def __init__(self, directory):
        self.directory = Path(directory)
        self.models = []
        self.components = []

    def open(self):
        (self.directory / "models").mkdir(parents=True, exist_ok=True)
        path = self.directory / "catalog.json"
        if path.exists():
            catalog = json.loads(path.read_text())
            if catalog.get("version") != 1:
                raise ValueError("Unsupported model catalog version.")
            models = []
            for model in catalog["models"]:
                manifest = validate_manifest(model)
                if not re.fullmatch(r"[a-f0-9]{32}", model.get("folder", "")):
                    raise ValueError("Invalid model folder.")
                models.append(
                    {
                        **manifest,
                        "folder": model["folder"],
                        "bindings": validate_bindings(model["bindings"], manifest),
                        "importedAt": model["importedAt"],
                        **({"areaId": model["areaId"]} if "areaId" in model else {}),
                    }
                )
            self.models = models
            self.components = catalog.get("components", [])
        return self

    def revision(self, model_id):
        return hashlib.sha256(self.find(model_id)["folder"].encode()).hexdigest()[:24]

    def catalog(self, floor_names=None):
        models = [
            {
                **{k: deepcopy(v) for k, v in m.items() if k != "folder"},
                "sceneRevision": self.revision(m["id"]),
            }
            for m in self.models
        ]

        if floor_names is not None:
            for model in models:
                for floor in model.get("housePlacement", {}).get("floors", []):
                    linked = floor.get("haFloorId")
                    if linked not in floor_names:
                        matches = [key for key,name in floor_names.items() if name.strip().casefold() == floor["name"].strip().casefold()]
                        linked = matches[0] if len(matches)==1 else None
                    if linked:
                        floor["haFloorId"] = linked
                        floor["name"] = floor_names[linked]
                    else:
                        floor.pop("haFloorId", None)
        models = [apply_light_groups(m) for m in models]
        views = house_models(models)
        return [*models, *views]

    def find(self, model_id):
        for model in self.models:
            if model["id"] == model_id:
                return model
        for model in house_models(self.catalog_real()):
            if model["id"] == model_id:
                return model
        raise ValueError("Model not found.")

    def catalog_real(self):
        return [apply_light_groups({**m, "sceneRevision": hashlib.sha256(m["folder"].encode()).hexdigest()[:24]}) for m in self.models]

    def save(self, models):
        temporary = self.directory / "catalog.json.tmp"
        with temporary.open("w") as output:
            json.dump({"version": 1, "models": models, "components": self.components}, output)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, self.directory / "catalog.json")
        self.models = models

    def update_room(self, model_id, settings):
        """Store local room identity without altering geometry or device bindings."""
        if not isinstance(settings, dict) or set(settings) - {"title", "areaId", "floorIds", "floorLinks", "appearance"}:
            raise ValueError("Unsupported room setting.")
        models = deepcopy(self.models)
        model = next((m for m in models if m["id"] == model_id), None)
        if model is None:
            raise ValueError("Model not found.")
        if "title" in settings:
            title = settings["title"]
            if not isinstance(title, str) or not title.strip() or len(title) > 160:
                raise ValueError("Give the room a name up to 160 characters.")
            model["title"] = title.strip()
        if "areaId" in settings:
            area_id = settings["areaId"]
            if not isinstance(area_id, str) or len(area_id) > 128:
                raise ValueError("Invalid Home Assistant area.")
            model["areaId"] = area_id
        if "appearance" in settings:
            parts = validate_appearance(settings["appearance"])
            known = {p["id"]: p["label"] for p in model.get("appearance", [])}
            if {p["id"]: p["label"] for p in parts} != known:
                raise ValueError("Change only declared architectural parts.")
            model["appearance"] = parts
        if "floorLinks" in settings:
            placement = model.get("housePlacement")
            if not placement:
                raise ValueError("Export this room from the web house builder before assigning house floors.")
            links = settings["floorLinks"]
            known = {f["id"] for f in placement["floors"]} if placement else set()
            if not isinstance(links,dict) or set(links)-known or any(not isinstance(v,str) or len(v)>128 for v in links.values()) or len([v for v in links.values() if v]) != len({v for v in links.values() if v}):
                raise ValueError("Invalid floor height mapping.")
            for member in models:
                if member.get("housePlacement",{}).get("houseId") == placement["houseId"]:
                    for floor in member["housePlacement"]["floors"]:
                        if floor["id"] in links:
                            if links[floor["id"]]: floor["haFloorId"] = links[floor["id"]]
                            else: floor.pop("haFloorId",None)
                    member["housePlacement"] = validate_placement(member["housePlacement"])
        if "floorIds" in settings:
            if "housePlacement" not in model:
                raise ValueError("Export this room from the web house builder before assigning house floors.")
            model["housePlacement"] = validate_placement({**model["housePlacement"], "floorIds": settings["floorIds"]})
        self.save(models)
        return {"title": model["title"], "areaId": model.get("areaId", ""), **({"appearance":deepcopy(model["appearance"])} if "appearance" in model else {}), **({"housePlacement": deepcopy(model["housePlacement"])} if "housePlacement" in model else {})}

    def set_device_visibility(self, model_id, control_id, hidden):
        """Room-only visibility, shared by all views and grouped device controls."""
        if not isinstance(hidden, bool):
            raise ValueError("Device hidden must be a boolean.")
        models = deepcopy(self.models)
        model = next((m for m in models if m["id"] == model_id), None)
        if model is None or control_id not in {c["id"] for c in model["controls"]}:
            raise ValueError("Choose a device in its source room.")
        ids = {control_id}
        for group in model.get("lightGroups", []):
            if control_id in group["controls"]:
                ids.update(group["controls"])
        for device in model.get("devices", []):
            members = {device["height"], device["motion"], *device["macros"]}
            if control_id in members:
                ids.update(members)
        for control in model["controls"]:
            if control["id"] in ids:
                if hidden:
                    control["hidden"] = True
                else:
                    control.pop("hidden", None)
        self.save(models)
        return {"controls": deepcopy(model["controls"])}

    def set_device_settings(self, model_id, device_id, names):
        models = deepcopy(self.models)
        model = next((m for m in models if m["id"] == model_id), None)
        if model is None:
            raise ValueError("Model not found.")
        settings = validate_device_settings({**model.get("deviceSettings", {}), device_id: {"macroNames": names}}, model.get("devices", []))
        model["deviceSettings"] = settings
        self.save(models)
        return {"deviceSettings": deepcopy(settings)}

    def put_component(self, value):
        component = validate_component(value, [m["id"] for m in [*self.models, *house_models(self.models)]])
        previous = self.components
        self.components = [c for c in previous if c["id"] != component["id"]] + [component]
        try:
            self.save(self.models)
        except Exception:
            self.components = previous
            raise
        return deepcopy(component)

    def remove_component(self, component_id):
        previous = self.components
        self.components = [c for c in previous if c["id"] != component_id]
        try:
            self.save(self.models)
        except Exception:
            self.components = previous
            raise
        return {"ok": True}

    def house_summary(self, house_id):
        rooms = [m for m in self.models if m.get("housePlacement", {}).get("houseId") == house_id]
        if not rooms:
            raise ValueError("House not found.")
        ids = {m["id"] for m in rooms}
        ids.update(v["id"] for v in house_models(rooms))
        views = [c for c in self.components if any(l["model"] in ids for l in c["layers"])]
        revision = hashlib.sha256(json.dumps([self.models, self.components], sort_keys=True).encode()).hexdigest()
        return {"houseId": house_id, "title": rooms[0]["housePlacement"]["houseName"],
                "rooms": [{"id": m["id"], "title": m["title"]} for m in rooms],
                "views": [c["title"] for c in views], "revision": revision}

    def remove_house(self, house_id, revision):
        summary = self.house_summary(house_id)
        if revision != summary["revision"]:
            raise ValueError("The library changed. Review this house again before deleting it.")
        removed = [m for m in self.models if m.get("housePlacement", {}).get("houseId") == house_id]
        ids = {m["id"] for m in removed} | {v["id"] for v in house_models(removed)}
        previous = self.components
        self.components = [c for c in previous if not any(l["model"] in ids for l in c["layers"])]
        try:
            self.save([m for m in self.models if m not in removed])
        except Exception:
            self.components = previous
            raise
        for model in removed:
            shutil.rmtree(self.directory / "models" / model["folder"], ignore_errors=True)
        return {"ok": True, "removedRooms": len(removed), "removedViews": len(previous) - len(self.components)}

    def replace_house(self, house_id, data, revision=None, preview=False):
        """Validate every room first; commit geometry, settings and views together."""
        summary = self.house_summary(house_id)
        if not preview and revision != summary["revision"]:
            raise ValueError("The library changed. Preview the replacement again.")
        if len(data) > MAX_UPLOAD:
            raise ValueError("Upload exceeds 100 MB.")
        with zipfile.ZipFile(BytesIO(data)) as archive:
            if "house-manifest.json" not in archive.namelist():
                raise ValueError("Choose a full-house ZIP exported for Home Assistant.")
        old = [m for m in self.models if m.get("housePlacement", {}).get("houseId") == house_id]
        others = [m for m in self.models if m not in old]
        by_room = {m["housePlacement"]["roomId"]: m for m in old}
        links = {f["id"]: f["haFloorId"] for m in old for f in m["housePlacement"]["floors"] if f.get("haFloorId")}
        stage = Path(tempfile.mkdtemp(prefix="replace-house-", dir=self.directory))
        moved = []
        previous_components = self.components
        try:
            incoming = ModelStore(stage).open()
            incoming.install_upload(data)
            pending = incoming.models
            matched = set()
            removed_bindings = []
            for model in pending:
                placement = model["housePlacement"]
                previous = by_room.get(placement["roomId"])
                placement["houseId"] = house_id
                for floor in placement["floors"]:
                    if floor["id"] in links:
                        floor["haFloorId"] = links[floor["id"]]
                if previous:
                    matched.add(previous["id"])
                    model["id"] = previous["id"]
                    model["title"] = previous["title"]
                    if "areaId" in previous:
                        model["areaId"] = previous["areaId"]
                    preserve_device_visibility(previous, model)
                    model["lightGroups"] = preserved_groups(previous, model["controls"])
                    controls = {c["id"]: c for c in model["controls"]}
                    kept_bindings = {k: v for k, v in previous["bindings"].items() if k in controls and compatible_entity(controls[k], v)}
                    removed_bindings.extend(f"{previous['title']}: {k}" for k in previous["bindings"] if k not in kept_bindings)
                    model["bindings"].update(kept_bindings)
                    visibility = {p["id"]: p["visible"] for p in previous.get("appearance", [])}
                    for part in model.get("appearance", []):
                        part["visible"] = visibility.get(part["id"], part["visible"])
                    if "daylight" in model and "daylight" in previous:
                        model["daylight"].update({k: previous["daylight"][k] for k in ("mode", "entity")})
                    settings = {}
                    for device in model.get("devices", []):
                        names = previous.get("deviceSettings", {}).get(device["id"], {}).get("macroNames", {})
                        settings[device["id"]] = {"macroNames": {k: v for k, v in names.items() if k in device["macros"]}}
                    if settings:
                        model["deviceSettings"] = validate_device_settings(settings, model["devices"])
            combined = others + pending
            ids = [m["id"] for m in combined]
            if len(ids) != len(set(ids)):
                raise ValueError("A replacement room conflicts with another room in your library.")
            valid_ids = set(ids) | {v["id"] for v in house_models(combined)}
            affected_ids = {m["id"] for m in old} | {v["id"] for v in house_models(old)}
            removed_views = [c for c in self.components if any(l["model"] in affected_ids and l["model"] not in valid_ids for l in c["layers"])]
            result = {**summary, "incomingRooms": [{"id": m["id"], "title": m["title"]} for m in pending],
                      "keptRooms": len(matched), "removedBindings": removed_bindings, "removedRooms": [m["title"] for m in old if m["id"] not in matched],
                      "removedViews": [c["title"] for c in removed_views], "viewId": "h-" + house_id}
            if preview:
                return result
            for model in pending:
                target = self.directory / "models" / model["folder"]
                os.replace(stage / "models" / model["folder"], target)
                moved.append(target)
            self.components = [c for c in self.components if c not in removed_views]
            self.save(combined)
        except Exception:
            self.components = previous_components
            for target in moved:
                shutil.rmtree(target, ignore_errors=True)
            raise
        finally:
            shutil.rmtree(stage, ignore_errors=True)
        for model in old:
            shutil.rmtree(self.directory / "models" / model["folder"], ignore_errors=True)
        return result

    def install_upload(self, data):
        """Accept a room or an atomic full-house package at the same endpoint."""
        if len(data) > MAX_UPLOAD:
            raise ValueError("Upload exceeds 100 MB.")
        with zipfile.ZipFile(BytesIO(data)) as archive:
            if "house-manifest.json" not in archive.namelist():
                return self.install(data)
            infos = archive.infolist()
            if len(infos) > 51 or len({i.filename for i in infos}) != len(infos):
                raise ValueError("Invalid house package file count.")
            if any(i.is_dir() or stat.S_ISLNK(i.external_attr >> 16) or i.flag_bits & 1 for i in infos):
                raise ValueError("House package contains unsupported entries.")
            if sum(i.file_size for i in infos) > MAX_EXPANDED:
                raise ValueError("Expanded house exceeds 300 MB.")
            if archive.getinfo("house-manifest.json").file_size > 65536:
                raise ValueError("House manifest is too large.")
            house = json.loads(archive.read("house-manifest.json"))
            if not isinstance(house, dict) or house.get("format") != "three-d-rooms-house/1":
                raise ValueError("Unsupported house package format.")
            rooms = house.get("rooms")
            if not isinstance(rooms, list) or not 1 <= len(rooms) <= 50 or not all(isinstance(p, str) and re.fullmatch(r"rooms/[a-z0-9_-]+\.zip", p) for p in rooms) or len(set(rooms)) != len(rooms):
                raise ValueError("Provide 1–50 unique room packages.")
            if set(archive.namelist()) != {"house-manifest.json", *rooms}:
                raise ValueError("House package contains unexpected or missing files.")
            stage = Path(tempfile.mkdtemp(prefix="house-", dir=self.directory))
            installed = []
            pending = []
            seen = {m["id"] for m in self.models}
            room_ids = {m["housePlacement"]["roomId"] for m in self.models if m.get("housePlacement", {}).get("houseId") == house.get("houseId")}
            floors = None
            expanded = 0
            try:
                for index, path in enumerate(rooms):
                    payload = archive.read(path)
                    with zipfile.ZipFile(BytesIO(payload)) as inner:
                        expanded += sum(i.file_size for i in inner.infolist())
                    if expanded > MAX_EXPANDED:
                        raise ValueError("Expanded house exceeds 300 MB.")
                    destination = stage / str(index)
                    destination.mkdir()
                    manifest, bindings = extract_package(payload, destination)
                    placement = manifest.get("housePlacement", {})
                    if placement.get("houseId") != house.get("houseId") or placement.get("houseName") != house.get("houseName") or not placement.get("roomId"):
                        raise ValueError("Every room must belong to this house.")
                    if manifest["id"] in seen or placement["roomId"] in room_ids:
                        raise ValueError("A room already exists or is duplicated. No rooms were imported.")
                    if floors is not None and floors != placement["floors"]:
                        raise ValueError("House rooms must share the same floor definitions.")
                    floors = placement["floors"]
                    seen.add(manifest["id"])
                    room_ids.add(placement["roomId"])
                    folder = uuid4().hex
                    pending.append({**manifest, "bindings": bindings, "folder": folder, "importedAt": datetime.now(timezone.utc).isoformat()})
                for index, model in enumerate(pending):
                    target = self.directory / "models" / model["folder"]
                    os.replace(stage / str(index), target)
                    installed.append(target)
                self.save([*self.models, *pending])
                return {"id": pending[0]["id"], "ids": [m["id"] for m in pending], "houseId": house["houseId"], "roomCount": len(pending), "viewId": "h-" + house["houseId"]}
            except Exception:
                for target in installed:
                    shutil.rmtree(target, ignore_errors=True)
                raise
            finally:
                shutil.rmtree(stage, ignore_errors=True)

    def install(self, data):
        stage = Path(tempfile.mkdtemp(prefix="import-", dir=self.directory))
        installed = None
        try:
            manifest, bindings = extract_package(data, stage)
            if any(m["id"] == manifest["id"] for m in self.models):
                raise ValueError(
                    "A model with this ID already exists. Use a different stable model ID."
                )
            folder = uuid4().hex
            model = {
                **manifest,
                "bindings": bindings,
                "folder": folder,
                "importedAt": datetime.now(timezone.utc).isoformat(),
            }
            installed = self.directory / "models" / folder
            os.replace(stage, installed)
            self.save([*self.models, model])
            return {"id": model["id"]}
        except Exception:
            if installed is not None:
                shutil.rmtree(installed, ignore_errors=True)
            raise
        finally:
            shutil.rmtree(stage, ignore_errors=True)

    def replace(self, model_id, data):
        """Swap a room's geometry and controls while keeping its local setup.

        The room keeps its ID (so saved views and dashboards still resolve),
        name, area and daylight mode. Mappings survive for controls that still
        exist with a compatible type; the commit is atomic like ``install``.
        """
        stage = Path(tempfile.mkdtemp(prefix="import-", dir=self.directory))
        installed = None
        try:
            manifest, package_bindings = extract_package(data, stage)
            models = deepcopy(self.models)
            index = next((i for i, m in enumerate(models) if m["id"] == model_id), None)
            if index is None:
                raise ValueError("Model not found.")
            previous = models[index]
            manifest = {**manifest, "id": model_id, "title": previous["title"]}
            if "housePlacement" not in manifest and "housePlacement" in previous:
                manifest["housePlacement"] = deepcopy(previous["housePlacement"])
            elif manifest.get("housePlacement", {}).get("houseId") == previous.get("housePlacement", {}).get("houseId") and "housePlacement" in previous:
                ids = {f["id"] for f in manifest["housePlacement"]["floors"]}
                manifest["housePlacement"]["floorIds"] = [f for f in previous["housePlacement"]["floorIds"] if f in ids]
                links = {f["id"]:f["haFloorId"] for f in previous["housePlacement"]["floors"] if f.get("haFloorId")}
                for floor in manifest["housePlacement"]["floors"]:
                    if floor["id"] in links: floor["haFloorId"] = links[floor["id"]]

            previous_parts = {p["id"]:p["visible"] for p in previous.get("appearance", [])}
            for part in manifest.get("appearance", []):
                part["visible"] = previous_parts.get(part["id"], part["visible"])
            if "daylight" in manifest and "daylight" in previous:
                manifest["daylight"] = validate_daylight(
                    {
                        **manifest["daylight"],
                        "mode": previous["daylight"]["mode"],
                        "entity": previous["daylight"]["entity"],
                    },
                    manifest["controls"],
                )
            manifest["lightGroups"] = preserved_groups(previous, manifest["controls"])
            settings = {}
            for device in manifest.get("devices", []):
                names = previous.get("deviceSettings", {}).get(device["id"], {}).get("macroNames", {})
                settings[device["id"]] = {"macroNames": {key: name for key, name in names.items() if key in device["macros"]}}
            if settings:
                manifest["deviceSettings"] = validate_device_settings(settings, manifest["devices"])
            preserve_device_visibility(previous, manifest)
            controls = {c["id"]: c for c in manifest["controls"]}
            bindings = {
                control_id: entity_id
                for control_id, entity_id in previous["bindings"].items()
                if control_id in controls and compatible_entity(controls[control_id], entity_id)
            }
            removed = sorted(set(previous["bindings"]) - set(bindings))
            for control_id, entity_id in package_bindings.items():
                bindings.setdefault(control_id, entity_id)
            folder = uuid4().hex
            models[index] = {
                **manifest,
                "bindings": bindings,
                "folder": folder,
                "importedAt": datetime.now(timezone.utc).isoformat(),
                **({"areaId": previous["areaId"]} if "areaId" in previous else {}),
            }
            installed = self.directory / "models" / folder
            os.replace(stage, installed)
            self.save(models)
            shutil.rmtree(self.directory / "models" / previous["folder"], ignore_errors=True)
            return {
                "id": model_id,
                "keptBindings": len(bindings),
                "removedBindings": removed,
                "unmappedControls": [c["id"] for c in manifest["controls"] if c["id"] not in bindings],
            }
        except Exception:
            if installed is not None:
                shutil.rmtree(installed, ignore_errors=True)
            raise
        finally:
            shutil.rmtree(stage, ignore_errors=True)

    def set_daylight(self, model_id, settings):
        models = deepcopy(self.models)
        model = next((m for m in models if m["id"] == model_id), None)
        if model is None:
            # A house/floor view saves its time of day to every daylight room it shows.
            view = next((v for v in house_models(self.catalog_real()) if v["id"] == model_id), None)
            if view is None or "daylight" not in view:
                raise ValueError("This model has no daylight windows. Import a daylight-ready export.")
            members = {member["model"] for member in view["members"]}
            rooms = [m for m in models if m["id"] in members and "daylight" in m]
            for room in rooms:
                room["daylight"] = validate_daylight(
                    {**room["daylight"], "mode": settings.get("mode"), "entity": settings.get("entity")},
                    room["controls"],
                )
            self.save(models)
            return {"daylight": {**deepcopy(view["daylight"]), "mode": settings.get("mode"), "entity": settings.get("entity")}}
        if "daylight" not in model:
            raise ValueError("This model has no daylight windows. Import a daylight-ready export.")
        value = {**model["daylight"], "mode": settings.get("mode"), "entity": settings.get("entity")}
        model["daylight"] = validate_daylight(value, model["controls"])
        self.save(models)
        return {"daylight": deepcopy(value)}

    def set_light_groups(self, model_id, groups):
        models = deepcopy(self.models)
        model = next((m for m in models if m["id"] == model_id), None)
        if model is None:
            raise ValueError("Choose an individual room to group its lights.")
        model["lightGroups"] = validate_light_groups(groups, model["controls"])
        self.save(models)
        return {"lightGroups": deepcopy(model["lightGroups"])}

    def bind(self, model_id, control_id, entity_id):
        models = deepcopy(self.models)
        model = next((m for m in models if m["id"] == model_id), None)
        if model is None or control_id not in {c["id"] for c in model["controls"]}:
            raise ValueError("Unknown model control.")
        group = next((g for g in model.get("lightGroups", []) if control_id in g["controls"]), None)
        if group:
            group["entityId"] = entity_id
            validate_light_groups(model["lightGroups"], model["controls"])
            self.save(models)
            return {"bindings": apply_light_groups(model)["bindings"]}
        if entity_id:
            control = next(c for c in model["controls"] if c["id"] == control_id)
            if not compatible_entity(control, entity_id):
                raise ValueError("Choose an entity matching the control type.")
            model["bindings"][control_id] = entity_id
        else:
            model["bindings"].pop(control_id, None)
        self.save(models)
        return {"bindings": deepcopy(model["bindings"])}

    def remove(self, model_id):
        model = self.find(model_id)
        if model.get("houseView"):
            raise ValueError("Remove or replace the individual rooms to change this house.")
        self.save([m for m in self.models if m["id"] != model_id])
        shutil.rmtree(self.directory / "models" / model["folder"], ignore_errors=True)
        return {"ok": True}

    def scene_path(self, model_id):
        model = self.find(model_id)
        if model.get("houseView"):
            raise ValueError("Load the individual room assets for this house.")
        return self.directory / "models" / model["folder"] / "scene.glb"

    def scene_bytes(self, model_id, compressed=False):
        """Cache a compressed derivative, keeping the original GLB untouched."""
        path = self.scene_path(model_id)
        if not compressed:
            return path.read_bytes()
        cached = path.with_suffix(".glb.gz")
        if not cached.exists():
            data = gzip.compress(path.read_bytes(), compresslevel=4, mtime=0)
            try:
                temporary = cached.with_suffix(".gz.tmp")
                temporary.write_bytes(data)
                os.replace(temporary, cached)
            except OSError:
                return data
        return cached.read_bytes()

    def export(self, model_id):
        model = self.find(model_id)
        if model.get("houseView"):
            raise ValueError("Export the individual rooms to preserve their identities.")
        output = BytesIO()
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as archive:
            archive.writestr("manifest.json", json.dumps(validate_manifest(model)))
            archive.writestr("bindings.json", json.dumps(model["bindings"]))
            if "housePlacement" in model:
                archive.writestr("house-placement.json", json.dumps(model["housePlacement"]))
            archive.write(self.scene_path(model_id), "scene.glb")
        return output.getvalue()
