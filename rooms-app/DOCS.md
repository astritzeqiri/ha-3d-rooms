## 0.25.1 rendering fix

Rooms with many lights and windows now retain textured floors and furniture on graphics devices with limited texture capacity. Shadow casting adapts to the device; all light controls remain available. Update through HACS, restart Home Assistant itself, and refresh the browser. No room re-export or re-upload is needed.

## Full-house import preview

Use **Build a house → House → Export full house for Home Assistant** in the authoring app, then **Import room or house** in the native sidebar. All rooms are imported together; each retains independent controls, position and floors. Limits are 50 rooms, 100 MB uploaded and 300 MB expanded. Existing room IDs are rejected without replacement. The project backup ZIP is a separate authoring format.

# 0.23.0 house and floor views

Use the native HACS integration for room imports and house/floor dashboards. Room ZIPs from the house builder carry shared placement metadata. In each room’s settings, map saved height ranges to Home Assistant floors and assign every occupied floor. House dashboard editors configure camera and floor presentation only; entity setup stays in the individual rooms. Optional architecture is configured per room and inherited by house/floor views.

Update via HACS, restart Home Assistant itself, and refresh the browser. Only older models needing new optional geometry (such as the split hallway entrance wall) need a replacement model.

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

Use **My home** for rooms, devices and settings. Create and edit views in the top-level **Dashboard views** workspace and its shared camera editor. Save a view, then use it in the Home Assistant visual card editor; YAML is optional under Advanced. Selecting a saved view links the card with `saved_view: <view-id>`. Saved changes update linked cards automatically. Edit any field directly to customize it for this card; use its small **Reset** action to follow the saved view again. Existing standalone cards keep their settings until a saved view is selected.

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

Open the top-level **Dashboard views** workspace to browse every saved view across all houses, floors and rooms. Search by view or space name, filter by space type, or choose **New view** or **Import**. One creator lets you choose Whole house, A floor, or A room, then frame the live preview. **Change space** retains the view ID, name, height and linked dashboard cards while resetting camera framing and device presentation. **Back to views** returns to the global gallery. **My home** contains imports, room setup, devices and house settings. Existing saved views appear automatically; no migration or re-upload is needed. Arbitrary combinations of rooms are not part of this first version. House, floor and room views all show device controls and support individual button presentation. Entity connections follow their source rooms; floor views include the controls in that floor.

## Editing device icons

Create or edit a view under **Dashboard views**. Click a device icon to open its compact fan-out actions:

- **Eye** hides or shows that control in this view. Hidden controls stay faded and selectable in the editor with a **Hidden** pill; dashboard cards and previews omit them.
- **Edit icon** changes the state label, size and whether the control appears on the room or below it. The Visible checkbox stays synchronized with the eye.
- **Position** offers click-to-place, reset and precise X/Y/Z offsets in metres. You can also drag an icon directly onto a visible model surface. Escape cancels an unfinished placement.
- **Undo** steps through up to 50 icon edits for the selected device during the current editing session. Opening another view resets this history.

Click outside the icons/tools to close the fan and clear selection. The device picker under **Device controls** provides another way to select a control. Editing icons never sends device commands; **Preview in dashboard** uses live controls. Save the view to retain presentation and position changes. Linked cards inherit saved marker settings unless explicitly overridden.

Camera framing is retained when reopening, resizing and saving views. Saved views now include a bounded JPEG thumbnail shared across gallery browsers; older views gain one on their next save. Phone/tablet layouts keep preview actions accessible while scrolling.

Device controls include **Defaults for this view**: set visibility, state labels, size and display position once for the view. Individual device settings override only the fields you change. **Use view defaults** removes appearance overrides and retains the device’s position. Existing saved customizations remain intact.

## Auto height and fullscreen (local preview)

In the Home Assistant card editor, choose **Height → Auto · fill available screen**. Use a single-card **Panel** view to fill both width and the space below Home Assistant’s header. YAML accepts `height: auto`; numeric heights from 180 to 1600 remain supported. This is a per-card layout choice and does not change the saved view or camera.

The fullscreen button appears in browsers that support the Fullscreen API. Exit using the same button or the browser’s Escape action. Opening a device dialog exits fullscreen so Home Assistant dialogs remain accessible. Auto height includes the title and device tray; long trays scroll within the card.

## Hide a device everywhere in 3D Rooms

Open its source room → **Devices → Hide device**. The device's controls and markers disappear from room, house and floor views, dashboard cards, device trays and the view editor. Per-view visibility and icon defaults cannot reveal it. A minimal Hidden row remains only in the room's Devices tab; choose **Show device** there to restore it.

Grouped desk controls hide together. Entity mappings, saved views and the physical room model remain intact; Home Assistant entities and automations are unaffected. Visibility persists across restarts, room exports and compatible room/house replacements.

## Group modeled lights

In **My home → room → Devices**, choose **Group lights**. Name the group, select at least two modeled lights from that room, and choose the one existing Home Assistant light (or switch) entity that controls them. You can connect it later. This does not create a Home Assistant entity.

The group appears as one control in the device list and saved room/floor/house views. Each original fixture keeps its geometry and light source, and follows the shared entity's state. The group marker sits at the center of its visible fixtures. Use the group's settings button to change its name, members or entity. **Ungroup** restores individual controls and their previous connections. A light can belong to one group at a time. Groups persist through restarts, room exports and compatible model replacement.

On a room’s Devices tab, click a device bubble to open its settings. Grouped lights open the group editor.
