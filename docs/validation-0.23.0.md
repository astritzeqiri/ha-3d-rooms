# 0.23.0 release validation — 2026-11-07

- Prepared in an isolated checkout based on published 0.22.0 commit 608eddd9e7a50b6d79a399feb1af9c0401383668. Original workspace edits, private scans and exports are excluded.
- Includes independent room house placement, native HA floor links, multi-floor height clipping, presentation-only house dashboard views, optional room architecture, hinged-door/binary-cover fixes and prepared climate controls.
- All 128 frontend tests pass; Prettier format check and manager/card integration build pass. Host Python: 27 pass, 12 native tests skip (39 total). Ruff is unavailable on the host.
- Exact integration ZIP extracted and staged through the original checkout’s singleton helper into the existing three-d-rooms-homeassistant container. All 12 native tests pass on official Core 2026.10.2, including native floors, room settings/appearance, house command rejection, caller context, room replacement and saved-view persistence.
- Native browser: authenticated sidebar loads retained room library and live room controls. Persistent catalog SHA-256 is unchanged after package upgrade/restart and native tests. No library upload, room replacement, mapping edit or dashboard save was performed during release checks. The existing library currently contains independent rooms; house/floor behavior is exercised using temporary native test state.
- All application versions agree on 0.23.0. Integration ZIP contains 22 files and complete manager/card assets; legacy source ZIP contains 99 files. Archive integrity, version, layout, compiled asset references and privacy exclusions verified.
- Integration SHA-256: e030b16b95082caf1b73b3758ed9806be8736d451766326c0060a05617774535.
- Source SHA-256: 4c672634c781e05cec535c55b991581903fca8f3d9c5afbb9cd6b5553bcd0006.
- No production HA OS/Proxmox, physical device, iPhone or actual HACS download/update test. Old hallway geometry requires a new split-wall model export to expose its optional upper wall; normal integration upgrades preserve other rooms and mappings.
