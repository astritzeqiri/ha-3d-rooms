# Validation — 2026-10-23

## Version 0.4.0: single HACS integration

Implemented a local Python integration, one-entry config flow, administrator-only sidebar, auto-loaded bundled card, native authenticated WebSocket/HTTP APIs, private scene loading, persistent model library, safe imports, and ZIP export/import with saved mappings. The Node add-on is retained as a migration/development path.

### Verified locally

- Isolated official Home Assistant Core **2026.10.2** container, separate from the user's live VM.
- Native config flow creates the integration, which survives a full HA restart with its catalog and uploaded kitchen intact.
- Sidebar model manager renders the kitchen and uses current HA entity state through its authenticated frontend connection.
- The dashboard card loads on a dashboard-only navigation with no Lovelace resource entry or separate card installation.
- Clicking the modeled pendant opens HA's native light dialog. Switching its built-in demo light off updates the room while retaining low ambient visibility. All walls stay visible.
- Native API checks: ZIP upload, private model catalog, authenticated GLB and ZIP export, and unauthenticated scene requests rejected.
- Native demo-light service checks: explicit on/off, brightness, RGB, white temperature, and invalid RGB/Kelvin rejection. No real devices were controlled.
- Pure Python tests cover catalog persistence, ZIP/mapping export/import round-trip, duplicate IDs, unsafe archive paths, external assets, unknown control nodes, invalid bindings, size caps, duplicate archive entries, failed-write rollback and deletion.
- JavaScript tests cover existing light behavior, legacy migration ZIP export, native authenticated card transport/blob cleanup, and perspective/orthographic framing across screen sizes.

### Remaining checks

- HACS download/category transition on the user's own HA installation.
- User's HA OS/Proxmox VM, physical lights, iPhone companion app and GPU performance on a large floor model.
- User-managed HA backup/restore of the library. Storage lives under `config/.storage/three_d_rooms/` and must be included in backups.

The local integration test uses disposable credentials saved only in `/tmp`; neither these nor private model assets are committed. `integration-tests/live-check.mjs` explicitly targets only `127.0.0.1:18123` and exercises the disposable test instance. It is not a command to run against production.

## Loading regression fix — 0.4.1

- Found the integration serving every scene with `Cache-Control: no-store`. The kitchen GLB is 33,983,588 bytes; its ZIP upload size is smaller than its actual scene transfer.
- Compressed responses transfer 16,660,908 bytes (51% less) without changing geometry or textures. A local warm conditional request returns 304 with zero body bytes (10 ms in one isolated run). These are local transport measurements, not an end-to-end speed claim for the user’s network.
- Cache revalidation still requires authentication; anonymous requests with a valid ETag return 401. Gzip opt-out returns the original bytes.
- Client tests verify concurrent/shared downloads, isolation by HA connection, revision invalidation, mapping-only reuse, and failure/retry. The sidebar and dashboard share bytes through the native panel bridge.
- Browser timings on the local test machine were approximately 112 ms to prepare the GLB and 190 ms for its first render. GPU/browser performance elsewhere will vary.
- Original files and mappings remain unchanged; compressed derivatives are generated for existing rooms without re-uploading.

## 0.5.0 — saved dashboard components and compact light controls

- Prepared in an isolated checkout at 2230e34, excluding concurrent unfinished camera-snapshot edits.
- Node tests, formatting, production manager/card builds, and Python storage/archive/component tests passed.
- Native permission and service tests passed inside official Home Assistant Core 2026.10.2.
- A separate disposable container on localhost:18124 used a copy of the existing test configuration. Its existing kitchen upload and mappings loaded without re-upload. Setup, private compressed scenes, authenticated ETag validation, export, demo light services and invalid command rejection passed.
- Browser verified automatic card loading, the 32 px button, click-to-toggle and hold-to-open native more info. The bundled native manager created and saved a kitchen component at 90° rotation and 1.25× zoom with matching dashboard configuration.
- Component persistence, independent views and portable configuration round trips are covered by storage and component tests.
- All application versions agree at 0.5.0. Release ZIP contents were inspected for correct layout and exclusion of private room data and credentials.
- Production Home Assistant, physical lights and HACS download remain user-side checks. Room merging and current-camera snapshot export are not included.


## Current-view dashboard export — 0.6.0

- Camera tests project room points before and after a JSON export/import for perspective and orthographic views, including pan and zoom. Tests also cover narrower cards, subsequent angle/zoom edits and malformed snapshots.
- Browser check: orbit and zoom the kitchen, open Add to dashboard, and render the resulting configuration in the actual dashboard card. Its composition matches the manager at the same viewport dimensions.
- The rebuilt integration was loaded into a separate official Home Assistant Core 2026.10.2 container on port 18124. Its native dashboard rendered the camera configuration copied from the manager, with no browser console errors; the isolated upload/authentication/demo-light smoke check also passed. This does not test the user's production HA OS VM or HACS download.


## Live component sidebar — 0.6.0

- Replaced the covering dashboard dialog with an inline editor beside the room. Numeric fields and sliders update the actual scene; orbit/pan/zoom refresh the controls and exported camera. Saving stores a named component with its full camera snapshot in both native HA and the development server.
- Browser verified: adjust rotation/tilt/zoom, save a temporary component, reopen it with the exact zoom precision, and remove only the temporary test record. Verified the room remains visible while scrolling the controls on a 375px mobile viewport.
- Native HA Core 2026.10.2: built manager rendered and saved a named camera component through the authenticated integration API. Native and storage Python tests all passed (11, no skips); Node regression tests passed (30). User's production VM and HACS distribution remain untested for this change.

## 0.6.0 release artifact check

Built from the published 0.5.0 baseline with all six application versions synchronized to 0.6.0. Extracted the generated integration ZIP and loaded that exact package in a separate official Home Assistant Core 2026.10.2 container on port 18124, retaining the isolated kitchen library and component data. Authenticated setup/catalog, scene/export, bundled frontend and demo-light checks passed. All 11 Python tests passed in that runtime without skips; all 30 JavaScript tests, formatting and build checks passed. Inspected both release archives for matching version/structure and absence of private models, credentials, runtime data, dependencies and Python caches. This does not validate the user's production VM or a HACS download on their device.

## Interactive component camera — 0.7.0

- Browser verified that dragging and zooming the component preview change its angle/zoom fields and YAML. Saving and reopening a temporary component preserved the exact camera configuration. Top, Bottom and Reset updated the camera and settings; pole captures retained stable heading.
- Camera preset tests cover all six axis directions and both projection types, valid up vectors, reset fitting, and unknown names. Camera capture tests cover stable heading at the poles.
- Rebuilt the integration and verified the native HA manager on the isolated Core 2026.10.2 instance: the component preview drag changed its generated configuration, and the Save this view navigator applied Top and Reset while updating the sidebar fields. No browser console errors. All 32 JavaScript tests, formatting and production builds passed. Included in version 0.7.0.

## Compact view cube — 0.7.0

Replaced the large direction-button panel with a 104px SVG cube and compact Home/Views controls, without adding a second WebGL renderer. The cube uses the real camera basis and only updates when orientation changes. Unit tests cover all 26 directions, visible faces and projected corner/edge hit regions. Browser checks verified a corner click (45° heading, 54.74° tilt), an edge click and the equivalent picker; camera fields followed correctly, with no console errors. All 34 JavaScript tests passed.
Verified the rebuilt cube in the isolated Home Assistant Core 2026.10.2 manager: selecting a corner updated the real sidebar to 45° heading and 54.74° tilt. At 375px viewport width the cube stayed 104px wide with no horizontal page overflow. The native view was not tested against the user's production VM.

## 0.7.0 release artifact check

All six application version fields agree on 0.7.0. The production manager/card build, formatting and 34 JavaScript tests passed. Extracted the generated integration ZIP into a separate package directory and ran it in official Home Assistant Core 2026.10.2 on port 18124 with the existing isolated library. All 11 Python tests and the authenticated catalog/scene/export/frontend/demo-light smoke checks passed. Both release archives were inspected for correct structure and absence of private models, runtime data and credentials. The user's production VM and HACS download remain outside these local checks.
