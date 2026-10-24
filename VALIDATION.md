# 0.15.0: restored room navigation cube

- Restored the existing camera-linked cube to the main room viewport and removed its dependency on the saved-view editor’s Advanced section. Hidden while rooms load or after deletion.
- Frontend: all 70 tests pass (including tap versus drag, cancellation, keyboard rotation and camera framing checks); formatting check and manager/card integration build pass. The initial sandboxed test run could not bind localhost; rerunning with local networking permitted passed.
- Python: 13 tests pass, 6 native Home Assistant tests skip because Home Assistant is not installed in the host Python environment.
- Local standalone browser: cube visible in Devices; selecting Top updates its orientation; cube remains available in the saved-view editor with Advanced collapsed.
- Native Home Assistant, HACS installation, mobile devices and physical devices were not exercised for this frontend-only change. All application versions synchronized to 0.15.0 for release.

- Follow-up: reduced cube from 104px to 72px, removed Views picker, and verified a real browser drag rotates both room and cube without a pointer-release snap. Mouse/touch pointer capture and cancellation are handled; physical touch devices remain untested.

- Release artifacts: integration ZIP (21 files) and legacy source ZIP (67 files) pass archive integrity checks. Integration layout, manifest version and referenced frontend assets are verified; archives contain no private GLBs, photos, model-export folders, runtime data or credentials.
