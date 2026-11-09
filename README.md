## Model caching — 0.27.0

Dashboard cards reuse decoded room models across tab switches in the current Home Assistant connection. The bottom-right **Reload models** button clears the session caches and reloads the current view. New model revisions automatically get fresh geometry. Cached templates are private browser memory, bounded to eight entries / approximately 256 MiB and ten minutes of inactivity; downloaded files have a separate 96 MiB / ten-minute limit. A full page refresh starts a fresh memory cache. Oversized models still load normally without being retained. Each card keeps independent controls, materials and placement.

## 0.25.1 rendering fix

Rooms with many lights and windows now retain textured floors and furniture on graphics devices with limited texture capacity. Shadow casting adapts to the device; all light controls remain available. Update through HACS, restart Home Assistant itself, and refresh the browser. No room re-export or re-upload is needed.

<p align="center">
  <img src="custom_components/three_d_rooms/brand/icon.png" alt="3D Rooms" width="112" />
</p>

<h1 align="center">3D Rooms</h1>

<p align="center">
  Your home in 3D. Your devices in Home Assistant.
</p>

<p align="center">
  <a href="https://github.com/astritzeqiri/ha-3d-rooms/releases/latest"><img src="https://img.shields.io/github/v/release/astritzeqiri/ha-3d-rooms?style=flat-square" alt="Latest release" /></a>
  <a href="https://www.hacs.xyz/"><img src="https://img.shields.io/badge/HACS-Custom%20integration-41BDF5?style=flat-square" alt="HACS custom integration" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT license" /></a>
</p>

Bring your rooms into Home Assistant with an interactive 3D view. Import a prepared room model, connect its devices to your entities, and save the views you want on your dashboard.

**The room manager and dashboard card come together in one integration.**

## Houses, floors and room appearance

Export rooms independently from the web house builder with matching house placement metadata. Import the room ZIPs in 3D Rooms; rooms sharing a house ID assemble automatically. In each room’s settings, link its saved height ranges to Home Assistant floors and select every floor it occupies. Stairways and hallways can span floors.

Open **Dashboard views → New view**, then choose the whole house, a floor, or a room. Floor views clip the model to the exported height range. House views configure camera, perspective, framing and presentation; entities stay configured in their source rooms. Live room appearance still reflects those mappings.

Prepared models may expose **Room settings → Room appearance**. The updated hallway export offers **Show wall above entrance**, leaving its door, casing and lower wall intact. Existing hallway models need one replacement export to gain separate geometry; a normal integration update does not require re-uploading other rooms.

Compatible room replacement preserves device mappings, floor links and appearance choices. Back up room exports before replacing models. Prepared AC controls use Home Assistant’s native climate dialog; prepared hinged doors follow cover open/closed state.

See [portable placement and floors](docs/house-placement.md) for the package contract.

## Features

- **Interactive rooms** — orbit, pan and zoom, or use the navigation cube to find the right angle.
- **Lights** — control supported on/off, brightness, color and white temperature settings, with state reflected in the room.
- **Roller shades** — open, stop and close compatible covers, with the modeled shade following their position.
- **Door locks** — map a modeled lock to a `lock.*` entity; the thumb-turn follows its locked state, and dashboards open Home Assistant’s lock dialog.
- **Your own icons per view** — choose any icon for each device marker in a dashboard view: Material Design icons or your own Home Assistant icon sets such as `local:`.
- **Adjustable desks** — group height, movement controls and four configurable macros in one device card.
- **Daylight** — choose Day, Night or Auto for prepared models; window light follows shade openings and the selected sun entity.
- **Linked dashboard views** — save camera framing once and reuse it across cards, with optional per-card overrides.
- **Local model library** — keep rooms and mappings in your Home Assistant installation and export them for backup.

Available controls depend on your room model and the capabilities of the mapped entities.

## Installation

You’ll need [HACS](https://www.hacs.xyz/docs/use/) and a Home Assistant administrator account. The repository declares Home Assistant **2025.1.0** as its minimum version; runtime checks have been performed on **Core 2026.10.2**.

### 1. Download through HACS

[![Open 3D Rooms in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=astritzeqiri&repository=ha-3d-rooms&category=integration)

Open the button above, add the repository if prompted, then download **3D Rooms**.

<details>
<summary>Add the repository manually</summary>

In **HACS → ⋮ → Custom repositories**, enter:

| Setting | Value |
| --- | --- |
| Repository | `https://github.com/astritzeqiri/ha-3d-rooms` |
| Type | **Integration** |

Add the repository, then find **3D Rooms** in HACS and download it.

</details>

### 2. Restart Home Assistant

Restart Home Assistant itself after the download completes.

### 3. Add the integration

[![Add 3D Rooms to Home Assistant](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=three_d_rooms)

Or go to **Settings → Devices & services → Add integration**, search for **3D Rooms**, and confirm setup. Refresh your browser to see **3D Rooms** in the sidebar.

## Create a room model

You can start with a scan or build your own 3D room. Both routes finish with a **3D Rooms ZIP package** that you import into this integration.

### Scan with the iOS app

Our room-creation workflow builds on **[Wes Bos’s 3D Model Anything](https://github.com/wesbos/3d-model-anything)**, which includes an iOS capture app, a Three.js viewer and an AI-assisted reconstruction workflow.

1. Use the **[3D Model Anything iOS app](https://github.com/wesbos/3d-model-anything/blob/main/apps/house-capture/README.md)** to capture your room with a LiDAR-equipped iPhone or iPad. Follow its build and device instructions.
2. Export the capture and use the project’s **[scan-to-threejs workflow](https://github.com/wesbos/3d-model-anything/tree/main/.agents/skills/scan-to-threejs)** to reconstruct and refine an editable room from its measurements and photographs.
3. Prepare the resulting scene as a 3D Rooms package: embed its geometry and textures in a GLB, declare its controllable devices, and package it for import.
4. Import the prepared ZIP into **3D Rooms**, then connect the devices to your Home Assistant entities.

The iOS app’s raw capture ZIP is input to the reconstruction workflow; it is not the room package uploaded here. This integration adds the Home Assistant model library, entity connections and dashboard controls around the prepared model.

### Build your own model

Scanning is optional. You can model a room yourself, generate it with your own tools, or adapt a model you already have permission to use. Export an embedded **glTF 2.0 binary (`scene.glb`)** and add a `manifest.json` describing the room and its device controls.

See **[Preparing a room package](docs/room-packages.md)** for a minimal example. A model needs separate, identified fixture nodes for the devices you want to control; a single flattened mesh does not automatically become controllable.

### Check which objects can become entity controls

Use our **[Room to Home Assistant skill](skills/room-to-home-assistant/SKILL.md)** with an AI coding agent and your editable room model. It reviews the model hierarchy and available reference images, then lists candidate lights, shades, adjustable desks and openings, including supported behavior, suitable Home Assistant entity domains and anything uncertain or unsupported.

For an assessment without changing the model, ask:

> Use the room-to-home-assistant skill to inspect my room. List objects that could become Home Assistant controls, their model nodes, proposed stable IDs, compatible entity domains and any missing preparation. Assess only; do not modify the model or send device commands.

When you want to prepare the room, ask the agent to add the supported controls and export a validated ZIP. The skill includes control/daylight references and a package validator. It works with your own editable models as well as reconstructed scans. Actual entity IDs must be chosen from your Home Assistant setup; the skill cannot discover them from a photograph.

To use it, copy the complete [`skills/room-to-home-assistant`](skills/room-to-home-assistant) folder into your agent’s skills directory, or point your agent at its `SKILL.md` and accompanying files. For Codex, the usual user skill location is `~/.codex/skills/room-to-home-assistant/`.

## Add your first room

1. Open **3D Rooms** in the Home Assistant sidebar.
2. Choose **Import room** and upload a prepared room ZIP.
3. In **Room & devices**, use each device’s settings cog to connect a compatible Home Assistant entity.
4. Turn off **Preview** when you’re ready to send commands to your devices.

Room packages contain an embedded 3D model and definitions for its controllable devices. A standalone GLB, photo or raw scan needs to be prepared as a room package before importing. ZIP uploads can be up to **100 MB**, with an expanded limit of **300 MB**.

Under **Settings**, you can rename a room, assign a Home Assistant area, configure supported daylight settings, or export the room and its mappings. Assigning an area does not change your devices’ area assignments.

## Add a dashboard card

In your dashboard, choose **Edit dashboard → Add card → 3D Rooms**. Select a room or saved view, adjust the preview, and save. The card loads automatically with the integration.

To create a reusable view:

1. Open **Dashboard views → New view** and choose **Whole house**, **A floor**, or **A room**.
2. Pick the space, frame it using the camera controls, and give the view a name. All spaces let you choose device-button presentation.
3. Preview the desktop or phone card, choose **Save view**, then select it in the dashboard card editor.

Cards linked to a saved view follow later changes automatically. Edit a field directly to customize it for this card. A small **Reset** appears only for changed values and restores the saved view value.

On the dashboard, click a light marker to toggle it; hold it to open Home Assistant’s device controls. Clicking the modeled light fixture also opens the controls. Cover markers open the native cover dialog. Daylight-ready rooms include an **Auto / Day / Night** selector.

<details>
<summary>Manual YAML configuration</summary>

Use your room’s actual model ID:

```yaml
type: custom:three-d-rooms-card
model: my-room
height: 600
view: front
tilt: 28
heading: 0
```

Use `view: floor` for an orthographic floor plan. Optional fields include `title`, `zoom` and `interactive`. Cards showing a house or one of its floors include bottom-right floor buttons (All, then each floor) that switch instantly without reloading; set `floor_selector: false` to hide them. Every card also has Move camera (starts from `interactive`) and Reset view buttons; set `camera_controls: false` to hide them. The top-left Lights and Shades buttons list each room's lights or shades, with one switch per room and a confirmed All switch; hidden devices are never switched. Set `light_panel: false` or `shade_panel: false` to hide them. To follow a saved view, copy the configuration from **Use in dashboard → Advanced YAML** in the manager.

</details>

## Faster loading on phones

3D Rooms keeps lighter copies of every room next to your upload. Home Assistant makes them automatically (shared, smaller WebP textures), and phones download a copy with smaller textures. For the biggest gain, open the room in the 3D Rooms sidebar → Room settings → **Faster loading** → **Optimize for phones and desktops**. This compresses geometry and uses GPU-compressed (KTX2) textures; it runs in your browser and also starts automatically after an upload. Your upload is never changed, and Export returns it.

Cards render more lightly on phones. Add `quality: high` to a card to keep full quality on a phone, or `quality: low` to use the light profile everywhere.

## Update

Download the latest version in **HACS → 3D Rooms**, restart **Home Assistant**, then refresh your browser.

Your uploaded rooms, entity mappings and saved views stay in place. You do not need to re-upload models for an integration update.

To update a room’s geometry, use **Settings → Replace room model**. The room keeps its identity, saved views and compatible device mappings. Removed or incompatible controls are reported during replacement.

## Storage and backups

Rooms and mappings are stored locally in `config/.storage/three_d_rooms/`, separately from the integration files. Include this directory in your Home Assistant backups, or use the room export action for a portable copy.

Model uploads, downloads and device commands use your authenticated Home Assistant administrator session. Removing the integration retains the model library; removing a room in the manager deletes that room.

## Help and development

- [Report a bug or request a feature](https://github.com/astritzeqiri/ha-3d-rooms/issues)
- [Releases and update notes](https://github.com/astritzeqiri/ha-3d-rooms/releases)
- [Adjustable desk model specification](docs/adjustable-desk.md)
- [Development and contribution guide](AGENTS.md)
- [Validation records](VALIDATION.md)

## Credits

Thanks to [Wes Bos and 3D Model Anything](https://github.com/wesbos/3d-model-anything) for the capture app, reconstruction workflow and viewer foundation used to create our rooms. See the upstream repository for its code license and [demo asset terms](https://github.com/wesbos/3d-model-anything/blob/main/ASSETS-LICENSE.md).

Licensed under the [MIT license](LICENSE). See [third-party notices](THIRD_PARTY_NOTICES.md) for upstream attribution and asset terms.

### Preview a dashboard view

Choose **Preview in dashboard** while editing a view or on its saved-view card. Preview unsaved settings at Desktop or Phone card widths, then close with × or Escape. Device controls are live. **Show title on card** hides the header while retaining the saved view name. New views start without a header; existing views retain their setting. Linked cards follow changes unless overridden in Home Assistant’s card editor.

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

## Updating to 0.24.0

Update 3D Rooms in HACS, restart Home Assistant itself, then refresh your browser. Full-house ZIP imports, the compact house workspace and AC state/visual fixes are included. Existing rooms, mappings and saved views remain compatible; no re-upload is required.

## House management (local preview)

Under a house’s Settings, use **Replace house** to preview a full-house ZIP before applying it, or **Delete house** to review all affected rooms and saved views. Replacement matches rooms by exported room ID, then by name (rooms re-added in the house app get a new ID), and device mappings by control ID, then by name and type. The preview shows a review for each room: pick which existing room it replaces, see which mappings are kept or not matched, and change any device before confirming. Matched rooms keep their name, area, compatible mappings, light groups and hidden devices. Missing rooms and their saved views are removed; other houses and Home Assistant devices are unchanged. Dashboard cards referring to removed content need manual updates.

**Dashboard views → New view** is the shared creator for houses, floors and rooms. The editor previews the chosen space and saves that scope. The top-right selector changes the main 3D view; the sidebar floor filter only filters the room list.

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
