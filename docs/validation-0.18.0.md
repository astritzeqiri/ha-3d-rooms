# 0.18.0 release validation — 2026-10-26

Prepared from published 0.17.0 in an isolated checkout; unrelated local workspace changes are excluded. All application versions are synchronized to 0.18.0.

- 87 frontend tests pass; formatting and whitespace checks pass. Manager/card integration bundles rebuilt after the version bump.
- Host Python: 15 tests pass and 9 native tests skip because Home Assistant is unavailable in host Python. All 9 native tests pass against the extracted integration ZIP in the existing shared Home Assistant Core 2026.10.2 container, including successful-save notifications and failed-save behavior.
- Exact integration ZIP and retained source ZIP inspected: expected paths and version, complete frontend, no private rooms, runtime config or credentials. Application branding icons are included.
- Native smoke check passes against the extracted integration ZIP: setup/sidebar, automatic bundled card serving, authenticated scene/export/replacement, ETag 304, simulated RGB/brightness/off/temperature commands and invalid-setting rejection. First attempt encountered an existing old kitchen fixture with different control IDs; after replacement normalized that local fixture, the complete rerun passed and matching mappings survived replacement.
- Prior native visual editor verification of the same feature source: saved title/rotation/height update while overridden Zoom remains fixed; unchecking or Reset to view restores inheritance. Information tooltip appears on keyboard focus, and changed fields reveal their reset button. Disposable view removed and dashboard edit cancelled.
- No storage schema migration or room re-upload required. Existing standalone card configurations remain valid; selecting a saved view links an existing card. Actual HACS download, production HA, mobile browsers and physical devices were not exercised.
