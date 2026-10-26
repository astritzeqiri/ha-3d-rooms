# 3D Rooms

**One HACS integration for your 3D rooms, model library, entity mappings, and dashboard card.** No separate add-on, container, Ingress session, or access token is required.

Upload a prepared room or floor ZIP, connect its declared lights to Home Assistant light/switch entities, and view it on a dashboard. Click the physical modeled fixture to open Home Assistant's own light controls. Brightness, RGB color and white temperature follow the entity's reported state. All walls stay visible; a minimum ambient level keeps unlit rooms readable.

## Integration icon

![3D Rooms icon](custom_components/three_d_rooms/brand/icon.png)

The integration bundles its own transparent icon for light and dark themes. Home Assistant 2026.3 and newer supports these local brand images; older versions and some HACS views may still display a placeholder. The editable icon generator is in `branding/generate-icons.py` (Pillow required).

## Install

1. In **HACS → ⋮ → Custom repositories**, add `https://github.com/astritzeqiri/ha-3d-rooms` with type **Integration**. Download **3D Rooms**.
2. Restart Home Assistant.
3. Open **Settings → Devices & services → Add integration → 3D Rooms**, then confirm setup.
4. Refresh the browser and open **3D Rooms** in the sidebar.
5. Choose **Import room**, upload your room ZIP, and connect its controls under **Devices** using each device’s cog.
6. Add the dashboard card through the visual editor below. Its code loads automatically with the integration; do not install a second HACS Dashboard repository or create a separate resource entry.

This release requires a Home Assistant administrator account for both the model manager and dashboard. Tested in Home Assistant Core **2026.10.2** in a separate container; the user's HA OS/Proxmox VM and physical lights still need installation checks. It uses native Core APIs and does not require Supervisor.

## Dashboard card

Choose **Edit dashboard → Add card → By card → 3D Rooms**. Select a room or a saved view, adjust the title, view, rotation, tilt, zoom and height, then click **Save**. Home Assistant shows a live preview. Existing cards also open in this visual editor.

Rooms with daylight windows show an **Auto / Day / Night** dropdown in the card's top-right corner. Choosing a mode applies instantly and is saved with the room, so every dashboard and the manager share it; other open dashboards update without reloading the 3D scene. The editor also has a **Time of day** switch (Automatic, Always day, Always night) for the selected room. It is saved with the room rather than the card, so every dashboard and the manager share it; it appears for rooms with daylight windows.

Selecting a saved view copies its current configuration into the card; later edits to the original view do not change that dashboard card. Title and height edits preserve exact saved camera framing. Changing the room or projection, or choosing **Reset camera framing**, starts a new framing.

For manual configuration, **Edit dashboard → Add card → Manual** still supports:

```yaml
type: custom:three-d-rooms-card
model: kitchen
height: 600
view: front
tilt: 28
heading: 0
```

Use the actual model ID from your room package, or copy a ready-made configuration from **Saved views → Use in dashboard → Advanced YAML**. Add another card with another model ID to show a different room or floor.

- `view: front` is the angled perspective. `view: floor` is orthographic.
- `tilt` is degrees away from overhead (0–180). `heading` rotates around the floor's vertical axis.
- `zoom` scales the room (0.01–100; default 1).
- **Create dashboard view** opens the shared camera editor beside your room. Choose a preset or drag, pan and zoom, name the view, and choose **Save view → Use in dashboard**. The navigation cube stays visible in the room viewer. Precise camera controls and card height are under **Advanced camera settings**. Generated YAML uses `saved_view: <view-id>` to follow the saved view, including its exact camera framing. In the card editor, check **Override for this card** beside any field to customize it. The information icon explains how overrides work. **Reset to view** removes a changed field’s override and follows the saved view again. Existing standalone cards keep their values until you select a saved view.
- `height` is pixels (180–1600). Optional `title` adds a heading.
- `interactive: true` enables camera movement. Fixtures remain clickable when camera movement is locked.
- The room reads entity mappings from the integration; there are no floating entity icons.

## Move from the old add-on + HACS card

The add-on's `/data` directory is separate from Home Assistant Core. Models cannot be silently read from it. Move them using ZIP packages:

1. Keep the old add-on until the new library works. Update it to **0.4.0** to get the migration export.
2. In the old add-on, select a room, open **Model settings → Export room & mappings**. Repeat for each model. These ZIPs include embedded scenes and saved entity mappings.
3. If you downloaded the old **Dashboard** repository in HACS, remove that frontend download, then remove/re-add this custom repository with type **Integration**. This affects the old card code; it does not remove the separately installed add-on's data. Do not remove the add-on yet.
4. Install the integration using the steps above. Upload the exported ZIPs in the new **3D Rooms** sidebar. Their mappings are restored. Missing entity IDs remain visible as unavailable until remapped.
5. Remove old `/local/three-d-rooms-card.js` and `/hacsfiles/ha-3d-rooms/ha-3d-rooms.js` **resource entries**, if present. The integration loads the included module automatically. Refresh the browser to clear the old definition.
6. Existing card YAML still works with the same model IDs. Remove any old `addon:` setting to use the integration.
7. Verify your room and lights in the integration before stopping or uninstalling the old add-on.

If you have the original model ZIP already, upload it directly. Original ZIPs do not contain entity mappings, so connect those again under Model settings. Locally generated packages live in **`model-exports/`** at the root of this app project, including `kitchen.zip` and `sample-floor.zip`; they are excluded from GitHub.

If your old add-on was installed by copying source into `/addons/`, replace its source with the matching 0.4.0 migration source package, rebuild and restart it to get the export action. Repository-installed add-ons can update through the Add-on Store. The legacy source is retained only for development and migration; it is not needed once the integration is working.

## Model packages

A ZIP contains `manifest.json` and an embedded glTF 2 `scene.glb`. A migration export also contains `bindings.json`. No JavaScript or remote asset URLs are accepted. Coordinates use meters and Y up.

```json
{
  "schemaVersion": 1,
  "id": "my-floor",
  "title": "My floor",
  "units": "meters",
  "up": "Y",
  "scene": "scene.glb",
  "ambient": 0.22,
  "controls": [{
    "id": "ceiling",
    "type": "light",
    "label": "Ceiling light",
    "position": [0, 2.3, 0],
    "nodeIds": ["ceiling-fixture"],
    "capabilities": ["on_off", "brightness", "color", "color_temp"]
  }]
}
```

A fixture group in the GLB uses `extras.controlId: "ceiling-fixture"`. Imported models retain existing ceiling/wall metadata. The native HA dialog exposes capabilities supported by the mapped entity. The manager also validates light capabilities, numeric ranges and advertised effects before calling HA services. Color temperature in the 3D renderer is a visual approximation.

Uploads are capped at 100 MB compressed/300 MB expanded, 2048 files and 200 controls. Import rejects duplicate IDs, traversal, symlinks, executable payloads, external glTF assets and missing referenced control nodes.

## Storage and authentication

Private models and mappings are stored in `config/.storage/three_d_rooms/`, separate from the integration source, so HACS code updates do not replace them. Include this folder in your normal Home Assistant backups. Model exports also provide a portable backup. Unloading/removing the integration retains this library for recovery; removing a model in the manager deletes that model.

Only frontend code is exposed as static files. ZIP upload, export, scene download and model metadata require the current authenticated administrator. Private scenes are fetched with HA session authentication and passed to Three.js as temporary blob URLs. No model ZIPs, household GLBs, capture photos, tokens, or entity mappings are published in this repository.

## Local development

- `custom_components/three_d_rooms/`: complete HACS-installable Python integration and compiled frontend.
- `rooms-app/`: retained viewer, card, model exporter and optional legacy development server.
- `integration-tests/`: pure Python archive/storage tests and an explicit localhost-only Home Assistant smoke check.

From `rooms-app`, run `npm ci`, `npm run dev`, `npm test`, and `npm run build`. The build bundles the manager and card into the integration's `frontend/` folder. Commit those generated files so HACS installations do not need Node or a frontend build step.

Run `python3 -m unittest discover -s integration-tests -v` from the repository root. The isolated runtime checks are described in `VALIDATION.md`.

The legacy card can temporarily use an explicit `addon: YOUR_ADDON_SLUG` while migrating. New installations should omit that setting and use the native integration.

## Model loading (0.4.1)

Scene downloads are gzip-compressed and use private authenticated ETag revalidation. A session cache shared by the sidebar manager and dashboard deduplicates requests for the same model revision (up to 64 MB retained, five-minute expiry). Replaced models get a new revision; failed downloads can retry. Scene files remain authenticated; the original model and textures are unchanged. The server creates a compressed derivative beside each original scene on first use.

The first load still transfers the model and prepares it for the GPU. Subsequent visits reuse it when possible. Existing uploaded rooms do not need to be uploaded again after updating.

### Light shortcuts and room angle

Each dashboard light has a bulb button beside its modeled position. Click the
button to toggle its bound light; hold for half a second to open Home Assistant's
more-info dialog. Clicking the fixture itself still opens more info. Keyboard
users can toggle with Enter or Space and open more info with Shift+Enter or F2.
Unavailable or unbound lights do not send commands.

## Room workspace and Home Assistant areas

Choose a room in **Your rooms**. Its workspace has three tabs:

- **Devices**: control lights and shades and use each device’s cog to assign a compatible entity.
- **Saved views**: create, edit, duplicate, import or export dashboard views for this room. All views share the room’s device mappings.
- **Room settings**: rename the room, assign an existing **Home Assistant area**, configure daylight, replace the room model, and find advanced entity mapping/export/removal actions.

Assign an area under **Room settings → Home Assistant area → Save room settings**. Create areas in Home Assistant first, then use **Refresh areas** if needed. This links the imported 3D room to an area; it does not move or automatically reassign devices. Area IDs remain local to this HA installation and are excluded from portable room exports.

To create a dashboard card, choose **Create dashboard view**, frame the room, and save it. **Use in dashboard** explains how to select it in **Edit dashboard → Add card → 3D Rooms → Saved view**. YAML is available under Advanced for manual cards. Existing cards keep their copied settings; reselect the saved view after editing it to update a card.

**Export view** downloads a small `.component.json` file. **Import saved view** opens a new draft for review and saving. These files reference room IDs and do not include geometry or entity mappings: import the matching room first on another installation. The existing versioned JSON format and saved view IDs remain compatible. Saved views persist on the server across restarts; optional preview thumbnails stay in the current browser.

### Updating to 0.5.0

In **HACS → 3D Rooms**, download/update to **0.5.0**, restart Home Assistant itself, then refresh the browser. The bundled manager and card update together. Existing room uploads, entity mappings and saved views remain in place; no model re-upload is needed.

### Updating to 0.6.0

Update **3D Rooms** in HACS, restart Home Assistant, then refresh the browser. **Add to dashboard** opens the live component sidebar. Existing rooms, mappings, and saved views remain compatible; no re-upload is needed.

### Editing the camera directly

The saved view preview supports dragging to rotate, scrolling to zoom and right-dragging to pan. These changes update its fields and exported configuration; choose **Save view** to persist them. The room viewer and saved view editor share an always-visible, camera-linked view cube in the upper-left corner. Click a face for a straight-on view, an edge for a two-axis diagonal, or a corner for a three-axis diagonal. The cube rotates with the room. Drag the compact cube to orbit the room, or focus it and use arrow keys. The home button fits and resets the room.

### Updating to 0.7.0

Update **3D Rooms** in HACS, restart Home Assistant itself, then refresh the browser. Component previews now support direct camera movement. Use the compact cube's faces, edges and corners for fixed views, or its Home button to reset. Existing rooms, mappings and saved views remain compatible.

## Roller shades

Prepared models can declare `type: "cover"` controls alongside lights. Connect each shade to a `cover.*` entity in Model settings. Open, Close, Stop and a 0–100% opening slider appear when the entity advertises the corresponding capabilities. The dashboard opens Home Assistant’s native cover dialog. Both views follow `current_position` (0 closed, 100 open), including changes made elsewhere; unknown or unavailable states retain the last visible height.

Re-export existing static rooms to add movable shades. Each cover needs stable `id`/`nodeIds`, a world-space marker `position`, `defaultPosition` (0–100), and `capabilities: ["open_close", "position", "stop"]`. Its GLB node carries `extras.controlId` and `extras.rollerShade: {top, height, defaultPosition}`. Slat children carry `extras.rollerShadePart: {center, height}` in local coordinates; the bottom rail adds `rail: true`. Export all parts fully closed so none are lost by visibility filtering. The original room viewer supplies this metadata automatically. Existing light-only packages and mappings remain compatible.

Dashboard circles use Home Assistant’s entity/state icons, including custom entity icons. Badges show light On/Off, shade opening percentage and movement arrows, or unavailable/unmapped status. Marker state follows the entity; clicks retain the existing light toggle and native cover dialog behavior.

### Replace a room model

To publish an updated model without redoing your setup, open **Room settings → Replace room model**, choose the new room ZIP and confirm. The room keeps its ID, name, Home Assistant area, daylight mode and sun entity, saved views and dashboard cards, plus every device mapping whose control still exists with the same type (light or cover). Mappings for removed or type-changed controls are dropped and the manager reports how many; new controls start unmapped. A `bindings.json` in the ZIP only fills controls you haven't mapped. The ZIP's own model ID and title are ignored, so choose the room you mean to replace. Nothing changes if the ZIP is invalid.

## Daylight

Daylight-ready model ZIPs add Day, Night and Auto settings in the manager. Auto follows a selected `sun.*` entity, using elevation for dawn/dusk; the dashboard uses the same saved setting. Each window's daylight follows its cover's reported opening, independently of indoor lights. Existing models keep their previous rendering until re-exported with aperture metadata. This is approximate diffuse window lighting, not compass-accurate solar simulation.

Device cards have a settings cog for changing that device’s entity directly. The focused editor shows compatible entities, saves changes automatically, and returns keyboard focus to the cog when closed. Shade cards provide grouped Open/Stop/Close actions and a full-width percentage slider with Closed/Open endpoints.

### Updating to 0.15.0

Update **3D Rooms** in HACS, restart Home Assistant itself, then refresh the browser. The smaller navigation cube stays visible in the room manager and saved-view editor. Drag it to rotate, use arrow keys, or click faces, edges and corners to snap the view. The Views picker is removed; Home resets the view. No model re-upload or storage migration is required.

## Adjustable desk support · 0.16.0

Version 0.16.0 adds a single **Adjustable desk** device, grouping height,
Up/Stop/Down and four user-named macros in one card/settings box. Macro icons
follow their mapped Home Assistant entities. See [the device contract](docs/adjustable-desk.md).
Update in HACS, restart Home Assistant, and refresh the browser. Export the desk-enabled office from the authoring viewer, then import that ZIP into 3D Rooms. To upgrade an existing room while retaining its matching mappings and saved views, use **Room settings → Replace model**. Existing rooms do not need re-uploading just to update the integration.

### Updating to 0.19.0

Update **3D Rooms** in HACS, restart Home Assistant itself, then refresh the browser. The room manager now uses a warm limestone/terracotta palette, serif room headings and slimmer device switches. Existing rooms, mappings and linked saved views remain compatible; no model re-upload is needed.
