# 3D Rooms

**One HACS integration for your 3D rooms, model library, entity mappings, and dashboard card.** No separate add-on, container, Ingress session, or access token is required in version 0.10.0.

Upload a prepared room or floor ZIP, connect its declared lights to Home Assistant light/switch entities, and view it on a dashboard. Click the physical modeled fixture to open Home Assistant's own light controls. Brightness, RGB color and white temperature follow the entity's reported state. All walls stay visible; a minimum ambient level keeps unlit rooms readable.

## Integration icon

![3D Rooms icon](custom_components/three_d_rooms/brand/icon.png)

The integration bundles its own transparent icon for light and dark themes. Home Assistant 2026.3 and newer supports these local brand images; older versions and some HACS views may still display a placeholder. The editable icon generator is in `branding/generate-icons.py` (Pillow required).

## Install

1. In **HACS → ⋮ → Custom repositories**, add `https://github.com/astritzeqiri/ha-3d-rooms` with type **Integration**. Download **3D Rooms**.
2. Restart Home Assistant.
3. Open **Settings → Devices & services → Add integration → 3D Rooms**, then confirm setup.
4. Refresh the browser and open **3D Rooms** in the sidebar.
5. Choose **Add a model**, upload your model ZIP, and connect its controls under **Model settings**.
6. Add the dashboard card through the visual editor below. Its code loads automatically with the integration; do not install a second HACS Dashboard repository or create a separate resource entry.

This release requires a Home Assistant administrator account for both the model manager and dashboard. Tested in Home Assistant Core **2026.10.2** in a separate container; the user's HA OS/Proxmox VM and physical lights still need installation checks. It uses native Core APIs and does not require Supervisor.

## Dashboard card

Choose **Edit dashboard → Add card → By card → 3D Rooms**. Select a room or a saved component, adjust the title, view, rotation, tilt, zoom and height, then click **Save**. Home Assistant shows a live preview. Existing cards also open in this visual editor.

Selecting a saved component copies its current configuration into the card; later edits to the original component do not change that dashboard card. Title and height edits preserve exact saved camera framing. Changing the room or projection, or choosing **Reset camera framing**, starts a new framing.

For manual configuration, **Edit dashboard → Add card → Manual** still supports:

```yaml
type: custom:three-d-rooms-card
model: kitchen
height: 600
view: front
tilt: 28
heading: 0
```

Use the actual model ID shown in **3D Rooms → Model settings**, or copy a ready-made configuration from **Add to dashboard** in the manager. Add another card with another model ID to show a different room or floor.

- `view: front` is the angled perspective. `view: floor` is orthographic.
- `tilt` is degrees away from overhead (0–180). `heading` rotates around the floor's vertical axis.
- `zoom` scales the room (0.01–100; default 1).
- **Add to dashboard** opens an editor beside the room. Drag the room or use the sliders and numeric fields to change rotation, tilt and zoom live. Name the view and choose **Save component** to find it under **HA components**, or **Copy configuration** for a Manual dashboard card. Keep its generated `camera` object to preserve panning and projection; narrower cards fit the saved composition. Older configurations without `camera` continue to use automatic fitting.
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

In the model manager, open **Add to dashboard** and choose the room view,
rotation (0–359.99°), tilt (0–180°), and zoom. Copy the generated configuration into a
Manual dashboard card, or update an existing card's `view`, `heading`, and `tilt`
settings. Each card can use its own room angle.

### Home Assistant components

Open **HA components** beside **Models** to create reusable dashboard views. Choose
an imported room, name the component, then adjust its view, rotation, tilt, zoom
(0.01–100×), and height. The room preview updates as you edit. Save several components
for the same kitchen, or duplicate one to start from its settings.

**Copy dashboard configuration** produces a Manual card configuration with all
view settings included. Existing cards keep their copied settings; copy the
configuration again after changing a component. **Export component** downloads a
small `.component.json` file; **Import component** opens it as a new draft for
review and saving. Component files reference room IDs and do not include the GLB
or device mappings: import the corresponding room package first when moving to a
different installation. Components are saved server-side in both the add-on and
native integration and survive restarts.

This release supports one room per component. The versioned component format
stores room references as layers to allow future room composition; room merging
is not available yet.

### Updating to 0.5.0

In **HACS → 3D Rooms**, download/update to **0.5.0**, restart Home Assistant itself, then refresh the browser. The bundled manager and card update together. Existing room uploads, entity mappings and saved components remain in place; no model re-upload is needed.

### Updating to 0.6.0

Update **3D Rooms** in HACS, restart Home Assistant, then refresh the browser. **Add to dashboard** opens the live component sidebar. Existing rooms, mappings, and saved components remain compatible; no re-upload is needed.

### Editing the camera directly

The saved component preview supports dragging to rotate, scrolling to zoom and right-dragging to pan. These changes update its fields and exported configuration; choose **Save component** to persist them. Both editors have a compact, camera-linked view cube on the left. Click a face for a straight-on view, an edge for a two-axis diagonal, or a corner for a three-axis diagonal. The cube rotates with the room. The home button fits and resets the room; **Views** offers the same six faces, twelve edges and eight corners in a keyboard- and touch-friendly picker.

### Updating to 0.7.0

Update **3D Rooms** in HACS, restart Home Assistant itself, then refresh the browser. Component previews now support direct camera movement. Use the compact cube's faces, edges and corners for fixed views, or its Home button to reset. Existing rooms, mappings and saved components remain compatible.

## Roller shades

Prepared models can declare `type: "cover"` controls alongside lights. Connect each shade to a `cover.*` entity in Model settings. Open, Close, Stop and a 0–100% opening slider appear when the entity advertises the corresponding capabilities. The dashboard opens Home Assistant’s native cover dialog. Both views follow `current_position` (0 closed, 100 open), including changes made elsewhere; unknown or unavailable states retain the last visible height.

Re-export existing static rooms to add movable shades. Each cover needs stable `id`/`nodeIds`, a world-space marker `position`, `defaultPosition` (0–100), and `capabilities: ["open_close", "position", "stop"]`. Its GLB node carries `extras.controlId` and `extras.rollerShade: {top, height, defaultPosition}`. Slat children carry `extras.rollerShadePart: {center, height}` in local coordinates; the bottom rail adds `rail: true`. Export all parts fully closed so none are lost by visibility filtering. The original room viewer supplies this metadata automatically. Existing light-only packages and mappings remain compatible.

Dashboard circles use Home Assistant’s entity/state icons, including custom entity icons. Badges show light On/Off, shade opening percentage and movement arrows, or unavailable/unmapped status. Marker state follows the entity; clicks retain the existing light toggle and native cover dialog behavior.

## Daylight

Daylight-ready model ZIPs add Day, Night and Auto settings in the manager. Auto follows a selected `sun.*` entity, using elevation for dawn/dusk; the dashboard uses the same saved setting. Each window's daylight follows its cover's reported opening, independently of indoor lights. Existing models keep their previous rendering until re-exported with aperture metadata. This is approximate diffuse window lighting, not compass-accurate solar simulation.
