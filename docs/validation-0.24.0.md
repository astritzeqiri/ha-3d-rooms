# 0.24.0 release validation — 2026-11-07

- Built from published 0.23.0 plus the latest full-house workspace and AC fixes in an isolated checkout. Original working tree and private assets retained.
- All 141 frontend tests, formatting and manager/card builds pass. Bundle-size advisory is informational.
- Host Python: 45 tests, 32 pass and 13 expected native skips. All 13 native tests pass separately in official Home Assistant Core 2026.10.2.
- All application versions are 0.24.0. Integration ZIP: 22 files; source ZIP: 108 files. Archive integrity, layout, bundled frontend and private-data exclusions pass. Source retains the existing synthetic sample-floor fixture.
- Exact extracted integration ZIP installed through the canonical singleton helper. Persistent configuration, three rooms, placements, bindings and views retained: catalog SHA-256 unchanged after upgrade. Private AC simulator retained separately, excluded from public assets.
- Fresh browser direct dashboard load, climate renderer, native manager AC state/dialog, whole-house overview, three-room sidebar and 390px mobile drawer pass with zero page errors. Screenshots retained privately outside Git.
- Actual HACS download, production HA, physical devices and phones were not tested. Local instance left running for user checks.
