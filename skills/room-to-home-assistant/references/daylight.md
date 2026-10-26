# Day / Night / Auto

Use one geometry model and independent daylight/fixture layers. The initial implementation is approximate diffuse window light with shadows and a neutral sky backdrop. It does not synthesize a photographic exterior or accurate compass-aligned sun rays. Ask for/measure orientation only if directional solar accuracy is part of the task.

## Implemented sources

Authoring: `packages/room-runtime/daylight.mjs` (+ TypeScript declarations), `room-lighting.ts`, `render.ts`, viewer day/night controls, and `object-export.ts`. Integration: `rooms-app/shared/daylight.mjs`, `web/scene.js`, `web/main.js`, `dashboard/card.js`, native model/API validators and sun-state bridge. The two daylight renderer helpers currently share an implementation; keep their behavior aligned when changing either copy.

Inspect target support rather than inferring it from cover support or a version label. Old validators may silently strip unknown optional fields. The skill validator rejects an export whose daylight metadata is discarded by the selected target validator.

## Optional manifest field

```json
{
  "daylight": {
    "mode": "auto",
    "entity": "sun.sun",
    "windows": [{
      "id": "window-broad",
      "nodeId": "window-broad",
      "position": [0, 1.7, 1.7],
      "inward": [0, 0, -1],
      "width": 1.1,
      "height": 1.13,
      "coverId": "window-shade-right",
      "defaultPosition": 35
    }]
  }
}
```

Measure all example values. `position` is the aperture center in world meters, `inward` is a nonzero direction into the room, and width/height describe the pane opening. The current adapter assumes vertical rectangular apertures. Tag the preserved glass/aperture mesh with `extras.daylightWindowId` matching `nodeId`, keep it out of batching (`noMerge`), and exclude transparent glass from opaque shadow casting. This is a daylight node ID, not a light/cover control ID. Each physical shade references its existing declared cover control through `coverId`; unshaded windows omit it. If an editor removes a shade, remove that link instead of emitting a reference to a nonexistent control.

Export daylight settings and aperture metadata, not generated sky planes/lights. The target reconstructs these runtime objects. Include every blind part at its closed rest pose, with the desired opening saved separately as described in the cover contract. Hiding dynamic runtime objects at night must not remove aperture metadata from the GLB.

The native integration stores a model's selected mode and sun entity alongside existing models/mappings; manager settings and dashboard rendering use that saved configuration. Models without daylight metadata retain their previous behavior. Do not modify the model schema version or erase existing uploads just to add this optional feature.

## State behavior

Day gives full exterior daylight; Night removes daylight without switching indoor lights. Auto reads the selected `sun.*` entity: smoothstep over elevation −6° through +12° provides twilight; above/below horizon is a fallback when elevation is absent. Unknown, unavailable or disconnected sun state retains the last rendered level, starting at night for a fresh view. Other sensor/helper domains need their own validated mapping adapter; they cannot be substituted by label alone.

Each window's light energy and diffuse room contribution follow its cover's reported opening (0 closed, 100 open). Unknown cover positions retain the prior opening. Sky brightness follows outdoor time of day; physical blind geometry occludes the view. Keep daylight independent of indoor fixture intensity/emission and retain low ambient visibility at night. Calibrate intensities visually with indoor lights both on and off.

Static environment/reflection captures must exclude dynamic daylight. Otherwise loading in Day and switching to Night can leave bright baked reflections. Verify both mode orders, reloads and lamp toggles. A local Auto preview without HA may use a clearly disclosed clock approximation; refresh it while open and do not export that approximation as the HA state source.

## Verification

Check Day/Night with open, partial and closed shades and with lamps both on and off. Export while open/daylit, import into a target with daylight support, and check that both motion and lighting survive. Test manual mode saving, Auto sun selection, external elevation/day/night changes, unavailable-state retention, sidebar/dashboard parity and restart persistence. Use isolated HA entities for native tests. HA's real Sun integration recalculates its state; for repeatable tests create a disposable simulated `sun.*` entity in the isolated instance, then restore the model's real sun binding before a persistence check. Do not falsify the production sun state or move real covers for a rendering test.
