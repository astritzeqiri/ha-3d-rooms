---
name: room-to-home-assistant
description: Assess an editable room model for Home Assistant entity-control candidates, or prepare supported lights, shades and optional daylight and export a validated 3D Rooms ZIP. Use for a room-to-entity inventory or model preparation after reconstruction.
---

# Room to Home Assistant

Turn an approved visual reconstruction into a room with independently addressable objects. Work on the editable model; the deliverable is a private, upload-ready 3D Rooms ZIP and a clear account of supported controls. This skill complements scan-to-threejs; it does not redo the room reconstruction or infer the user's actual HA entities from photographs.

## Assessment or preparation

For a request to check a room or identify entity candidates, inspect the available model/evidence and return the candidate inventory only. Do not edit the model, export a replacement, change entity mappings or operate devices for an assessment-only request. Report what needs segmentation, additional metadata or unsupported runtime behavior. When the user requests preparation as well, continue with supported controls and export verification.

## Scan-based room handoff

For a full scan-to-HA request, read [scan-handoff.md](references/scan-handoff.md). The normal outcome includes independent supported lights/shades and shade-aware Day / Night / Auto for modeled windows, unless the user limits the scope. Use the approved reconstruction and its photo evidence, not just the original night-time scan texture. If only a raw capture exists, establish an editable reconstruction through the workspace's scan workflow first; do not claim a baked room mesh already contains independent controllable objects.

## Find the project and its contract

Inspect the workspace and repository instructions before editing. Locate the authoring project, approved room module, reference photos/scan, exporter, and target 3D Rooms integration. These can be separate repositories. Keep the accepted room's dimensions, placement, materials, camera and unrelated edits intact.

Read [the control contract](references/control-contract.md) when implementing or exporting controls. Treat it as a starting point: inspect the installed target's manifest validator, renderer, service dispatch and mapping UI before relying on support. A label such as “roller shade” does not establish a control's type.

This skill ships in the 3D Rooms repository under `skills/room-to-home-assistant/`. The authoring model may live in a separate checkout, including [Wes Bos's 3D Model Anything](https://github.com/wesbos/3d-model-anything), or in another modeling project. Ask for unavailable model/evidence locations rather than assuming a directory layout. Read the integration's own `AGENTS.md` before changing or building it.

## Identify candidates from evidence

Inspect the model hierarchy and its source geometry together with the available photos/scan. Use names, emissive materials, light nodes, opening bounds and existing metadata as search aids, then visually verify the object. Do not claim that a scan or an automatic name match proves an object is motorized or connected to HA.

Prepare a compact candidate inventory: visible object, source node/path, proposed stable control ID, evidence/confidence, intended behavior, compatible HA domain, and supported/uncertain/unsupported status. Keep this inventory beside private model outputs. Reuse existing IDs and controls on reruns instead of creating duplicates.

Typical decisions:

- A ceiling pendant, wall lamp or LED strip can be a light control. Group multiple emissive meshes under the real physical fixture; keep distinct fixtures independent. Map to `light.*`, or a known light-power `switch.*` for on/off only. A generic switch may control irrigation or another unrelated device.
- A roller blind/shutter can have independent 0–100% opening geometry. The physical controller normally maps to `cover.*`. Separate adjacent shades even when they share a window frame.
- A window or door may be a candidate for local opening animation, motorized `cover.*` control, or open/closed sensor status. A manual sash cannot be remotely moved by a contact sensor. `binary_sensor.*` is status-only and is not supported merely because the current package supports lights and covers.
- An adjustable desk may support height, movement and optional macros when its model and target support the grouped-device contract. Read the target repository’s `docs/adjustable-desk.md`; do not infer motorization or actual entity IDs from its appearance.
- Ignore ordinary furniture and decorative objects unless the requested behavior makes them relevant.

Proceed with clear, supported candidates within the user's request. Surface uncertainty about segmentation, hinge side, which leaves move, or physical device behavior; ask only when the answer materially affects implementation and continue independent work. An inventory is not an automatic new approval gate.

## Expose the objects

Preserve the approved appearance at its authored/rest position. Reuse the existing light and roller-shade builders, control UI, exporter and runtime adapters where available. Isolate moving parts and prevent static batching from merging them with frames, walls or other controls. Keep frames, plants, chains and handles stationary unless they actually move with the object.

For a baked scan mesh, isolate or reconstruct only the necessary editable parts from measurement/photo evidence. Do not translate an entire window/wall triangle mesh and call it an articulated blind. Record approximate dimensions or uncertain construction.

Use stable semantic IDs, explicit manifest types and node bindings. Store movement/rest metadata in GLB extras and serialize every movable part, including the parts hidden when fully open. Local preview and HA import must use the same direction convention and restore correctly after repeated movement. Add accessible, keyboard-operable local controls and preserve existing lighting and object editing.

Do not disguise unsupported hinge motion, sensor state, fans or other devices as a light or roller shade. If the user's task includes implementing that behavior, extend the target renderer/manifest/state/services coherently, follow its repo checks, and verify the extension before exporting it. Otherwise report the unsupported candidate and finish the controls the target already supports. Changing this skill is not itself authorization to release an integration or actuate household devices.

## Day and night lighting

For the full scan-based workflow, or a daylight-only request, read [daylight.md](references/daylight.md) and add Day / Night / Auto to the same model. Measure each window aperture, connect its daylight contribution to the corresponding shade, and preserve independent indoor-light control. Auto follows a selected HA sun entity with gradual dawn/dusk; a local clock preview must be labeled as such. Do not infer compass orientation or promise a measured solar simulation from scan coordinates.

Include the optional daylight manifest/GLB metadata, validate target support, and test external sun-state updates, shade openings, unknown/unavailable entities, and saved settings. Keep dynamic daylight out of static reflection captures so switching to night cannot leave daytime illumination baked into the room. Day/night rendering does not itself authorize cover automations or physical device commands.

## Export and verify

Export a new model ID when importing alongside an existing room. Preserve IDs when upgrading the same room through a supported replacement mechanism. Keep original captures and exports. Do not overwrite existing entity mappings or publish household assets.

Use the real export path, not a hand-written manifest detached from the displayed geometry. Check both the ZIP schema and the actual GLB bindings. The bundled helper uses the target integration's own validators and additionally checks the current roller-shade motion metadata:

```sh
python3 "$SKILL_DIR/scripts/validate_ha_room.py" /absolute/path/room.zip \
  --integration-root /absolute/path/ha-3d-rooms
```

Set `SKILL_DIR` to this skill's directory. The helper validates an existing package; it does not perform visual object detection or prove runtime behavior. If the target adds another motion protocol, adapt the helper alongside that tested contract rather than weakening its checks.

Verify local on/off and each moving control at closed, intermediate and open states; move back again and reload. Check independent operation, clipping/pivots, shadows, appearance and relevant viewer modes. Export while a shade is open, reimport, and confirm that it can still fully close. Compare before/after views from the same camera and inspect browser errors.

Run meaningful authoring checks and the target repository's required tests/builds for any integration changes. For native checks, follow the target repository’s runtime instructions and use demo entities. If it provides a shared local test instance, reuse it; do not create another container or change its configuration to bypass a conflict. Confirm type-filtered mapping choices, supported-feature gating, external HA state updates, unknown/unavailable handling, and persistence. Do not equate a successful helper or build with a successful HA/device test.

Deliver the private ZIP, before/after visual evidence, detected and exposed objects with stable IDs/types, unsupported/uncertain candidates, actual validation results, and exact remaining import/mapping steps. Distinguish local preview, native HA tests and physical-device tests. Release/push only when separately authorized by the user.
