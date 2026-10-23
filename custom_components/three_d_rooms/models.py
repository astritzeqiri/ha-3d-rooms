"""Bounded, embedded-only model packages and transactional local storage.

This module has no Home Assistant dependencies so archive validation can be
exercised independently of the running server.
"""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from io import BytesIO
import json
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

MAX_UPLOAD = 100 * 1024 * 1024
MAX_EXPANDED = 300 * 1024 * 1024
ID = re.compile(r"[a-z0-9][a-z0-9_-]{0,79}\Z")
ENTITY = re.compile(r"(?:light|switch)\.[a-z0-9_]+\Z")
SAFE_FILE = re.compile(
    r"(?:manifest\.json|bindings\.json|scene\.glb|thumbnail\.(?:png|jpg|webp)|textures/[a-zA-Z0-9_./-]+)\Z"
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
        raise ValueError("Provide up to 200 light controls.")
    seen = set()
    for c in controls:
        if not isinstance(c, dict) or not valid_id(c.get("id")) or c["id"] in seen:
            raise ValueError("Every light needs a unique stable ID.")
        seen.add(c["id"])
        if (
            c.get("type") != "light"
            or not isinstance(c.get("label"), str)
            or not c["label"].strip()
            or len(c["label"]) > 160
        ):
            raise ValueError("Every control must be a labeled light.")
        if not vector(c.get("position")):
            raise ValueError("Every light needs a position in meters.")
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
        caps = c.get("capabilities")
        if (
            not isinstance(caps, list)
            or "on_off" not in caps
            or any(
                v not in ("on_off", "brightness", "color", "color_temp") for v in caps
            )
        ):
            raise ValueError("Unsupported light capabilities.")
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
    return {
        k: deepcopy(v)
        for k, v in m.items()
        if k
        in (
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
        )
    }


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
    for key, minimum, maximum in (("heading", 0, 359), ("tilt", 0, 35), ("zoom", .5, 3)):
        if not number(layer.get(key)) or not minimum <= layer[key] <= maximum:
            raise ValueError(f"Invalid {key}.")
    height = value.get("height")
    if not isinstance(height, int) or isinstance(height, bool) or not 180 <= height <= 1600:
        raise ValueError("Height must be 180–1600 pixels.")
    return {"schemaVersion": 1, "id": value["id"], "title": title.strip(), "height": height,
            "layers": [{key: layer[key] for key in ("model", "view", "heading", "tilt", "zoom")}]}


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
    nodes = {n.get("extras", {}).get("controlId") for n in doc.get("nodes", [])}
    for control in manifest["controls"]:
        if any(node not in nodes for node in control.get("nodeIds", [])):
            raise ValueError("A light references a missing scene node.")


def validate_bindings(bindings, manifest):
    if not isinstance(bindings, dict) or any(
        key not in {c["id"] for c in manifest["controls"]}
        or not isinstance(value, str)
        or not ENTITY.fullmatch(value)
        for key, value in bindings.items()
    ):
        raise ValueError(
            "Bindings must connect declared controls to light or switch entities."
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
    manifest = validate_manifest(
        json.loads((destination / "manifest.json").read_text())
    )
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
                    }
                )
            self.models = models
            self.components = catalog.get("components", [])
        return self

    def revision(self, model_id):
        return hashlib.sha256(self.find(model_id)["folder"].encode()).hexdigest()[:24]

    def catalog(self):
        return [
            {
                **{k: deepcopy(v) for k, v in m.items() if k != "folder"},
                "sceneRevision": self.revision(m["id"]),
            }
            for m in self.models
        ]

    def find(self, model_id):
        for model in self.models:
            if model["id"] == model_id:
                return model
        raise ValueError("Model not found.")

    def save(self, models):
        temporary = self.directory / "catalog.json.tmp"
        with temporary.open("w") as output:
            json.dump({"version": 1, "models": models, "components": self.components}, output)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, self.directory / "catalog.json")
        self.models = models

    def put_component(self, value):
        component = validate_component(value, [m["id"] for m in self.models])
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

    def bind(self, model_id, control_id, entity_id):
        models = deepcopy(self.models)
        model = next((m for m in models if m["id"] == model_id), None)
        if model is None or control_id not in {c["id"] for c in model["controls"]}:
            raise ValueError("Unknown model control.")
        if entity_id:
            if not ENTITY.fullmatch(entity_id):
                raise ValueError("Choose a light or switch entity.")
            model["bindings"][control_id] = entity_id
        else:
            model["bindings"].pop(control_id, None)
        self.save(models)
        return {"bindings": deepcopy(model["bindings"])}

    def remove(self, model_id):
        model = self.find(model_id)
        self.save([m for m in self.models if m["id"] != model_id])
        shutil.rmtree(self.directory / "models" / model["folder"], ignore_errors=True)
        return {"ok": True}

    def scene_path(self, model_id):
        return self.directory / "models" / self.find(model_id)["folder"] / "scene.glb"

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
        output = BytesIO()
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as archive:
            archive.writestr("manifest.json", json.dumps(validate_manifest(model)))
            archive.writestr("bindings.json", json.dumps(model["bindings"]))
            archive.write(self.scene_path(model_id), "scene.glb")
        return output.getvalue()
