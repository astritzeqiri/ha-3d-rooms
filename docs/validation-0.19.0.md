# 0.19.0 release validation · 2026-10-26

Built in an isolated checkout of published 0.18.0 (452d382), applying only the Limestone & Clay manager styling, geometric room mark, compact device toggle and neutral scene background from the UI task. Other local workspace edits were excluded.

- All 87 frontend tests pass. Formatting check and production manager/card build pass; the known Three.js chunk-size advisory remains informational.
- Host Python: 15 tests pass, 9 skip without HA. All 9 native tests pass in the shared official Home Assistant Core 2026.10.2 runtime.
- All six application version fields equal 0.19.0. Both ZIP archives pass integrity checks: 21 integration files and 82 legacy source files. Verified integration directory structure, manifest version, referenced manager assets and private-file exclusions.
- Tested the extracted 0.19.0 integration ZIP through the primary checkout's singleton helper, retaining the same container, persistent configuration and credentials. Native manager loads the existing room library and models with the warm palette; the dashboard at /rooms-check/kitchen renders with the automatically bundled card. No manual resource installation was needed. Existing mappings remain present across the package restart.
- Prior native visual checks for this change covered the device toggle, Settings and the unsaved view editor. Text/action palette pairs pass calculated 4.5:1 contrast in both themes. Exact mobile widths, visual dark-mode rendering, physical devices, production HA and actual HACS discovery/download were not tested.
- Runtime remains on the exact extracted release package for local review. Private models, photos, screenshots, mappings, credentials and runtime config are excluded from Git and release archives.
