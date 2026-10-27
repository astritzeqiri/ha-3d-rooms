# 0.22.0 validation — 2026-10-27

Release prepared in isolated `/tmp/three-d-rooms-release-0.22.0` from published main 0.21.0, using the combined locally verified marker-controls source. Original unrelated workspace changes and private room assets are excluded.

## Scope

Per-device markers and validated 3D offsets; direct drag, compact radial actions, eye visibility, per-device session Undo and outside-click deselection; hidden editor ghosts; native HA icon sizing; stable camera snapshots, responsive layouts and shared validated thumbnails. Existing storage/model schema versions remain unchanged.

## Prior local interaction checks

The combined build was exercised in official Core 2026.10.2 through the singleton helper: real surface placement, camera rotation with unchanged 3D offsets, mixed room/tray controls, labels and sizes, hidden controls/eye restoration, direct drag, Undo and outside-click focus clearing. Measured actual native light/shade/desk SVGs at 24/32/44/56px; all twelve centres had zero X/Y offset after the native icon-container fix. No production or physical-device check.

## Release checks

- Frontend: all 113 tests pass; formatting check passes; manager/card production build passes (existing Three.js chunk advisory only).
- Host Python: 18 pass, 11 native tests skip because host Python has no HA installation. Those same 11 native tests all pass separately in official Core 2026.10.2.
- All six application version fields agree on 0.22.0. Integration ZIP: 21 files; source ZIP: 91 files. Integrity, folder layout, referenced assets and privacy checks pass. No credentials, private scans, room GLBs, runtime storage or dependency trees included.
- Extracted the exact integration ZIP and loaded it through the original workspace singleton helper. Saved a disposable view through the native manager with hidden/light and 24px desk settings plus a shared JPEG; confirmed settings and original room/view data via native authenticated APIs.
- Restarted the same HA instance with the same config and exact artifact. The saved settings/thumbnail survived. A new real dashboard linked to that saved view loaded directly, hiding the light and centring the small desk icon correctly without a manually installed card resource.
- Removed only the disposable test dashboard/view. Compared original rooms and saved views with their pre-test snapshot: unchanged. Local HA remains available with the exact release artifact.
- Ruff is unavailable on the host. Actual HACS download, production HA, physical devices and physical mobile browsers were not tested.
