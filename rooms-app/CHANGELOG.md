## 0.29.0

- Windows, doors and shades can now be connected to door/window contact sensors (`binary_sensor` with device class door, window, opening or garage door), not only `cover` entities. The sensor's state shows as Open/Closed and moves the window or door in the 3D room. Sensors are read-only, so open/close buttons stay disabled for them. Desk controls still require a `cover`. Existing mappings are unchanged; no migration is needed.

## 0.28.0

- House and floor views show the Auto/Day/Night switch again. They combine every room's daylight windows at their placed positions, and changing the time of day on a house or floor card saves it to each room it shows. No migration is needed.
- Room Devices view redesigned as a compact list:
  - One slim row per device: type icon, name, status (for example "On · 71%", "70% open", "Not connected") and a quick action. That is a toggle for lights, ▲ ■ ▼ for shades, Closed/Open for windows and doors, or Connect when no entity is linked.
  - Clicking a row expands the full controls in place, one at a time, and highlights the device in 3D.
  - Sections fold and show counts ("4 of 9 on · 5 need an entity").
  - A ⋯ menu on each row holds entity/group and Hide device, and one Group devices menu replaces three header buttons.
  - Rows stay on one line at phone width, and the phone search box no longer grows to 200px tall.
- Group shades and group windows & doors, alongside light groups. In a room's Devices tab, choose two or more shades (roller shutters) or windows/doors (hinged or sliding leaves) to share one Home Assistant `cover` entity. They show as one control and move together, with the same editing, ungrouping and binding restoration as light groups. A group holds one kind of device (lights with a `light`/`switch` entity, covers with a `cover` entity). Existing light groups and their storage are unchanged, so no migration is needed.
- Sliding doors: room packages can mark a cover root with `slidingDoor` motion (`axis: "x"`, `closedOffset`, `openOffset`, `defaultPosition`). The leaf translates along its parent's local x between the two rest positions, works with binary open/closed covers, and is validated on import (unique root, children, 0–5 m travel, not combined with a hinge).
- House and floor dashboard cards show bottom-right floor buttons (All plus one per floor). The house loads once and floors switch instantly in place, with no reload or extra download. The choice is per card and per browser session; it never changes the saved card or room. Turn it off with `floor_selector: false` or in the card editor; a floor card with the switcher off still loads only its own rooms.
- Cards gain bottom-right Move camera and Reset view buttons, in one toolbar with the floor buttons, Reload and fullscreen (floors wrap above on narrow screens). Move camera starts from the card's camera-movement setting and only changes this session; Reset view returns to the card framing. Hide them with `camera_controls: false` or in the card editor.
- Floor-plan cards pan with a one-finger or left drag when camera movement is on, and locked cards let phones scroll the page over the 3D view.

## 0.27.0

- Reuse decoded models between dashboard cards and tab revisits, with session isolation, revision keys, bounded memory and retry after failure.
- Add a bottom-right Reload models control beside fullscreen to clear the session cache and reload the active view.

# 0.26.0 — room device management

- Group modeled lights into one named control connected to a shared Home Assistant entity. Edit or ungroup while retaining original fixtures and connections.
- Hide devices globally from their room’s Devices screen; only Show device in that room restores them. Covers room, floor, house, dashboard trays and view editors.
- Click a device bubble on the Devices screen to open its settings or light-group editor.
- Retains the 0.25.1 rendering fix and existing fullscreen/auto-height features.

# 0.25.1 — Restore textured floors and furniture

- Prevent missing surfaces when fixture and daylight shadow maps exceed the graphics device’s texture limit.
- Budget shadows against material textures and device capacity in both the manager and dashboard card. All lights remain visible and controllable.
- Existing uploaded rooms work without re-exporting or re-uploading.

# 0.25.0 — Dashboard workspace and device presentation

- Dashboard cards can fill the available screen height with `height: auto`, selectable in the visual card editor.
- Added a fullscreen button in supported browsers; device dialogs return to the normal dashboard.


- Edit linked card fields directly, with a small per-field Reset action only for changed values. Remove the repeated override checkboxes; resetting or typing the inherited value restores the saved-view link for that field.

- Use the viewer’s wall-mounted AC icon in dashboard device controls, including the tray and live entity updates.

- Center device icons on their projected model anchors in the view configurator and dashboard cards; remove the unintended rightward screen offset while retaining explicit position overrides.

- Set view-wide device defaults for visibility, state labels, size and room/tray display; override individual devices or restore inheritance without resetting their position.

- Refine workspace navigation, action buttons, focus states and phone layouts.
- Make Floor plan switch directly to a true top-down orthographic camera.
- Show and configure device buttons in whole-house and floor views, retaining source-room entity connections and saved presentation settings.

- Preview and replace a complete house ZIP atomically, preserving matching room identities, compatible mappings and settings.
- Review and delete an entire house, including its rooms and saved views, without deleting Home Assistant devices.
- Reject stale confirmations if the library changes; preserve unrelated houses and rooms.
- Search house, floor and room names in the shared space chooser, with keyboard selection and clear no-match feedback.
- Create every view in a top-level Dashboard views workspace, alongside My home. Browse all existing views with search and house/floor/room filters.
- Use one space chooser and camera editor for whole houses, floors and individual rooms. Exported floors remain available without requiring Home Assistant floor links.
- Change a saved view’s space without changing its identity or breaking linked dashboard cards; preserve drafts on cancelled navigation or a failed model download.
- Import, export, duplicate and preview saved views from one global gallery. Existing storage, room mappings and saved-view IDs remain compatible.

# 0.24.0 — Full-house imports and workspace

- Import a complete house ZIP with all rooms, placements, floors and mappings in one atomic operation; invalid or duplicate imports leave the library unchanged.
- Navigate houses with a compact room sidebar, floor filter and phone drawer; inspect and highlight rooms in the combined house view.
- Preview ZIP contents before import, group devices by type, and select Simulation or Live controls explicitly.
- Correct camera fitting for positioned rooms and retain existing room identities, mappings and saved views.
- Keep AC state and native controls available in the manager; show climate mode effects on prepared models and correct AC icons/status in the dashboard-view editor.

# 0.23.0 — Houses, floors and room appearance

- Assemble independently imported rooms using portable house placement and floor metadata; retain each room’s identity, controls and mappings.
- Choose Home Assistant floors for whole-house dashboard views. Multi-floor rooms are clipped to the selected floor’s saved height range.
- House/floor views expose presentation settings only. Device setup and actions remain in individual rooms; composed models retain live room appearance.
- Room appearance can show or hide optional architectural sections. Updated hallway exports separate the wall above the entrance from the entrance door and casing.
- Preserve compatible placement, floor, appearance and entity settings when replacing a room.
- Support prepared hinged-door cover motion and binary-cover state; prepared AC controls open Home Assistant’s native climate dialog.

# 0.22.0

- Customize each device icon independently in a saved dashboard view: visibility, state label, size and room/below-room placement.
- Drag room icons directly onto model surfaces. Use Position for click-to-place, reset or precise X/Y/Z offsets. Changes remain anchored in 3D and follow moving devices.
- Open compact fan-out actions by selecting an icon: Undo, Edit icon, Position and an eye for visibility. Undo affects only the selected device during the editing session. Clicking outside clears selection and focus.
- Keep hidden controls faded and selectable in the editor with a Hidden pill while omitting them from dashboard cards. Centre native Home Assistant symbols at every icon size.
- Preserve authored camera framing across editing, saving and resizing, improve phone/tablet layouts, and store bounded thumbnails with saved views so galleries share the same previews.
- Existing rooms, mappings and saved views remain compatible; no re-import is required.

# 0.21.0

- Make Dashboard views a dedicated room-scoped gallery with a saved-view count, Create view and Import actions, and a helpful empty state.
- Show the room canvas on this tab only when creating or editing a view. Back to views returns to the gallery and restores keyboard focus.
- Initialize camera framing after revealing the editor, so creating from a directly opened gallery works reliably.
- Keep Room & devices focused on its live room overview and device controls. Preserve existing rooms, mappings, saved views and dashboard cards without migration.

# 0.20.0

- Add Preview in dashboard to the view editor and each saved-view card. Preview current unsaved settings in the actual Home Assistant card without saving or changing a dashboard.
- Switch between desktop and phone card widths with aligned segmented controls; close the preview with the accessible close button or Escape and return to the same view.
- Add Show title on card in both view editors. New saved views hide the header by default; existing views keep their appearance until changed. Linked cards inherit the setting with per-card overrides.
- Preserve room proportions in higher-resolution thumbnails and repair older cached thumbnails when saved camera proportions are available.
- Keep existing rooms, mappings, saved views and dashboard configuration compatible. No re-upload or storage migration is required.

# 0.19.0

- Give the manager a warm Limestone & Clay identity: limestone/paper surfaces, terracotta actions, a charcoal dark palette, local serif room titles and a geometric room mark.
- Replace glowing surfaces and pill-shaped actions with quiet borders and compact rectangular buttons; unify the room stage on warm charcoal.
- Make device on/off switches slimmer with a 36 × 20 px track and 16 px thumb, retaining a 44 × 44 px touch target, keyboard support and explicit state labels.
- Preserve rooms, entity mappings, saved views and dashboard configurations; no model re-upload or storage migration required.

# 0.18.0

- Keep dashboard cards linked to their saved view. Changes saved in 3D Rooms update linked cards automatically, including exact camera framing. Generated YAML references the saved view ID.
- Add a per-field Override for this card checkbox, with an information icon explaining inheritance and overrides on hover or keyboard focus.
- Show Reset to view beside changed fields to remove that override and resume following the saved view. Numeric camera overrides retain the saved composition.
- Preserve existing standalone cards, uploaded rooms, entity mappings and saved-view storage. Select a saved view in an existing card to link it.

# 0.17.0

- Add an actual byte-based upload percentage and progress bar for room imports and replacements, with distinct processing and preparation stages.
- Simplify the room workspace: compact room navigation and device setup summary, clear Room & devices / Dashboard views / Settings tabs, and camera controls beside the model.
- Fix macro entity icons in the native Home Assistant manager: resolve the HA icon in its own document and send plain SVG data to the manager frame. This avoids cross-document stylesheet errors and preserves the entity's icon.
- Show Uploading model… and Preparing 3D view… as separate replacement stages.
- Verify the released desk model inside Home Assistant Core 2026.10.2: all eight native tests, local helper mappings and real manager replacement pass. Existing rooms and mappings remain compatible.

# 0.16.0

- Add an Adjustable desk device with one card and settings box for height, Up/Stop/Down, and four optional macros. Macro names start blank and are user editable; icons follow the mapped entities.
- Add centimetre number mappings and rest-based 3D desk motion, plus typed button/script/scene actions. Existing room mappings remain compatible.

# 0.15.0

- Restore the camera-linked navigation cube in the main room viewer and keep it visible when creating or editing saved views, including with Advanced camera settings closed.
- Make the cube smaller (72px), remove the Views picker, and add drag-to-rotate with mouse or touch. Arrow keys also rotate; clicking faces, edges or corners still snaps the view, and Home resets it. Dragging preserves camera distance, zoom and center.
- No storage, API or backend changes.

# 0.14.1

- Fix the entity list in the connect-devices dialog being clipped to about one item in the single-device dialog. The list now floats over the dialog, matches the field's width, can extend past the dialog edge, opens upward when there is no room below, and no longer makes the dialog resize or jump.
- Replace the unlabeled crosshair button with a labeled **Show in room** button, and keep the disconnect (×) button on the field. The single-device dialog now says "this device" instead of "each device".
- No storage, API or backend changes.

# 0.14.0

- Redesign the room manager with a new Slate & Teal look: soft rounded surfaces, light and dark themes that follow the system setting, and teal marking anything that is on, active or focused. Lit lights glow on their device card, and on/off is a sliding toggle.
- Add a room status strip with lights on, a "n of m connected" progress bar and a Connect devices button. Room list entries show how many devices are connected.
- Make device cards compact: colour, white temperature, effects and fade sit behind a collapsible row that remembers its state, brightness shows its percentage, and unconnected devices offer a Connect an entity button. Clicking a card highlights that device in the 3D room.
- Rooms with five or more devices get All / On / Off / Needs entity filters and a search box.
- Replace the filter input and select in the entity dialog with one searchable entity field. It suggests entities whose names match the device, shows each entity's state, can be driven from the keyboard, and disconnects with a clear button. The dialog has a fixed header and footer, device icons, and a locate button in place of Highlight. Dialogs also close when you click outside them.
- Show a Preview or Live badge next to the device count, make Preview mode a labelled switch, show a spinner while a room loads, and let toasts be dismissed with a click.
- No storage, API or backend changes; rooms, mappings and saved views are unchanged.

# 0.13.0

- Show a compact Auto / Day / Night dropdown in the corner of the rendered dashboard card for rooms with daylight windows. Choosing a mode lights the room immediately and saves it to the room's daylight settings, so other dashboards and the manager follow. Daylight-only changes update cards in place instead of reloading the 3D scene; a failed save reverts the dropdown and shows an error.

# 0.12.0

- Add a Time of day switch (Automatic, Always day, Always night) to the dashboard card editor. It saves to the room's daylight settings, so the card, other dashboards and the manager stay in sync.
- Add Replace room model in Room settings. Upload an updated room ZIP to swap the 3D model while keeping the room's ID, name, area, daylight setting, saved views and every device mapping that still matches; mappings for removed or type-changed devices are dropped and reported.

# 0.11.1

- Style room-name and other plain text/number inputs consistently with the dark form controls, with rounded borders, readable padding and a 44px minimum height. Align room-name and area-field spacing.

# 0.11.0

- Organize the manager around rooms with Devices, Saved views and Room settings tabs.
- Replace duplicate camera editors with one shared editor, basic presets and advanced precise controls. Add a clear Save view → Use in dashboard flow, with optional YAML.
- Rename rooms and link them to existing Home Assistant areas. Validate area IDs and preserve room geometry, mappings and saved views; keep area associations installation-local.
- Preserve room navigation across refreshes, protect unsaved changes and retain portable saved-view JSON compatibility.

# 0.10.1

- Add an entity-settings cog on every device card, opening a focused editor with compatible entity choices and automatic saving.
- Redesign shade actions and percentage sliders; keep controls and long entity names inside responsive cards.

# 0.10.0

- Add independent Day/Night/Auto window daylight, shade-dependent illumination, sun-entity state updates and persistent room environment settings.

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
