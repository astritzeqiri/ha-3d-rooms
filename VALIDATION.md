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

## 0.7.1 — integration branding

- Added original isometric room artwork in the integration’s `brand/` directory: 256px and 512px RGBA PNGs, with explicit dark variants.
- Visually inspected the mark; verified all four PNGs decode, have the expected dimensions and transparent corners.
- Reviewed the release packager: its recursive integration copy includes `brand/` without changes. No frontend/backend behavior changed, so no frontend rebuild was needed.
- Local brand support requires Home Assistant 2026.3 or newer. HACS views and the repair notice in the user’s installation have not been verified.

- Release checks: all 34 Node tests and formatting passed; production manager/card rebuilt. Python tests passed (8), with 3 native-runtime tests skipped because Home Assistant is not installed in the host Python environment.
- All six application version values agree at 0.7.1. Generated release ZIP verified for version, package structure, four valid icon PNGs and exclusion of private model archives. No fresh native HA/HACS visual verification was performed for this asset-only change.

## 0.8.0 — Home Assistant visual card editor

- Verified in the existing disposable official HA Core 2026.10.2 instance on localhost:18123; inspected the mount to confirm it uses this checkout’s integration package. Production HA was not accessed.
- Browser followed Add card → By card → 3D Rooms, selected the uploaded kitchen, changed title and rotation, saved through HA, then reopened the card and confirmed the exact title and 90° rotation persisted. The real room rendered in the native preview.
- All 39 Node tests passed, including editor tests for preserving camera/unknown config, projection/model reset, independent saved component copies, invalid inputs, and library failure/retry. Formatting passed.
- Saved component selection is regression-tested; native selection with an existing saved component and narrow/mobile layouts remain unverified. No storage or backend API changes.
- Final production rebuild and release ZIP checks passed: versions agree at 0.8.0, editor and four branding assets included, no private model archives. Python host tests: 8 passed, 3 native tests skipped. No browser console errors observed in the native editor check.

## Version 0.9.0 — roller shades (2026-10-23)

- Original viewer: independently movable left/right shades, native keyboard sliders and animated Open/Close; 50% opening survived a browser reload. Four viewer object/motion tests and production TypeScript/Vite build passed.
- New private kitchen export validated and imported through native HA; both shade nodes retain all 63 movable parts even when exported open. Private captures/ZIPs remain ignored and are excluded from releases.
- JavaScript suite: 43 passing checks, including cover manifest validation, compatible entity domains, bounded supported service commands, reported/unknown/unavailable positions, local-space motion and dashboard cover clicks. Prettier check and manager/card builds passed.
- Python: 9 pure storage/import checks passed, including cover mapping persistence and export/import. Four native API/service checks passed inside official Home Assistant Core 2026.10.2, including caller context, mapped cover services, capability gates, invalid percentages and unavailable devices. The host Python run skips those four; they were run separately in Core.
- A separate disposable Core instance on port 18125 loaded the prepared kitchen, mapped two demo cover entities, accepted position commands and exposed cover state. The native manager displayed per-shade opening sliders and Open/Stop/Close; dashboard shade markers opened HA's native cover dialog. External demo state updates reached the manager.
- The exact `3d-rooms-0.9.0-integration.zip` was extracted under `/tmp/three-d-rooms-cover-artifact` and mounted into a new Core container using the same disposable config. Room and both cover mappings survived the restart; package version 0.9.0 and bundled shade renderer were verified. Six application version fields agree; the ZIP contains no room models or credentials.
- No production HA instance, physical shades, actual HACS download/install or iPhone GPU performance was tested. The new model ZIP must be imported to add movable geometry to an older static room; existing uploads/mappings remain compatible.

## Version 0.9.1 — native entity icons and marker states (2026-10-23)

- Dashboard circles use `ha-state-icon` with the mapped HA entity, preserving custom entity icons and Home Assistant’s device-class/state icon resolution. Standalone previews retain a type-specific fallback.
- Badges and accessible descriptions distinguish On/Off, reported shade percentages, opening/closing arrows, unavailable and unmapped devices. Active colors retain readable contrast in the native light theme; badges remain inside the bottom edge of the card.
- 46 JavaScript tests passed; formatting checks and manager/card production builds passed. The Python suite passed its nine pure tests, with four native service tests skipped on the host. Backend/service behavior is unchanged in this patch.
- Verified the rebuilt card in the isolated native Core 2026.10.2 dashboard on port 18125: native icon shadow roots rendered HA SVG icons, a custom `mdi:blinds-horizontal` entity icon rendered, and the mapped demo cover displayed `↓ 42%` plus the accessible description “closing, 42% open”. The light displayed “On” and its reported brightness in the accessible label. The screenshot is private local evidence.
- Six application versions agree at 0.9.1. Release ZIPs contain no private room assets or credentials. No model re-export or mapping migration is needed for this icon change. Physical devices and actual HACS download/install remain untested.

- The exact 0.9.1 integration ZIP was extracted under `/tmp/three-d-rooms-marker-artifact` and loaded in a fresh Core container with the existing disposable config; package/Core versions and persisted room/cover mappings were verified.

## Version 0.10.0 — daylight (2026-10-23)

- Added optional daylight aperture metadata, independent Day/Night/Auto rendering, shade-dependent window light and persistent per-model sun settings. Existing models without daylight retain their previous behavior.
- Original viewer TypeScript/Vite build and five object/motion/lighting tests passed. Daylight remains visible with the lamp off; switching the lamp does not change daylight. Compared day/open, day/closed and night/open states in the actual kitchen, then left Day with the lamp on for review. Dynamic daylight is excluded from static reflection capture.
- Fresh private kitchen-daylight ZIP passed the target manifest/GLB validators plus the skill's rest-geometry and daylight checks: three controls, two windows, all 63 parts for each blind. Prior room exports were preserved.
- Fifty JavaScript tests passed, including elevation/twilight fallback, independent window energy, unknown position retention, daylight schema validation and saved daylight API behavior. Manager/card production builds and Prettier checks passed. Ten pure Python storage/import tests passed; the host skipped the five native tests, which passed separately inside official Home Assistant Core 2026.10.2.
- An isolated native Core instance on port 18126 imported the actual kitchen export, saved Auto with a sun entity, rejected a wrong entity domain and rendered both its manager and actual dashboard card. External changes to a disposable simulated sun switched the card visibly between day and night, with no physical device actuation. The manager showed the saved Auto/sun controls. After restoring sun.sun and restarting, Auto, both windows and all three control declarations survived. Browser console had no errors during the dashboard check.
- Updated and validated room-to-home-assistant skill, including the optional daylight contract. Its helper accepts the new package and old shade-only package, and rejects a target validator that strips daylight.
- This is approximate diffuse window lighting with a plain sky backdrop; compass-accurate sunlight/exterior reconstruction, production HA/HACS installation and physical-device/iPhone GPU checks remain untested.

- Release artifact check: the exact 0.10.0 integration ZIP was extracted under `/tmp/three-d-rooms-daylight-010-artifact` and loaded in a new official Core 2026.10.2 container using the existing disposable config. Auto/sun.sun, both windows and all three controls persisted; all five native API/service tests passed against the extracted package. Six application versions agree at 0.10.0. Integration/source ZIPs exclude private room exports and sessions.

## Version 0.10.1 — device card settings and shade controls (2026-10-23)

- Added an accessible settings cog to every light/cover card. The focused entity editor reuses the existing compatible picker and authenticated mapping API; automatic saving and full Model settings continue to work. Closing the focused editor returns keyboard focus to the refreshed cog.
- Shade cards now have grouped icon/text Open/Stop/Close actions, a full-width filled slider, separate opening percentage, and Closed/Open endpoints. Responsive cards constrain button/input widths and wrap entity IDs.
- 50 JavaScript regression tests, formatting checks and production manager/card builds passed. Python host run: 10 pure tests passed, five native service tests skipped. No backend/service code changed in this patch.
- Verified in isolated native Home Assistant Core 2026.10.2 on port 18125: cogs opened the correct one-device editor for both light and shade; cover choices contained only cover entities. Changing the shade’s entity saved and updated its controls, persisted across a full page reload, and the original test mapping was restored. Keyboard shade interaction and focus return were checked.
- Measured native card layouts at desktop and 390px-wide phone viewport: all button/slider bounds stayed inside their cards; the phone manager had no horizontal page overflow. The viewport override was reset. Private screenshots record the final native UI.
- Application versions are synchronized at 0.10.1. Production HA, physical devices and actual HACS install/download remain untested. Private room assets and test credentials stay outside releases.

- The exact 0.10.1 ZIP was extracted under `/tmp/three-d-rooms-device-cards-artifact` and run in a new Core container with the same disposable config; package version, saved room and both cover mappings were verified after restart.

## Room workspace and area assignment — 0.11.0

- Room-first navigation with Devices, Saved views and Room settings, a shared camera editor, progressive disclosure and dashboard handoff instructions. Existing saved-view IDs and component JSON format remain compatible.
- 57 Node regression tests passed, including editing existing views in place, independent draft IDs, unsaved-change cancellation, resize normalization, route validation and legacy room/area persistence/export. Sandbox-restricted HTTP listeners were rerun with localhost access enabled.
- 11 pure Python storage/archive tests passed. Six native tests passed in pinned official Home Assistant Core 2026.10.2, covering actual area registry assignment/rename, unknown-area rejection, administrator authorization and existing light/cover/daylight behavior. The host-only run skips those six native tests explicitly.
- Formatting checks and production builds passed. All six application versions agree at 0.11.0; both release archives were inspected for correct contents and exclusion of private assets and credentials.
- The exact integration ZIP was extracted into /tmp/three-d-rooms-room-workspace-artifact and loaded by a separate disposable Core container on port 18125. Existing kitchen geometry, three mappings, Kitchen area association and saved camera view survived the switch/restart. Native APIs also accepted a real dashboard card configuration from the saved view.
- Browser observations verified native room tabs, area assignment and reopening a clean saved view through its deep link. The final 390px layout has no horizontal overflow (390px viewport and scroll width); the temporary viewport was reset. After the Mac was unlocked, native clicks verified room tabs, opening/saving/closing the shared view editor, dashboard handoff instructions, area settings save and separate room-scoped saved-view lists. Production HACS installation, the user's VM and physical devices remain untested.

## Form input consistency — 0.11.1

- Plain text and number fields now share the manager's dark field styles; Room settings uses aligned label spacing. The room-name field has an explicit text type and a 44px minimum height.
- 57 Node tests and 11 pure Python tests passed; the six native Python tests skipped on the host. No backend/service behavior changed in this patch. Formatting, production build and diff checks passed; all six application versions agree at 0.11.1.
- Inspected both archives for private asset/credential exclusion. Loaded the exact integration ZIP in the disposable official Core 2026.10.2 instance on port 18125. Browser verified corrected input appearance, editing, keyboard Tab navigation and room settings save. At 390px, viewport and scroll width both measure 390px; temporary viewport reset afterward.
- Production HACS installation remains a user-side check. Existing room, area and device mappings loaded unchanged in the disposable runtime.
