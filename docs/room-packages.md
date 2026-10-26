# Preparing a room package

3D Rooms imports prepared ZIP packages. You can use an editable scene reconstructed with [Wes Bos’s 3D Model Anything](https://github.com/wesbos/3d-model-anything), or create your own model independently.

For an AI-assisted candidate inventory and preparation workflow, use the [Room to Home Assistant skill](../skills/room-to-home-assistant/SKILL.md). It distinguishes assessment-only requests from changes to the model.

## Files

Put these files at the ZIP’s root, without an enclosing folder:

```text
my-room.zip
├── manifest.json
└── scene.glb
```

`scene.glb` must be a glTF 2.0 binary with embedded geometry and textures. Use meters and Y up. External resource URLs are not supported. An optional `bindings.json` can carry compatible entity mappings in a room export; it is not required for a new room.

## Minimal light example

Create a fixture node or group in your GLB and give it glTF extras:

```json
{ "controlId": "ceiling-fixture" }
```

This is custom node metadata, not just the node’s display name. Reference that ID in `manifest.json`:

```json
{
  "schemaVersion": 1,
  "id": "my-room",
  "title": "My room",
  "units": "meters",
  "up": "Y",
  "scene": "scene.glb",
  "ambient": 0.22,
  "controls": [
    {
      "id": "ceiling",
      "type": "light",
      "label": "Ceiling light",
      "position": [0, 2.3, 0],
      "nodeIds": ["ceiling-fixture"],
      "capabilities": ["on_off", "brightness", "color", "color_temp"]
    }
  ]
}
```

Set the control’s world-space position to the actual fixture location. Keep control IDs stable when updating a room so compatible entity mappings can be retained. Capabilities should match the controls you intend to expose; Home Assistant also checks what the mapped entity supports.

ZIP the files, open **3D Rooms → Import room**, then use the device’s settings cog to assign its entity. For an existing room, use **Settings → Replace room model** to retain its identity, saved views and compatible mappings.

Movable shades, adjustable desks and daylight require their additional scene metadata; declaring a control alone does not create the corresponding animation or window lighting. See the [adjustable desk specification](adjustable-desk.md) for that device’s contract.

## Size and privacy

Keep the upload under 100 MB compressed and 300 MB expanded, with at most 2048 files and 200 controls. Use ZIP compression and share duplicate geometry or textures where practical. Include the prepared scene rather than original capture photos, depth frames or scanning-session files.

[Back to the README](../README.md)
