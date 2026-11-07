# 0.25.1 validation

The native renderer previously exceeded the 16 fragment texture-unit limit with combined fixture/window shadows, causing textured floors and furniture to disappear. The shared manager/card renderer now reserves slots for material and renderer textures, then limits shadow maps. Every light remains active and controllable; window shadows take priority, followed by stronger fixtures.

- 155 frontend tests pass, including shadow budgeting and existing house/floor coverage.
- Formatting and manager/card build pass.
- Host integration tests: 38 passed; 13 native-only tests skipped on the host.
- Original and optimized room exports preserve their geometry. No exporter or storage schema changes.
- Native browser checks cover the whole-house view, individual living room and real dashboard card with no shader/console errors. Card checks use a temporary in-memory configuration, without saving dashboard changes or sending device commands.
- Production HA OS, physical devices and the HACS client update flow are not exercised locally.

## Release artifact check

All six application version values agree at 0.25.1. Both release ZIPs were inspected for package structure and absence of private models, credentials, runtime files and dependency directories. The extracted integration frontend was served into the authenticated native Home Assistant browser for the whole-house, living-room and real card checks. The shared container was deliberately not replaced because separate light-grouping verification is in progress; the backend is unchanged apart from its version constants.

The final browser environment reports two unhandled `unknown_command` responses from Home Assistant. An independent check of the existing installed preview reproduces the same two responses. The packaged renderer has no shader/texture-unit errors and restores the floor and furniture. No saved model, mapping, view or entity state was changed by the checks.
