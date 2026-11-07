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
