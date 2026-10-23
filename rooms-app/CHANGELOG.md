# 0.9.1

- Use Home Assistant entity/state icons in dashboard circles, including custom icons and cover device classes.
- Show live On/Off, shade opening percentage and movement arrows, plus unmapped/unavailable badges. Keep badges visible near the bottom of a card.

# 0.9.0

- Add movable roller-shade imports, cover entity mappings, supported Open/Close/Stop/position commands, and opening height from Home Assistant state.
- Open native cover controls from the dashboard; retain the last visible shade height while a device is unavailable. Existing light controls and uploads stay compatible.

# 0.8.0

- Add a Home Assistant visual dashboard card editor: select a room or copy a saved component, change title, projection, rotation, tilt, zoom, height and camera interaction, and save without pasting YAML.
- Preserve existing saved camera snapshots and custom configuration while editing. Reset camera framing explicitly or when changing rooms/projections.
- Replace the hard-coded kitchen default with a choose-room prompt.

# 0.7.1

- Bundle an original teal and blue isometric room icon, with standard/high-resolution and light/dark assets for Home Assistant 2026.3 and newer.

# 0.7.0

- Allow direct orbit, pan and zoom in the component preview, synchronizing the fields and saved camera without reloading the model.
- Add a compact camera-linked view cube to both editors. Click six faces, twelve edges or eight corners; use Home to reset or the Views picker for keyboard/touch access. Fit and recenter on selection, with stable Top/Bottom orientation.

# 0.6.0

- Replace Add to dashboard's covering modal with a live component sidebar. Keep the room visible while adjusting its camera; on small screens, keep the preview above the controls.
- Add styled sliders and exact numeric inputs for rotation, tilt and zoom. Scene dragging updates the controls, and control edits update the scene immediately.
- Save a named component directly from the room view, including its exact orbit, pan, zoom and projection. Retain this framing when reopening, exporting or adding the component to a dashboard.
- Preserve existing component formats, room uploads and entity mappings. Support the full camera tilt range and responsive fitting in narrower cards.

# 0.5.0

- Add saved Home Assistant components with names, live room previews, independent rotation, tilt, zoom and card height, duplication and deletion.
- Export and import portable component settings, and copy dashboard configurations. Components share the original room model and device mappings.
- Add a compact 32 px bulb button beside each dashboard light. Click to toggle; hold to open Home Assistant more info. Keep a 44 px touch area.
- Save components in both the native integration and legacy add-on. Preserve existing models, mappings and component catalogs. Room merging remains a future feature.

# 0.4.1

Reduce model loading delays: compressed authenticated scene responses, private ETag revalidation, and a bounded session cache shared by the dashboard and model manager. Reuse concurrent downloads, invalidate after model replacement, retry failed requests, and show download/preparation progress. Preserve scene quality and existing uploads.

# 0.4.0

Consolidate model storage, upload, entity mappings, lighting controls, sidebar manager and dashboard card into a single HACS Integration. Automatically load the bundled card through Home Assistant. Add room exports carrying mappings for migration from the old add-on. Retain the add-on as a migration/development path.

# 0.3.2

Keep every wall visible from every camera angle in both the dashboard card and app viewer.

# 0.3.1

Use a front-facing perspective by default, keep the actual pendant visible in cutaway views, and open native Home Assistant controls when clicking mapped fixtures. Include keyboard access and a local light-control preview. Keep the previous floor camera available with view: floor.

# 0.3.0

Add a clean overhead floor view and a native Home Assistant dashboard card without entity icons. Keep private models in the add-on, load them with a HA Ingress session, and reflect live lighting from dashboard state. Add model-specific dashboard setup/download, camera framing and authenticated transport tests. Local generated ZIPs now save in the app project's model-exports folder.

# 0.2.0

Add capability-aware RGB color, Kelvin white temperature, device effects and fade settings. Reflect reported color in the 3D fixture and emitted light. Enforce supported features and temperature limits on the backend, preserve compatibility with existing packages, and add capability/conversion/API tests.

# 0.1.0

Initial model library, prepared ZIP/GLB imports, stable light metadata, entity mapping, preview lighting and Home Assistant WebSocket bridge. Includes Ingress packaging and persistent model storage. This is an early build pending HA OS device validation.
