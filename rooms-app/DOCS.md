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

Select a room, then use Devices, Saved views or Room settings. Create and edit dashboard views in one shared camera editor. Save a view, then use it in the Home Assistant visual card editor; YAML is optional under Advanced. Selecting a saved view links the card with `saved_view: <view-id>`. Saved changes update linked cards automatically. Check **Override for this card** beside a field to customize only that value; uncheck it to resume inheritance. Existing standalone cards keep their settings until a saved view is selected.

Room settings can rename the room and assign an existing Home Assistant area. Refresh areas after creating one in HA. This association does not change device entity assignments and stays local to this installation rather than being included in portable exports. Existing room uploads, mappings and saved-view JSON files remain compatible.

## Form fields — 0.11.1

Room-name and plain text/number inputs now match the dark form controls, with padded 44px fields, rounded borders and consistent room-settings spacing. Update the HACS integration, restart Home Assistant and refresh your browser.

## Camera navigation (0.15.0)

The room viewer has a compact, always-visible view cube. Drag it to rotate the room or use arrow keys when focused. Click a face, edge or corner to snap to that angle; Home resets and fits the room. The cube remains visible while editing saved views, including when Advanced camera settings is closed.

## Adjustable desk · 0.16.0

Desk-enabled models group height, Up/Stop/Down and four optional macros in one device card and settings box. Map the centimetre height to a number entity, directions to a cover, and each macro to a button, input button, script or scene. Macro names start blank, are user editable, and persist with the room; icons come from the mapped entity. Update the integration before importing a new desk-enabled export. Existing rooms remain compatible.

## 0.20.0 dashboard preview

The native integration manager can preview draft and saved views in the real Home Assistant dashboard card. Desktop/Phone controls change card width; × or Escape closes the preview. Device controls remain live. Show title on card controls the header independently of the saved view name, and linked cards inherit it unless overridden. Existing views preserve their title behavior. Thumbnails retain proportions, with older caches repaired from saved camera aspect ratios when available.

### Dashboard views gallery

Open **Dashboard views** to browse this room’s saved views, preview a card, or choose **Create view** or **Import**. Creating or editing opens the room canvas beside its view settings. Choose **Back to views** to return to the gallery. **Room & devices** retains its live room overview and device controls.

## Editing device icons

Create or edit a view under **Dashboard views**. Click a device icon to open its compact fan-out actions:

- **Eye** hides or shows that control in this view. Hidden controls stay faded and selectable in the editor with a **Hidden** pill; dashboard cards and previews omit them.
- **Edit icon** changes the state label, size and whether the control appears on the room or below it. The Visible checkbox stays synchronized with the eye.
- **Position** offers click-to-place, reset and precise X/Y/Z offsets in metres. You can also drag an icon directly onto a visible model surface. Escape cancels an unfinished placement.
- **Undo** steps through up to 50 icon edits for the selected device during the current editing session. Opening another view resets this history.

Click outside the icons/tools to close the fan and clear selection. The device picker under **Device controls** provides another way to select a control. Editing icons never sends device commands; **Preview in dashboard** uses live controls. Save the view to retain presentation and position changes. Linked cards inherit saved marker settings unless explicitly overridden.

Camera framing is retained when reopening, resizing and saving views. Saved views now include a bounded JPEG thumbnail shared across gallery browsers; older views gain one on their next save. Phone/tablet layouts keep preview actions accessible while scrolling.
