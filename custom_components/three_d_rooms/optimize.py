"""Lighter derived scene files. The uploaded scene.glb is never modified.

The server variant only touches textures: identical images are stored once,
large ones are downscaled and re-encoded as WebP (EXT_texture_webp). Geometry,
nodes, extras and every other byte keep their meaning. Pillow ships with Home
Assistant, so HACS users need no extra dependency.
"""

from hashlib import sha256
from io import BytesIO
import json
import struct

# Bump when the output of optimize_glb changes so stored variants are rebuilt.
SERVER_VERSION = 1
# Longest texture edge per variant: desktop keeps detail, phones keep memory low.
VARIANTS = {"full": 2048, "phone": 512}
# Height/normal data is sensitive to lossy artifacts.
PRECISE_SLOTS = ("normalTexture", "bumpTexture")
BASISU = "KHR_texture_basisu"
# Required extensions the bundled card can decode in a browser-optimized copy.
DECODABLE = {
    "EXT_meshopt_compression",
    "EXT_texture_webp",
    "KHR_mesh_quantization",
    "KHR_texture_basisu",
    "KHR_texture_transform",
    "KHR_materials_unlit",
    "KHR_materials_emissive_strength",
}
WEBP = "EXT_texture_webp"


def node_metadata(doc):
    """Ordered node names and extras: everything rooms, controls and doors rely on."""
    return sorted(
        json.dumps([node.get("name"), node.get("extras")], sort_keys=True)
        for node in doc.get("nodes", [])
        if node.get("extras")
    )


def read_glb(data):
    if len(data) < 20 or data[:4] != b"glTF":
        raise ValueError("scene.glb must be a glTF 2 binary.")
    version, length = struct.unpack_from("<II", data, 4)
    if version != 2 or length != len(data):
        raise ValueError("Invalid GLB header.")
    json_length, json_type = struct.unpack_from("<II", data, 12)
    if json_type != 0x4E4F534A:
        raise ValueError("Invalid GLB JSON chunk.")
    doc = json.loads(data[20 : 20 + json_length])
    offset = 20 + json_length
    binary = b""
    if offset + 8 <= len(data):
        bin_length, bin_type = struct.unpack_from("<II", data, offset)
        if bin_type == 0x004E4942:
            binary = data[offset + 8 : offset + 8 + bin_length]
    return doc, binary


def write_glb(doc, binary):
    text = json.dumps(doc, separators=(",", ":")).encode()
    text += b" " * (-len(text) % 4)
    binary += b"\0" * (-len(binary) % 4)
    chunks = struct.pack("<II", len(text), 0x4E4F534A) + text
    if binary:
        chunks += struct.pack("<II", len(binary), 0x004E4942) + binary
    return b"glTF" + struct.pack("<II", 2, 12 + len(chunks)) + chunks


def texture_sources(texture):
    """(holder, key) pairs naming image indices in a texture and its extensions."""
    pairs = [(texture, "source")] if "source" in texture else []
    for extension in texture.get("extensions", {}).values():
        if isinstance(extension, dict) and "source" in extension:
            pairs.append((extension, "source"))
    return pairs


def precise_textures(doc):
    found = set()

    def visit(value, key=None):
        if isinstance(value, dict):
            if key in PRECISE_SLOTS and isinstance(value.get("index"), int):
                found.add(value["index"])
            for k, v in value.items():
                visit(v, k)
        elif isinstance(value, list):
            for v in value:
                visit(v, key)

    visit(doc.get("materials", []))
    return found


def remap_buffer_views(value, mapping):
    """Rewrite every bufferView reference, including those inside extensions."""
    if isinstance(value, dict):
        for key, item in value.items():
            if key == "bufferView" and isinstance(item, int):
                value[key] = mapping[item]
            else:
                remap_buffer_views(item, mapping)
    elif isinstance(value, list):
        for item in value:
            remap_buffer_views(item, mapping)


def encode_image(data, max_edge, precise):
    """WebP bytes, or None to keep the original image unchanged."""
    from PIL import Image

    with Image.open(BytesIO(data)) as source:
        image = source
        image.load()
        width, height = image.size
        resized = max(width, height) > max_edge
        if resized:
            scale = max_edge / max(width, height)
            size = (max(1, round(width * scale)), max(1, round(height * scale)))
            if image.mode not in ("RGB", "RGBA", "L", "LA"):
                image = image.convert("RGBA" if "A" in image.getbands() or "transparency" in image.info else "RGB")
            image = image.resize(size, Image.Resampling.LANCZOS)
        alpha = "A" in image.getbands() or "transparency" in image.info
        image = image.convert("RGBA" if alpha else "RGB")
        output = BytesIO()
        image.save(output, "WEBP", quality=95 if precise else 82, method=4, exact=alpha)
        encoded = output.getvalue()
    return encoded if resized or len(encoded) < len(data) else None


def optimize_glb(data, max_edge):
    """Return a lighter GLB with shared, capped, WebP textures."""
    doc, binary = read_glb(data)
    images = doc.get("images", [])
    textures = doc.get("textures", [])
    views = doc.get("bufferViews", [])
    if not images:
        return data
    original_image_views = {image["bufferView"] for image in images if "bufferView" in image}

    def view_bytes(index):
        view = views[index]
        start = view.get("byteOffset", 0)
        return binary[start : start + view["byteLength"]]

    # 1. Share identical images.
    first = {}
    image_map = {}
    for index, image in enumerate(images):
        if "bufferView" not in image or views[image["bufferView"]].get("buffer", 0) != 0:
            image_map[index] = index
            continue
        digest = sha256(view_bytes(image["bufferView"])).digest()
        image_map[index] = first.setdefault(digest, index)
    for texture in textures:
        for holder, key in texture_sources(texture):
            holder[key] = image_map[holder[key]]
    kept = sorted(set(image_map.values()))
    renumber = {old: new for new, old in enumerate(kept)}
    for texture in textures:
        for holder, key in texture_sources(texture):
            holder[key] = renumber[holder[key]]
    images = [images[i] for i in kept]
    doc["images"] = images

    # 2. Re-encode embedded raster images (KTX2 is already GPU-compressed).
    precise_images = set()
    for index in precise_textures(doc):
        if 0 <= index < len(textures):
            precise_images.update(h[k] for h, k in texture_sources(textures[index]))
    replaced = {}
    for index, image in enumerate(images):
        if "bufferView" not in image or image.get("mimeType") not in ("image/png", "image/jpeg", "image/webp"):
            continue
        if views[image["bufferView"]].get("buffer", 0) != 0:
            continue
        try:
            encoded = encode_image(view_bytes(image["bufferView"]), max_edge, index in precise_images)
        except Exception:  # noqa: BLE001 - an unreadable image stays as uploaded
            encoded = None
        if encoded is not None:
            replaced[index] = encoded
            image["mimeType"] = "image/webp"

    # Textures whose image is now WebP use EXT_texture_webp (required: no fallback copy).
    webp_used = False
    for texture in textures:
        source = texture.get("source")
        if source is not None and images[source].get("mimeType") == "image/webp":
            texture.pop("source")
            texture.setdefault("extensions", {})[WEBP] = {"source": source}
            webp_used = True
        elif WEBP in texture.get("extensions", {}):
            webp_used = True
    if webp_used:
        for key in ("extensionsUsed", "extensionsRequired"):
            if WEBP not in doc.setdefault(key, []):
                doc[key].append(WEBP)

    # 3. Rebuild the binary chunk. Exporters often let views share bytes, so keep
    # the original ranges (merged where they overlap) and swap only image bytes.
    image_views = {image["bufferView"]: i for i, image in enumerate(images) if "bufferView" in image}
    mapping = {}
    keep = []
    for index, view in enumerate(views):
        if index in original_image_views and index not in image_views:
            continue  # bytes of a duplicate image
        mapping[index] = index
        if view.get("buffer", 0) == 0 and image_views.get(index) not in replaced:
            start = view.get("byteOffset", 0)
            keep.append((start, start + view["byteLength"]))
    merged = []
    for start, end in sorted(keep):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    output = bytearray()
    moved = []  # (old start, old end, new start)
    for start, end in merged:
        # Keep each range's offset modulo 4 so accessor alignment is unchanged.
        output.extend(b"\0" * ((start - len(output)) % 4))
        moved.append((start, end, len(output)))
        output.extend(binary[start:end])
    new_views = []
    for index, view in enumerate(views):
        if index not in mapping:
            continue
        mapping[index] = len(new_views)
        if view.get("buffer", 0) != 0:
            new_views.append(view)
        elif image_views.get(index) in replaced:
            chunk = replaced[image_views[index]]
            output.extend(b"\0" * (-len(output) % 4))
            new_views.append({**view, "byteOffset": len(output), "byteLength": len(chunk)})
            output.extend(chunk)
        else:
            start = view.get("byteOffset", 0)
            base = next(new + start - old for old, end, new in moved if old <= start < end or (old == start == end))
            new_views.append({**view, "byteOffset": base})
    doc["bufferViews"] = new_views
    for key, value in doc.items():
        if key != "bufferViews":
            remap_buffer_views(value, mapping)
    if doc.get("buffers"):
        doc["buffers"][0]["byteLength"] = len(output) + (-len(output) % 4)
    return write_glb(doc, bytes(output))
