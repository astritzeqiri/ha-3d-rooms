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
