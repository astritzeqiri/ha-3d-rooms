# 0.36.0 — room icons, Devices tab and recovery polish, 2026-11-10

Released as 0.36.0, based on v0.35.0.

- Frontend: 236 tests pass, including new tests for download progress, short room names, suggested entity matches and the view editor; Prettier clean; build succeeds. Python host suite: 81 tests pass (16 native tests skip outside HA), including new room-icon tests (save, reset, validation, kept on replacement).
- Native checks in the pinned HA Core 2026.10.2 container, at desktop, 1280 px and phone widths: lost graphics context shows "Reload 3D view" in card and manager and recovers; card download progress per room; short room names in the Lights panel; Devices list beside the pinned model; suggested matches connect a device (then disconnected again); row hover highlights the icon and clicking an icon opens its row; dragging a room icon saves its position, which the house view then uses; icon picker opens in room mode; switching tabs closes and reopens the room icons.
- Not tested: choosing a room icon end to end in the browser (covered by backend tests), a real phone, real GPU context loss (forced with `WEBGL_lose_context`), the HACS download flow.

# 0.35.0 — light effects in the 3D room and a three-icon time-of-day switch, 2026-11-09

Released as 0.35.0, based on v0.34.0.

- Frontend: 227 tests pass, including new tests for every effect's animation, effect runs, the card's service-call handling and the time-of-day switch; Prettier clean; build succeeds. Python host suite passes (native tests skip outside HA); native tests pass inside Core 2026.10.2.
- Light effects, native checks on the house/room cards with a local test light offering the Zigbee effects and a demo light (`.local/room-lights-evidence/connect-effect-light.cjs`, `effects.cjs`): blink dims and returns, okay turns green, channel_change turns orange then dims, breathe fades, stop_effect and effect "none" restore the lamp's plain colour and brightness, rainbow cycles hue while reported; no page errors.
- Time-of-day switch (`daylight-toggle.cjs`), on the extracted artifact: each icon and the arrow keys choose and save their mode, with the highlight on the chosen icon; no page errors. An earlier run on the development build showed unrelated mode changes, consistent with the user's own browser using the same shared instance at the same time.
- Not tested: real Zigbee lights (effect lengths follow the Zigbee specification), a real phone, the HACS download flow.

# 0.34.0 — state colours on markers, 2026-11-09

Released as 0.34.0, based on v0.33.2.

- Frontend: 222 tests pass, including new tests for every device type's state colour and for applying/clearing it on a marker; Prettier clean; build succeeds. Python host suite passes (native tests skip outside HA); native tests pass inside Core 2026.10.2.
- Native check on the extracted artifact (`.local/room-lights-evidence/tones.cjs`, `lock-tone.cjs`) with demo entities on the house card: locked lock green and unlocked red; a light with a colour filled in that colour with a readable icon; the test AC blue while cooling; an open cover purple; off lights, closed covers and unconnected devices neutral; no page errors. Temporary mappings removed and states restored.
- Not checked live: locking/unlocking (orange) and jammed, the other AC modes, and the view editor's markers (unit tests only). Not tested: a real phone, the HACS download flow.

# 0.33.2 — manager page no longer served stale after updates, 2026-11-09

Released as 0.33.2, based on v0.33.1.

- Frontend: 219 tests pass, including a new test for the versioned manager URL; Prettier clean; build succeeds. Python host suite passes (native tests skip outside HA).
- Native check on the extracted artifact in the pinned HA Core 2026.10.2 container (`.local/room-lights-evidence/manager-lock.cjs`): the sidebar frame loads `index.html?…&v=0.33.2`, and the hallway's `lock` control is listed under Locks, separate from its three lights; no page errors.
- Not tested: the user's production browser cache (diagnosed from a screenshot), a real phone, the HACS download flow.

# 0.33.1 — open cards follow room changes made while they load, 2026-11-09

Released as 0.33.1, based on v0.33.0.

- Frontend: 218 tests pass, including new tests that an update arriving mid-load is rechecked once and that loads keep the update subscription; Prettier clean; build succeeds. Python host suite passes (16 native skips); native tests pass inside Core 2026.10.2.
- Native check on the extracted artifact (`.local/room-lights-evidence/live-hide.cjs`): on an already-open house card, three mappings and a hide made back to back show up within about 2 s; unhiding restores the light. The 0.33.0 panel check (`shades.cjs`) passes again. Mappings, visibility and states restored.
- Not tested: a real phone, the HACS download flow.

# 0.33.0 — Lights and Shades panels, 2026-11-09

Released as 0.33.0, based on v0.32.0.

- Frontend: 216 tests pass, including new room-panel tests for lights, shades, hidden devices and the All switch; Prettier clean; build succeeds.
- Python: the host suite passes (16 native tests skip outside HA), including the house-view room name.
- Native browser checks against the staged package in the pinned HA Core 2026.10.2 container (`.local/room-lights-evidence/native.cjs`, `shades.cjs`), with demo entities temporarily mapped and all mappings, visibility and states restored:
  - Buttons sit at the top left; room names come from the backend.
  - Room switch turns a room's mapped lights off; the All switch shows a confirmation, Cancel changes nothing, confirming turns off the visible lights while a hidden light on the same room stays on.
  - Shades panel lists roller shades/shutters per room (not doors/windows/desks); a room switch opens its mapped demo cover.
  - Desktop and phone layouts; no page errors.
- Known limit (fixed in 0.33.1): hiding a device while a dashboard card is already open did not update that card's panel until the card reloaded.
- Not tested: a real phone, physical lights and shades, the HACS download flow.

# 0.32.0 — door locks, per-view device icons and switch toggles, 2026-11-09

Released as 0.32.0, based on v0.31.0. Includes the switch-backed light toggle fix from the parallel `light-switch-toggle` session (its commit 26da379, applied unchanged).

- Frontend: 204 tests pass; Prettier clean; build succeeds. Generated `web/mdi-catalog.json` and `shared/marker-icon-paths.mjs` are excluded from Prettier and come from `npm run icons`. A test checks that only the picker's lazy catalog imports `@mdi/js` and that the suggestion paths match it.
- Python: the host suite passes (16 native tests skip outside HA). All native tests pass inside the pinned HA Core 2026.10.2 container, including the new lock dispatch test. Ruff is not installed on this machine.
- Integration ZIP inspected: version 0.32.0, complete bundled frontend (one lazy `mdi` icon chunk plus the search catalog), notices including Material Design Icons, and no private models, sessions or storage. The extracted artifact matches the source package and runs on the singleton.
- Native browser checks against the extracted artifact, using demo entities with test mappings removed afterwards:
  - Lock: state and thumb-turn follow `lock.front_door`, including changes made outside 3D Rooms; `open` is refused; tapping opens HA's lock dialog.
  - Hinged entrance door: follows its cover; a lock nested in the door keeps its own click target.
  - Outside light: on/off.
  - Per-view icons: saved and validated by the backend; drawn by the card through `ha-state-icon`.
  - Picker: suggestions, full MDI search, and a test `local:` set registered in the page like a custom-icons plugin (listed first, chosen and drawn on the card).
  - Loading: the full icon set downloads only when the picker opens, never at manager startup.
- Not tested: a real phone, physical locks and lights, the user's actual custom icon plugins, and the HACS download flow.

# 0.31.0 — faster on phones and lighter room models, 2026-11-08

Released as 0.31.0, based on v0.30.2.

- 196 frontend tests, formatting and build pass. 71 Python tests pass on the host (15 native skipped) and all 71 pass inside Core 2026.10.2, including the server optimizer on Home Assistant's Pillow 12.3.
- Integration ZIP inspected: structure, version 0.31.0, bundled frontend with the optimizer, KTX2 transcoder and notices, and no private models, sessions or storage. The extracted artifact was staged on the singleton.
- Render profile (phone vs desktop browser emulation): phone gets 1.5× pixel ratio without MSAA and a shadow-pass cap; `quality: high` restores full quality; orbiting renders no shadow passes. Headless timings for the phone-size house: about 27 ms per camera frame, against about 80 ms before.
- Lighter models on the five local test rooms: the server copies were created automatically at startup and the uploads are byte-identical. Browser optimization from the real manager took 4–63 s per room. Whole-house texture memory on a phone went from 266 MB to 86 MB (server copies) to 11.8 MB (KTX2). Phone cards download only phone copies. Living-room card load went from about 4.9 s to about 0.75 s. Side-by-side renders of the upload and the optimized copy differ only by animation and compression noise. A colour-space bug found here (data maps encoded as sRGB) is fixed and covered by a test.
- Not checked: a real phone, the actual HACS download, the user's production HA.

# 0.30.2 — contact sensors for window/door groups, 2026-11-08

Released as 0.30.2, based on v0.30.1. Frontend and backend group validation accept `binary_sensor` for cover groups unless a member is a desk (motion "none"); the group editor lists binary sensors for windows & doors.

183 frontend tests, formatting and build pass; host Python tests pass (15 native skipped on host), including new contact-sensor group cases; native tests pass inside Core 2026.10.2. Integration ZIP inspected and the extracted artifact staged on the singleton: the "Group windows & doors" editor lists demo binary sensors. Dialog closed without saving; no rooms, groups or mappings changed. Not checked on the user's production HA.

# 0.30.1 — binary sensors in the native window/door picker, 2026-11-08

Released as 0.30.1, based on v0.30.0. The native sidebar panel's entity list now includes `binary_sensor`.

183 frontend tests, formatting and build pass; 51 host Python tests pass (15 native skipped on host); native tests pass inside Core 2026.10.2. Integration ZIP inspected (structure, bundled frontend, version 0.30.1, no private models). Extracted artifact staged on the singleton: in the native manager, the Living room "Kitchen window" picker lists demo `binary_sensor` entities alongside covers. No mapping was changed. Not checked on the user's production HA.

# 0.30.0 — house replacement room/device matching, 2026-11-08

Released as 0.30.0, based on v0.29.1.

183 frontend tests, formatting and build pass; 51 host Python tests pass (15 native skipped on host); 15 native tests pass inside Core 2026.10.2. Native API preview of a scratch copy of the user's house ZIP with three rooms given new roomIds matched all five rooms (three by name), kept the living-room AC mapping and removed nothing; a malformed `X-Rooms-Matches` header returned 400. Browser review dialog rendered per-room cards, and room/device choices updated totals and released duplicate room choices, with zero page errors. Preview only: the local library was not replaced. Not checked on the user's production HA or on a narrow phone layout.

# 0.27.0 release validation

Final versioned build, 166 frontend tests and formatting pass. Integration ZIP inspected for correct structure, bundled frontend, version and absence of private room models. Prior native cache and reload checks below apply to the same implementation.

# Model cache and reload button — local preview, 2026-11-07

Based on published 0.26.0, preserved in `.local/model-cache`. Built integration staged through the canonical singleton helper; no version bump or publication. Existing model files, mappings and saved dashboard definitions were not edited.

- 166 frontend tests pass, including concurrent decode reuse, independent viewer resources, revision changes, retry, expiry, memory eviction, oversized admission, session separation and explicit cache clearing.
- Formatting, production manager/card build and `git diff --check` pass.
- Host Python integration suite: 58 tests, 43 pass and 15 native-runtime tests skipped. No backend code changed; native Python suite was not rerun.
- Native HA dashboard first visit reported cache miss; tab revisit reported a full cache hit for both layers. Preparation measured 355 ms cold and 28 ms warm in one local comparison (not total download/first-render time or a cross-device benchmark). Manual reload via keyboard and pointer reported fresh cache misses and returned to a rendered scene.
- Button is visible at the bottom right beside fullscreen; checked at the desktop and naturally compact browser sizes. Capture: `/tmp/three-d-rooms-model-cache.jpg` (private, outside package).
- A generic HA console `Object` error was observed; no shader error was reported in the inspected log. Physical devices, HACS download flow, prolonged browsing and production HA were not tested. Session caches do not persist across full browser refreshes; GPU compilation/first render still occurs for new viewers.

# 0.26.0 release validation

See [0.26.0 checks](docs/validation-0.26.0.md). All included device-management features and the retained renderer fix were checked in the packaged native integration.

# 0.25.1 rendering fix

See [release validation](docs/validation-0.25.1.md).

# 0.25.0 release validation

See [release checks](docs/validation-0.25.0.md) for packaged integration verification and remaining limits.

# Direct card editing and compact resets — local preview, 2026-11-07

Linked card fields remain editable. Edits automatically become per-card values; a small Reset beside the field label appears only when its value differs from the saved view. Reset and manually entering the inherited value both restore inheritance. Removed override checkboxes and repeated information controls. Narrow editor columns stack their numeric fields.

153 frontend tests, formatting and build pass. Native browser checks render the actual editor element using the existing Home Assistant theme/data, verify direct editing, per-field reset, manually restored inheritance and desktop/390px layouts. No models or saved views changed; no persistent fixtures created. Private screenshots and scripts remain in local evidence. Unreleased local preview only.

# Auto height and fullscreen — local preview, 2026-11-07

Added the card Height mode selector (fixed or auto), `height: auto`, viewport-aware card sizing including title/device tray, and supported-browser fullscreen toggle. Fixed height and linked saved-view overrides remain compatible. Native device dialogs exit fullscreen before opening.

153 frontend tests, format check and production build passed. Native browser checks on the existing singleton passed at 1440×1000, 1200×720, 390×844 and 844×390: card bottom matches viewport bottom, canvas follows scene height, fullscreen enters/exits, fixed 420px restores correctly, tray stays within height, native entity dialog exits fullscreen. Models and saved views unchanged; temporary dashboard removed; no page errors. Private screenshots/scripts in `.local/dashboard-workspace-evidence/autoheight-*`. Physical phones and browser-specific fullscreen support untested. Local preview only, no HACS release/version bump.

# Shared AC icon — local preview, 2026-11-07

Dashboard climate controls now use the same wall-mounted AC SVG as the viewer and marker editor. Other device icons continue to follow Home Assistant. One shared glyph prevents the two views diverging; live state badges, colors and native AC controls remain functional.

152 frontend tests, formatting and build pass. Native browser checks verify identical viewer/card paths, persistence through live state updates, room/tray display and opening the Home Assistant climate dialog. Models, mappings and saved views unchanged; no persistent test views created. Private evidence retained outside package. Unreleased local preview only.

# Device anchor alignment — local preview, 2026-11-07

Removed the unconditional 24px rightward displacement of the icon's left edge. Icons now center on the projected model anchor at every size, matching the viewer dots. Existing explicit 3D offsets and viewport edge clamping remain supported.

Audited the actual imported GLBs: hallway light anchors are horizontally inside their fixture bounds; blind anchors sit at the top of the matching shutter, with a roughly 2.15cm separation from its thin mesh. Native browser checks confirm derived house/floor anchors equal source-room anchors transformed by the same member matrices used for the geometry. Across room/floor/house views, three sizes and top/rotated cameras, 168 visible non-clamped icon-center checks pass with maximum numerical error below 0.001px. Existing models, mappings and saved views unchanged. No page errors. No persistent browser test fixtures created.

152 frontend tests, formatting and build pass. This change is entirely frontend; the previous native backend suite remains applicable. Screenshots and detailed model audit are private local evidence. Local preview only; no HACS publication.

# View-wide device defaults — local preview, 2026-11-07

Added a Defaults for this view box for visibility, state labels, size and room/tray placement. Per-device overrides inherit untouched fields. Use view defaults clears appearance overrides while retaining position offsets. Existing saved customizations remain intact.

151 frontend tests and 13 native Core tests pass; host tests pass (38, with 13 native-only skips). Formatting and build pass. Native browser checks verify editing defaults, preserving individual overrides, restoring inheritance, saving settings, card preview and 390px layout. Original models/mappings/views unchanged; temporary view removed. No page errors. Private evidence remains outside the package. Unreleased; no version bump or publication.

# Buttons, floor plan and entity controls — local preview, 2026-11-07

149 frontend tests pass; 38 host Python tests pass with 13 native-only skips; all 13 native Core tests pass inside the existing singleton. Formatting and production build pass.

Native browser checks cover whole-house, floor and room creation, true top-down orthographic cameras from both toolbar and projection selector, saved marker presentation, entity buttons in previews and direct linked dashboard cards, and opening the native AC dialog from the whole-house view. Desktop and 390px layouts checked. Original models, mappings and saved views remain unchanged; temporary views and dashboard were removed. No browser page errors. Native command tests verify mapped services and reject unknown controls; the browser check did not change physical devices.

The previous room-only restriction below is superseded: all spaces support device buttons and per-view presentation. Private screenshots and scripts are retained in `.local/dashboard-workspace-evidence`. Unreleased local preview only; no version bump or HACS publication. Physical phones and production devices remain untested.

# Dashboard workspace — local preview, 2026-11-07

147 frontend tests pass; host Python tests pass with 13 native-only skips. Native browser checks and direct linked dashboard cards pass after restarting the singleton, with original rooms/mappings/views unchanged and disposable test content removed. See [workspace validation](docs/validation-dashboard-workspace.md). Built on the unreleased house-management preview, no new HACS release.

# House management and floor selection — local preview, 2026-11-07

Built on published 0.24.0 (99e15d6), without a new release or version bump. Source retained in .local/house-management; older root and full-house work preserved.

143 frontend tests pass; 38 host Python tests pass (13 native-only skips); tests cover atomic replacement, preview without mutation, compatible mappings/settings, conflicting IDs, stale confirmations, rollback and scoped deletion. Native Core 2026.10.2 tests pass, including administrator-only preview/replacement and house deletion. Browser checks saved a temporary floor-specific view and verified its model scope, cancelled deletion of the real house, then previewed/replaced/deleted a disposable synthetic house. Temporary view and house removed; original models unchanged. No browser page errors.

Existing test container, config and private AC helper retained. No production devices touched. No HACS publication; physical devices/phones untested.

# 0.24.0 — Full-house imports and workspace

Release checks pass; see [release validation](docs/validation-0.24.0.md) for artifact, native runtime and browser results and remaining limits. Persistent room catalog unchanged.

# 0.23.0 — houses, floors and room appearance

Release validation is recorded in [docs/validation-0.23.0.md](docs/validation-0.23.0.md). Frontend, host and native tests pass; the packaged integration loads with the persistent room catalog unchanged. See the report for scope and remaining limits.

# 0.22.0 release validation

Device-icon editing, 3D positioning, per-device presentation/Undo, shared thumbnails and responsive camera improvements. All 113 frontend tests, 18 host Python tests and 11 native Core tests pass; exact integration ZIP, restart persistence and a linked real dashboard verified. Original rooms/views retained. Release checks are recorded in [docs/validation-0.22.0.md](docs/validation-0.22.0.md).

# 0.21.0 release validation

- Dedicated Dashboard views gallery and focused view editor. All 92 frontend tests, 16 host Python tests and 9 native integration tests pass; the host-native skips were run separately in Core 2026.10.2.
- Exact integration ZIP tested through the singleton helper, retaining rooms/mappings/views. Gallery, direct creation, return navigation, device tab and empty state verified. Version, archive, privacy and frontend-reference checks pass. Details: [docs/validation-0.21.0.md](docs/validation-0.21.0.md).
- Production/physical devices and actual HACS download not tested.

# 0.20.0 release validation

- Dashboard previews, optional card titles and proportional thumbnails. All 91 frontend tests, 16 host Python tests and 9 native Home Assistant tests pass. The host skips the native tests; those were run separately in Core 2026.10.2.
- Exact integration ZIP staged in the existing singleton runtime, preserving persistent rooms/mappings/views. Package and direct dashboard rendering verified. Details: [docs/validation-0.20.0.md](docs/validation-0.20.0.md).
- No production/physical-device or HACS-download check.

# 0.19.0: Limestone & Clay UI

See [release validation](docs/validation-0.19.0.md) for isolated build, archive and native Home Assistant checks.

# 0.18.0: linked saved views and field overrides

See [release validation](docs/validation-0.18.0.md) for the isolated build, exact ZIP checks and native Home Assistant results.

# 0.16.0: adjustable desk device

- Original private office: verified tabletop heights 0.73 / 1.00 / 1.30 m, fixed feet, return to the measured 0.782 m rest pose, and browser slider persistence. Authoring build and all 8 viewer tests pass. Moving assembly retains existing object-edit paths.
- Imported ZIP: schema, GLB numeric rest metadata, daylight, and existing roller-shade validation pass. Tested imported motion at minimum, midpoint and maximum; cover percentage does not override centimetre height, and unavailable numeric state retains the last valid pose.
- Manager with disposable simulated entities: one desk card, one settings box containing all six entity mappings, four initially blank macro names, custom-name save/reload/clear, entity-icon state propagation, numeric set_value, cover open/stop/close and four distinct button presses pass. Browser error collection was empty. Simulated icon elements verified the supplied HA state objects; actual HA icon rendering is not native-runtime verification.
- HACS source: all 76 Node tests pass, including numeric bounds/steps/units, grouped-device roles, macro action dispatch, custom-name persistence and dashboard controls. Formatting check and manager/card builds pass. The Python suite passes 15 tests and skips 8 native HA tests on the host; these include added numeric and preset service tests.
- Native HA was attempted but unavailable: Docker Desktop's engine reports that dockerd exited before its API started. No real HA entities or household devices were contacted. All application versions are synchronized to 0.16.0 and integration bundles rebuilt for release. Native HA/device verification remains outstanding.
- Private room ZIP, photos and screenshots remain ignored/local. Existing standalone light/cover uploads keep their prior behavior. Native model replacement preserves custom macro names for surviving desk/macro IDs.

# 0.15.0: restored room navigation cube

- Restored the existing camera-linked cube to the main room viewport and removed its dependency on the saved-view editor’s Advanced section. Hidden while rooms load or after deletion.
- Frontend: all 70 tests pass (including tap versus drag, cancellation, keyboard rotation and camera framing checks); formatting check and manager/card integration build pass. The initial sandboxed test run could not bind localhost; rerunning with local networking permitted passed.
- Python: 13 tests pass, 6 native Home Assistant tests skip because Home Assistant is not installed in the host Python environment.
- Local standalone browser: cube visible in Devices; selecting Top updates its orientation; cube remains available in the saved-view editor with Advanced collapsed.
- Native Home Assistant, HACS installation, mobile devices and physical devices were not exercised for this frontend-only change. All application versions synchronized to 0.15.0 for release.

- Follow-up: reduced cube from 104px to 72px, removed Views picker, and verified a real browser drag rotates both room and cube without a pointer-release snap. Mouse/touch pointer capture and cancellation are handled; physical touch devices remain untested.

- Release artifacts: integration ZIP (21 files) and legacy source ZIP (67 files) pass archive integrity checks. Integration layout, manifest version and referenced frontend assets are verified; archives contain no private GLBs, photos, model-export folders, runtime data or credentials.

- 0.16.0 release archives: integration ZIP contains 21 files; source ZIP contains 74 files including the desk-device contract. Both pass archive integrity checks. Manifest/version, referenced frontend assets, bundled card, and private-asset exclusions verified. No household captures, model ZIPs, mappings or credentials are attached.
