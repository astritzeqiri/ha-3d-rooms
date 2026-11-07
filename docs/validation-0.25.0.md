# 0.25.0 release validation — 2026-11-07

The release is based on 0.24.0 (`99e15d6`) plus the reviewed dashboard workspace and house-management preview. It is assembled in an isolated checkout, preserving the older working tree and private model assets.

- All six application version fields agree on 0.25.0; HACS remains a single Integration with the manager and card bundled.
- 153 frontend tests pass. Formatting and production build pass. The known Three.js chunk-size advisory is unchanged.
- 38 host Python tests pass; 13 native-only tests skip on the host. All 13 native Core tests pass inside the existing `three-d-rooms-homeassistant` singleton.
- Both ZIPs were inspected for credentials, private GLBs, local state and dependency folders. Integration ZIP contains only the runtime integration package with its compiled manager/card. The extracted integration ZIP was loaded through the canonical helper with the persistent config retained.
- Native browser checks on that package cover house/floor/room views, visible device controls, per-view marker persistence, exact top-down floor cameras, native AC controls, direct linked dashboard cards and desktop/390px layouts. Original models, entity mappings and saved views remain unchanged; temporary browser views/dashboard are removed. No page errors.
- The reviewed preview additionally verified view-wide defaults/individual overrides, corrected anchor projection against actual GLBs, the shared AC icon during live updates, direct editor fields with compact resets, auto-height/fullscreen, and atomic house replacement/deletion using disposable fixtures. Release browser checks reconfirm the compact editor and auto-height/fullscreen against the packaged build.

Private screenshots/logs are retained locally outside the release. Physical phones, production devices, HA OS/Proxmox, and an end-to-end HACS download remain untested. Existing rooms and saved-view IDs require no migration or re-upload.
