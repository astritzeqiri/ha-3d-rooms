# Buttons, floor plan and entity controls — local preview, 2026-11-07

149 frontend tests pass; 38 host Python tests pass with 13 native-only skips; all 13 native Core tests pass inside the existing singleton. Formatting and production build pass.

Native browser checks cover whole-house, floor and room creation, true top-down orthographic cameras from both toolbar and projection selector, saved marker presentation, entity buttons in previews and direct linked dashboard cards, and opening the native AC dialog from the whole-house view. Desktop and 390px layouts checked. Original models, mappings and saved views remain unchanged; temporary views and dashboard were removed. No browser page errors. Native command tests verify mapped services and reject unknown controls; the browser check did not change physical devices.

The previous room-only restriction below is superseded: all spaces support device buttons and per-view presentation. Private screenshots and scripts are retained in `.local/dashboard-workspace-evidence`. Unreleased local preview only; no version bump or HACS publication. Physical phones and production devices remain untested.

# Dashboard workspace — local preview, 2026-11-07

Built from the unreleased `.local/house-management` preview, preserving its 0.24.0 base and house actions. Active source and compiled package: `.local/dashboard-workspace`. No version bump or public release.

## Behavior

- Top-level My home and Dashboard views navigation. Room/house setup no longer exposes separate view-creation tabs or buttons.
- Global gallery with search, house/floor/room filters, thumbnails and one New view flow. Includes existing views without changing IDs/storage.
- Unified whole-house, floor and single-room chooser. Changing a saved view’s space retains its ID, name, height and linked cards; framing and device presentation reset.
- Import/export/duplicate/delete, direct saved-view links, phone/desktop card preview, dirty-navigation guards, and recovery of an unsaved draft after a failed scope download.
- Empty-state handling for no models; standalone-room scope choices covered by unit tests. Arbitrary room combinations remain future work. House/floor views retain live appearance; device-button tools remain room-only.

## Verification

- 147 frontend tests pass. Includes global filtering, standalone rooms, missing references, preserved view identity and framing only after the editor is visible.
- Host Python: 51 discovered, 38 pass and 13 native-only skips. Backend code unchanged; native-only Python suite was not rerun for this UI change.
- Formatting and manager/card integration builds pass; change-specific whitespace checks pass. Existing Three.js bundle-size advisory remains.
- Native Core 2026.10.2 in the single managed `three-d-rooms-homeassistant` container: browser verified room/floor/house creation and save, scope change with the same saved ID, direct saved links, global search/filter, discarded/cancelled navigation, desktop/phone preview, import/export/duplicate/delete, and simulated download-failure recovery retaining unsaved title.
- Browser verified direct linked floor, house and room dashboard cards after a restart of that same container. All three models finished rendering; saved component IDs/configurations survived. Original model catalog and saved views matched before/after. Test views and dashboards removed; no entity commands or mapping changes.
- Desktop gallery/editor and 390px phone chooser visually reviewed; no phone horizontal overflow. No observed browser page errors. Physical phones/devices, production HA and HACS download flow untested.

Private screenshots, browser scripts and portable source patch are retained separately in `.local/dashboard-workspace-evidence/`. The singleton remains running for user review with the new preview; no additional containers/configs/ports were created.

## Searchable space selectors — follow-up

The shared house/floor/room chooser now supports name search, pointer selection and Arrow/Enter keyboard selection. Search does not change the committed selection; Escape dismisses results without closing the dialog. Tab and outside interaction dismiss results, and a new scope/opening clears the query. No-match feedback is announced and Enter cannot accidentally submit an empty result.

147 existing frontend tests, formatting and rebuilt integration bundles pass. Native browser verified all three space types, overlapping names, no matches, Escape/Tab behavior, selected-room editor loading and dark desktop/390px mobile layouts. Screenshots visually reviewed; no horizontal overflow or browser errors. No saved views, models or mappings were changed. Same local preview remains running; not released to HACS.
