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
