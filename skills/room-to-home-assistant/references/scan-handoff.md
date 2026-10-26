# From an approved scan-based model to Home Assistant

Use this for the complete room workflow: photo-guided editable room → independent fixtures and roller shades → shade-aware daylight → private ZIP → native HA verification. Reuse the implementation patterns, not that room's coordinates, object count, IDs, material values or entity names.

## Establish the editable baseline

Locate the app capture/export, measurements, posed photos, approved reconstructed module and its current preview. A capture may consist of RoomPlan bounds, a textured GLB, or an app bundle; inspect it before assuming its contents. Preserve its floor/world transforms, room placement and reference-camera alignment. Keep private assets ignored by Git.

If the capture has not been reconstructed into independently editable geometry, use the workspace's scan reconstruction workflow (for example scan-to-threejs when present) before exposing controls. A raw mesh or RoomPlan category box alone is not a finished articulated fixture. Preserve an approved model's rest appearance; do not restart reconstruction merely to add controls.

A night-time capture records the lighting of the photograph, not the only permitted lighting of the model. Inspect whether dark windows, bright lamp patches or shadows are baked into unlit textures. New lights cannot remove baked shadows or an emissive appearance. Reconstruct only the necessary surfaces/materials from the available measurements/photos, keep the original reference, and record visual approximations. Do not brighten the entire scan texture and call it daytime.

## Apply the control and daylight passes

Use the entrypoint's evidence-based inventory and the control contract to isolate each actual fixture and shade. Keep frame/trim/adjacent objects stationary; give separate real devices separate stable IDs. Support on/off and actual light capabilities; model roller-shade opening with every slat preserved at export. Report ambiguous/manual openings instead of pretending their contact sensors can actuate them.

For each modeled window, use the daylight reference to record its world-space aperture center, inward direction and dimensions, and associate it with the correct shade. Unshaded apertures can contribute daylight without a cover binding. This is independent of whether a window sash itself can move. Preserve tagged aperture meshes through batching and cleaned export.

Add Day / Night / Auto to the same room. Light from each window follows its own shade opening; ceiling lights remain independent. Test a daylit room with the lamp off, and a night room with the lamp on. Exclude daylight from static reflection/environment baking. Do not invent compass direction or the scenery outside a night-time photograph. The supported baseline is diffuse window light and a sky backdrop; measured solar angles or a photographic exterior are separate fidelity work.

## Carry the behavior into HA

Use the real authoring exporter and inspect the resulting ZIP. It must carry explicit light/cover types, stable GLB node bindings, complete closed-rest shade geometry, saved opening values and optional daylight metadata. Source-module behavior that is missing from the manifest/GLB will not appear after import. Keep runtime-created sky/lights out of geometry export; the HA renderer recreates them.

Check target support before asking the user to import. The combined daylight workflow shipped in 3D Rooms 0.10.0; verify the actual installed/source capabilities rather than relying on a version string alone. Earlier cover-only packages do not supply daylight, and older validators may discard its metadata. Run the skill helper against the intended target. Do not require a model re-export for unrelated integration updates; re-export when the room actually needs new motion/aperture metadata.

Use a new model ID for a side-by-side import, preserving the prior room. Reuse existing control IDs and supported replacement mechanisms for in-place upgrades. Entity mapping choices must match explicit control types: cover rows show covers, light rows show lights/intentional light-power switches, and Auto selects a sun entity. Labels alone never determine compatibility. Preserve existing valid mappings; do not silently reconnect a shade to a light because of a friendly name.

In the target repository’s approved native HA test instance, import the actual ZIP and verify the manager and actual dashboard card. Reuse a managed shared instance where required by its repository instructions. Confirm independent light and shade behavior, external cover positions, external sun day/night/elevation changes, unsupported/unavailable handling and persistence across restart. A validator/build pass is not a visual/runtime pass. Do not send test commands to household devices or create sunrise/sunset cover automations merely to verify rendering.

## Handoff

Deliver the upload-ready private ZIP and same-camera evidence for Day/open, Day/closed and Night; include lamp-off/daylight evidence when needed to verify independence. List exposed control IDs/types, window-to-cover associations, uncertain/unsupported objects, exact checks performed, target compatibility and import/mapping steps. Distinguish local preview Auto (if using a disclosed clock approximation) from HA Auto driven by sun state. Keep scans and household exports out of public HACS assets. Publishing an integration update remains a separately authorized action.
