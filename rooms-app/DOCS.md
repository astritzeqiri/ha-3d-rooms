# Legacy 3D Rooms add-on

The recommended installation is now the single **3D Rooms HACS Integration**. See the repository README. A separate add-on and HACS Dashboard download are no longer required.

This add-on is retained for local authoring and migration from versions 0.1–0.3.

## Migrate existing rooms

Update this add-on to 0.4.0, select a room, and use **Model settings → Export room & mappings**. In the new integration's sidebar, choose **Add a model** and upload the resulting ZIP. Repeat for other rooms. The exported scene and saved entity mappings are preserved. Verify them in the integration before stopping or uninstalling the add-on.

Keep model packages or a backup of the old add-on until migration is verified. Original model ZIPs can also be uploaded, but need their entity mappings configured again.

## 0.5.0 dashboard components

The retained add-on also supports named room components with angle, tilt, zoom and height settings, preview, duplication and portable JSON import/export. Component files reference an existing model ID. For normal Home Assistant installations, update the single HACS integration instead of installing the legacy add-on.

## Version 0.6.0

The live component sidebar and exact camera saving are included in the integration and retained development add-on. Normal installations should update the HACS Integration; no separate card or add-on update is required.

## Version 0.7.0

Adds interactive component previews and a compact camera cube with face, edge and corner views. Normal installations update only the HACS Integration, restart Home Assistant and refresh the browser.

## Roller shades

Version 0.9.0 accepts prepared movable `cover` controls alongside lights. Map each shade to a Home Assistant `cover.*` entity. The manager and dashboard follow reported opening height; device-supported Open, Close, Stop and percentage commands use native cover services. Re-export a static room with shade metadata before importing it. Old light-only rooms continue to work.

## Daylight — 0.10.0

Import a daylight-ready room ZIP to enable Day, Night and Auto. Select a sun entity (normally sun.sun) for Auto; its reported elevation provides dawn/dusk transitions. Each shade's opening controls its window's light independently of indoor lights. Settings persist per model and are used by the sidebar and dashboard. Existing rooms retain their previous behavior; a new export is needed only to add daylight aperture metadata. This is diffuse window lighting rather than compass-accurate sunlight.

Each device card has an entity-settings cog. Use it to change or disconnect that one device without opening the complete Model settings list. Choices use the same compatible entity filtering and save automatically. Shade controls use grouped action buttons, a filled opening slider and a percentage readout, with responsive cards that wrap long entity identifiers.

## Room workspace — 0.11.0

Select a room, then use Devices, Saved views or Room settings. Create and edit dashboard views in one shared camera editor. Save a view, then use it in the Home Assistant visual card editor; YAML is optional under Advanced. Existing cards copy view settings, so reselect a view after changing it.

Room settings can rename the room and assign an existing Home Assistant area. Refresh areas after creating one in HA. This association does not change device entity assignments and stays local to this installation rather than being included in portable exports. Existing room uploads, mappings and saved-view JSON files remain compatible.

## Form fields — 0.11.1

Room-name and plain text/number inputs now match the dark form controls, with padded 44px fields, rounded borders and consistent room-settings spacing. Update the HACS integration, restart Home Assistant and refresh your browser.

## Camera navigation (0.15.0)

The room viewer has a compact, always-visible view cube. Drag it to rotate the room or use arrow keys when focused. Click a face, edge or corner to snap to that angle; Home resets and fits the room. The cube remains visible while editing saved views, including when Advanced camera settings is closed.
