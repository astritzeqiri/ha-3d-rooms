# 3D Rooms control contract

This describes the implemented light and roller-shade contract established in 0.9.0. Inspect the target source for later additions; do not pin a deployment to that version.

## Sources to inspect

Relative to the original authoring repository:

- `packages/room-runtime/types.ts`: `BuiltRoom`, optional `covers`, and light/cover interfaces.
- `packages/room-runtime/roller-shade.ts`: slat/rail geometry, clipping, control ID and rest metadata.
- `packages/room-runtime/room-lighting.ts`: local light/fixture behavior.
- `packages/room-runtime/batch.ts`: `userData.noMerge` preserves motion groups.
- `apps/room-viewer/src/cover-controls.ts`: independent local controls and browser persistence.
- `apps/room-viewer/src/object-export.ts`: fresh build, hidden-object removal, control declarations and embedded GLB export.

Relative to the target integration repository:

- `custom_components/three_d_rooms/models.py`: manifest/GLB/binding validators and persistent storage. Validation does not require an HA installation.
- `custom_components/three_d_rooms/api.py`: authenticated state, type-matched bindings, mapped-only commands, feature gating and caller context.
- `rooms-app/shared/cover.mjs` and `light.mjs`: entity features, reported state and motion/lighting helpers.
- `rooms-app/web/scene.js`: GLB `controlId` lookup, physical fixture picking and state rendering.
- `rooms-app/web/main.js`: typed entity filtering, mapping choices, supported controls and local preview.
- `rooms-app/dashboard/card.js` and `panel.js`: native HA cover dialog, keyboard access and cover state propagation.
- `rooms-app/server/manifest.mjs`: corresponding legacy/development validation and command dispatch.

Read applicable `AGENTS.md` before edits. Source changes must be rebuilt into the packaged frontend; do not edit generated bundles directly. Existing uploads and IDs are compatibility requirements.

## ZIP and manifest

ZIP root: `manifest.json` and `scene.glb`; embed images/buffers, use meters and Y up. `schemaVersion: 1` is the model schema, independent of application version. Use stable lowercase IDs accepted by the target validator. Camera position and target use world coordinates.

Example control declarations (inside a complete manifest):

```json
{
  "controls": [
    {
      "id": "ceiling-light",
      "label": "Ceiling light",
      "type": "light",
      "position": [0, 2.4, 0],
      "intensity": 12,
      "color": "#fff0d4",
      "capabilities": ["on_off", "brightness", "color", "color_temp"],
      "nodeIds": ["ceiling-fixture"]
    },
    {
      "id": "window-shade-right",
      "label": "Right roller shade",
      "type": "cover",
      "position": [0.3, 2.2, 1.7],
      "defaultPosition": 35,
      "capabilities": ["open_close", "position", "stop"],
      "nodeIds": ["window-shade-right"]
    }
  ]
}
```

Positions above are illustrative; measure the actual model. `nodeIds` resolve to GLB `extras.controlId`, not glTF array indices or display names. Stable light ID and fixture node ID may differ. Existing light declarations without fixture nodes can retain marker-only behavior, but attach new modeled fixtures when geometry is available. Omit controls for objects removed from a cleaned export.

## Light behavior

A light's visible fixture may comprise multiple meshes; tag their shared root with its fixture `controlId`. Keep emission changes tied to the correct fixture, plus actual scene illumination. Preserve enough ambient visibility when lights are off. Advertised capabilities describe the model/UI; the mapped HA entity's supported features determine which commands may be sent. A switch provides on/off, not brightness or RGB. Never infer an HA entity ID from a mesh name.

## Roller-shade motion

Each shade root carries:

```json
{
  "controlId": "window-shade-right",
  "noMerge": true,
  "rollerShade": {"top": 1.2, "height": 1.1, "defaultPosition": 35}
}
```

Values are local to this root, not floor/world heights. Moving slats/seams carry `rollerShadePart: {"center": 0.7, "height": 0.036}` in their extras. The bottom rail carries the same fields plus `"rail": true`. This adapter expects direct children with rest geometry and unit Y scale; their positions are expressed in the shade root's axes. Do not introduce transformed intermediary groups unless extending the runtime.

Movement uses `lift = height * position / 100`, clips slats at the housing and moves the bottom rail upward. It must not grow the frame, stretch the entire window, or expose disconnected slats above the housing. Keep the moving root separate during batching (`noMerge`). `position=0` means fully closed; `100` means fully open.

Export all parts at the fully closed rest geometry with unit scale. Save the desired opening in manifest `defaultPosition` and matching root metadata. `onlyVisible` export of the current open state would lose hidden slats permanently. The authoring exporter closes the fresh export build before serialization while leaving the retained viewer room unchanged.

## State and mappings

- Lights map to `light.*` or intentionally selected light-power `switch.*`; covers map only to `cover.*`. A friendly label never substitutes for `type`.
- HA cover `current_position` is 0 closed, 100 open. Render reported values, including external changes and intermediate travel positions; do not instantly display the command target as confirmed physical state.
- Unknown/unavailable/disconnected devices must not send commands or visually snap shut. Keep the last known opening. A reported `closed` state without a percentage can establish 0; `open` without a percentage does not reliably establish 100.
- Current cover feature bits used by the integration: open 1, close 2, set position 4, stop 8. Commands are `open_cover`, `close_cover`, `set_cover_position` (integer 0–100), `stop_cover`. Inspect current target dispatch rather than assuming every entity offers all four.
- The backend resolves the saved mapping and validates type, availability and capabilities. Client-supplied alternate entity IDs must not redirect a command.

## Windows and other openings

The roller-shade adapter is not a general hinge or sliding-window adapter. An independently modeled sash needs a measured pivot/axis/rest transform (or sliding travel), a runtime adapter that can reproduce it after import, state mapping, and compatible manifest validation. A motorized HA window may use `cover.*` but still needs the correct geometry adapter. A manual window with a contact sensor needs status-only `binary_sensor.*` support; it cannot receive open/close services. Do not export an unsupported opening as if it already has these capabilities.

## Optional daylight

For day/night lighting and sun-driven rendering, read [daylight.md](daylight.md). This requires a target renderer/validator with the optional `daylight` contract; the initial 0.9.0 cover protocol alone does not provide it.
