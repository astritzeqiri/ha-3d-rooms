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
