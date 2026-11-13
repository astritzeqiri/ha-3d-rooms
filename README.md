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

Bring your home into Home Assistant as an interactive 3D model. Import prepared room models, connect their devices to your entities, and save the views you want on a dashboard, or open any view as its own full-screen page with no Home Assistant menus around it.

**The room manager, the dashboard card and the full-screen page come together in one integration.** There is nothing else to install, and no Node or add-on to run.

## Features

- **Rooms, floors and whole houses** — import rooms one by one or a complete house ZIP. Open the whole house, a single floor or one room, with live state on every device.
- **Dashboard views** — frame the camera once, choose a background and which device buttons show, save it as a named view, and reuse it on any number of cards.
- **A full-screen page per view** — `/three_d_rooms_view/<view id>` shows one view and nothing else: ideal for a wall tablet or a phone home screen.
- **Lights** — on/off, brightness, colour and white temperature, with state and light effects reflected in the room.
- **Shades, windows and doors** — open, stop and close covers, or follow a door/window contact sensor. Hinged and sliding doors move in 3D.
- **Door locks** — the modeled thumb-turn follows the lock; a tap opens the lock's dialog.
- **Air conditioners** — state colours and mode effects on the model; the native climate dialog (or, on the full-screen page, an arc dial) controls them.
- **Adjustable desks** — height, movement controls and four macros in one device card.
- **Your own icons** — every marker shows Home Assistant's icon for its entity and state, or any icon you choose per room or per view: Material Design icons or your own icon sets such as `local:`.
- **Day, night and auto** — window light follows shade openings and the sun, with a three-icon time-of-day switch on every card.
- **Fast on phones** — lighter copies of each room are made automatically, and phones render with a lighter profile.
- **Local and private** — rooms and mappings live in your Home Assistant, are included in its backups and can be exported.

Available controls depend on your room model and the capabilities of the mapped entities.

## Installation

You’ll need [HACS](https://www.hacs.xyz/docs/use/) and a Home Assistant administrator account. The repository declares Home Assistant **2025.1.0** as its minimum version; runtime checks have been performed on **Core 2026.11.0**.

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
2. Choose **+ Import** and upload a prepared room ZIP, or a full-house ZIP.
3. The **Getting started** panel on the Overview lists the next steps. In **Devices**, use each device’s settings cog to connect a compatible Home Assistant entity, or **Connect devices** to connect close name matches in one go.
4. Turn off **Preview** when you’re ready to send commands to your devices.

Room packages contain an embedded 3D model and definitions for its controllable devices. A standalone GLB, photo or raw scan needs to be prepared as a room package before importing. ZIP uploads can be up to **100 MB**, with an expanded limit of **300 MB**.

Under **Settings** you can rename a room, assign a Home Assistant area, configure supported daylight settings, replace the model or export the room and its mappings. Changes in Settings save as you make them. Assigning an area does not change your devices’ area assignments.

## Houses, floors and room appearance

Export rooms independently from the web house builder with matching house placement metadata. Import the room ZIPs (or one full-house ZIP); rooms sharing a house ID assemble automatically. In each room’s settings, link its saved height ranges to Home Assistant floors and select every floor it occupies. Stairways and hallways can span floors.

Prepared models may expose **Room settings → Room appearance**, for example **Show wall above entrance**, which leaves the door, casing and lower wall intact.

**Replace room model** (Settings) swaps a room’s geometry and keeps its identity, saved views, floors, icons, light groups and compatible device mappings; removed or incompatible controls are reported. **Replace house** previews a full-house ZIP before applying it: rooms are matched by exported ID, then by name, and you can review and change each match, and each device mapping, before confirming. **Delete house** lists every affected room and saved view first. Back up room exports before replacing models.

See [portable placement and floors](docs/house-placement.md) for the package contract.

## Devices

Open a room’s **Devices** tab to connect and arrange its devices. The model shows each device’s icon, coloured by state: green locked, red unlocked, purple open, the light’s own colour when on, and a grey ring when not yet connected.

- **Lights** — group several modeled lights into one control connected to a single Home Assistant light or switch entity (**Group devices → Group lights**). Each fixture keeps its geometry. Ungroup at any time.
- **Shades, windows and doors** — connect a `cover` entity, or a door/window `binary_sensor` (read-only: it shows open/closed and moves the model, with no open/close buttons). Shades, windows and doors can be grouped like lights.
- **Locks** — map a modeled lock to a `lock.*` entity. Locks that need a code are never unlocked from 3D Rooms.
- **Air conditioners** — connect a `climate` entity; mode effects show on the model.
- **Adjustable desks** — see the [desk model specification](docs/adjustable-desk.md).
- **Hide a device everywhere** — **Hide device** (in a device’s ⋯ menu) removes its markers and controls from every view and card. Entity mappings and Home Assistant itself are untouched; **Show device** restores it.

### Icons

On the Devices tab, drag an icon onto a visible surface to move it, or click it to choose any Home Assistant icon, including your own icon sets. Give a device separate icons for its active (on, open, locked) and inactive state, or leave it unset to keep Home Assistant’s own state icon. **Position → Reset** returns an icon to where the model placed it. These are the starting point for every card and view; a view can override them for itself. **Undo** (or Ctrl/⌘+Z) takes back the last icon change.

A room with many devices can crowd a house card. Turn on **Group this room’s icons in house views** to show them as one chip with the room name that expands on a tap.

## Dashboard views

Open **Dashboard views** (next to **My home**) to browse every saved view across all houses, floors and rooms. Search by name, filter by space type, **Import** a view or choose **New view**.

1. Choose **Whole house**, **A floor** or **A room**, then frame it with the camera controls, the view cube or a preset (**Floor plan** switches to a true top-down camera).
2. Choose a **Background** (below), set the card height (a fixed height or **Auto**, which fills the screen), and decide whether to show a title.
3. Click a device icon to hide it, change its icon or label, move it or resize it for this view; **Defaults for this view** sets these for all devices at once. On house and floor views, **Room buttons** choose when each room’s button shows, where it sits and which angle the room opens at.
   **Extra entities** adds any Home Assistant entity (a sensor, switch, scene, media player…) to the view as an icon you drag anywhere on the model. Click it for the same tools as a device icon: its icon for each state, visibility, state label, size and position. On the card a tap switches what can be switched (or runs a scene or script) and opens Home Assistant's dialog for the rest; holding always opens the dialog.
4. **Preview** at desktop or phone width, then **Save view**. Saving also stores a preview picture for the gallery.

Cards linked to a saved view follow later changes automatically. In the card editor, edit a field to override it for that card; a small **Reset** restores the view’s value. Each gallery card offers **Edit** (or click its picture) and **Add to dashboard**; its **⋯** menu holds **Preview in dashboard**, **Open full screen**, **Duplicate**, **Export view** and **Delete view**.

### Backgrounds

Each view has its own background: **Spotlight** (default), **Classic** (flat dark), **Blueprint grid**, **Sky** (follows the day/night setting and the real sun, with stars at night), **Aurora**, **Custom image** (a `/local/…` or web address) or **Home Assistant theme**. An optional soft shadow anchors the house. The gallery preview is drawn over the view’s current background, so it follows the sky too.

## Add a dashboard card

In your dashboard, choose **Edit dashboard → Add card → 3D Rooms**. Select a saved view (or a room), adjust the preview, and save. The card loads automatically with the integration.

On the card:

- **Markers** — tap a light to toggle it; hold it for Home Assistant’s device controls. Covers, locks and climate open their native dialogs.
- **Lights and Shades panels** (top left) list each room’s lights or shades with one switch per room and a confirmed **All** switch. Hidden devices are never switched.
- **House and floor cards** have floor buttons (All, then each floor). A room hidden behind others gets a button that shows it on its own; double-tap a room to open it, use the arrows or Left/Right for the next room, and the House button or Escape to return. Hold a room button to switch that room’s lights.
- **Toolbar** — Move camera, Reset view, Reload models, fullscreen, and (for administrators) an Edit button that opens the view in the editor in a new tab.
- **Time of day** — an Auto / Day / Night switch for daylight-ready rooms.
- A progress bar and the view’s own picture show while a large room downloads.

<details>
<summary>Manual YAML configuration</summary>

```yaml
type: custom:three-d-rooms-card
saved_view: <view id>     # or: model: my-room
height: auto              # 180–1600, or auto to fill the screen
```

| Option | Meaning |
| --- | --- |
| `saved_view` / `model` | Follow a saved view (copy it from **Use in dashboard → Advanced YAML**), or show a room directly |
| `view`, `tilt`, `heading`, `zoom` | Camera for a card without a saved view. `view: floor` is an orthographic floor plan |
| `interactive` | Start with camera movement on |
| `title`, `show_title` | Card title |
| `floor_selector` | `false` hides the floor buttons on house and floor cards |
| `room_focus` | `false` hides the room buttons |
| `camera_controls` | `false` hides Move camera and Reset view |
| `light_panel`, `shade_panel` | `false` hides the Lights or Shades panel |
| `edit_button` | `false` hides the administrator Edit button |
| `quality` | `auto` (default), `high` or `low` rendering quality |
| `background`, `background_image`, `background_shadow` | Override the view’s background |

</details>

## Full-screen page for one view

Sometimes a dashboard still shows too much: Home Assistant’s sidebar and header around the card. Every view has its own page at `/three_d_rooms_view/<view id>` on your Home Assistant address that shows only the view, filling the screen.

- **Where to find it:** the **Open full screen** button on each card in **Dashboard views**, the **Full screen** button beside **Background** in the view editor (once the view is saved), or **Add to dashboard → Full-screen page** to copy the link. All open it in a new tab.
- Bookmark it, add it to a phone’s home screen, or use it as a wall tablet’s start page.
- It reuses the Home Assistant login of that browser (and sends you through the normal login if there is none). Any Home Assistant user can open it, administrator or not, so a family member's phone or a wall tablet signed in as a regular user works; nothing is public.
- Taps work as on the card. Holding a device opens a pop-up laid out like Home Assistant’s own: a large brightness or position control, round buttons for power, colour temperature, colour and effects, an arc dial for air conditioners with mode, fan, swing and preset tiles, a big lock button, an alarm mode picker (Home, Away, Night… as the alarm supports) with Home Assistant's code keypad when a code is needed, a live camera picture (HLS video on Safari, iPad and iPhone; Home Assistant's MJPEG stream elsewhere) with full screen and reconnect, and an Attributes list. Your chosen marker icons, including custom icon sets, are drawn too.

## Faster loading on phones

Home Assistant makes lighter copies of every room next to your upload (shared, smaller WebP textures), and phones download the one with smaller textures. For the biggest gain open the room → **Settings → Faster loading → Optimize for phones and desktops**: it compresses geometry and uses GPU-compressed (KTX2) textures, runs in your browser and also starts automatically after an upload. Your upload is never changed, and Export returns it.

Cards render more lightly on phones. Add `quality: high` to keep full quality on a phone, or `quality: low` to use the light profile everywhere. Downloaded rooms are kept on the device, so cards and the full-screen page open them again without downloading (a replaced room downloads once). Cards also reuse decoded models between tab switches within a Home Assistant session. **Reload models** downloads the rooms again and replaces the stored copies; on the full-screen page the reload button offers **Reload page** and **Reload model**.

## Update

Download the latest version in **HACS → 3D Rooms**, restart **Home Assistant** itself, then refresh your browser. Your uploaded rooms, entity mappings and saved views stay in place, so a normal update never needs a re-upload. The sidebar shows the installed version. See the [changelog](rooms-app/CHANGELOG.md) for what each release changed.

## Storage and backups

Rooms, device connections and saved views live in `config/.storage/three_d_rooms/`, separately from the integration files. Every room keeps its uploaded GLB plus lighter phone and desktop copies, so the folder can reach hundreds of megabytes; the diagnostics download (below) shows its size.

- **Home Assistant backups include it.** Full backups and partial backups that include Home Assistant's configuration contain the whole library. Large rooms make backups larger and slower; keep that in mind for backup locations with little space.
- **Portable copy of one room:** **Export room & mappings** in the room's settings in the 3D Rooms sidebar, or the `three_d_rooms.export_room` action (below). The ZIP holds the room and its connections and imports on any Home Assistant with 3D Rooms.
- Removing the integration keeps the library, so adding it again brings everything back. Removing a room in the sidebar deletes that room.

### Who can see and change what

- **Every signed-in Home Assistant user** (including non-administrators, such as family members or a wall tablet) can view dashboard cards and full-screen pages: the room models, saved views and the day/night switch. Turning devices on and off goes through Home Assistant itself, so it follows the same permissions as the rest of Home Assistant.
- **Administrators only:** the 3D Rooms sidebar and everything that changes the library — uploading, replacing or deleting rooms, connecting devices to entities, editing saved views, room exports, and the actions and repairs above. The card's Edit button only shows for administrators.

Nothing is public: every request needs a Home Assistant login.

## Diagnostics, repairs and actions

- **Diagnostics:** **Settings → Devices & services → 3D Rooms → ⋮ → Download diagnostics** saves the integration and Home Assistant versions, the number of rooms, houses and saved views, storage size, device types, how many devices are connected and the optimization state of each room. Room and view names and entity IDs are left out. Attach it to bug reports.
- **Repairs:** **Settings → Repairs** lists a room or saved view that still uses an entity Home Assistant no longer has (for example after removing a device or renaming an entity), and a room whose lighter copies could not be made. Each issue has a fix: disconnect the removed entities (the devices stay in the room so you can connect new ones), remove them from the saved view, or try the optimization again. Issues clear by themselves once the cause is gone.
- **Actions** for automations and scripts:

  ```yaml
  # Read the library again and refresh open cards and the sidebar.
  action: three_d_rooms.reload
  data:
    retry_optimizations: true # optional: try failed optimizations again
  ```

  ```yaml
  # Save a room as a ZIP in config/3d_rooms_exports/.
  action: three_d_rooms.export_room
  data:
    room: Kitchen # the room's name in 3D Rooms, or its room id
    filename: kitchen-weekly # optional; default: the room name and time
  response_variable: export # optional: path, size and room id
  ```

## Help and development

- [Report a bug or request a feature](https://github.com/astritzeqiri/ha-3d-rooms/issues)
- [Releases and update notes](https://github.com/astritzeqiri/ha-3d-rooms/releases) · [changelog](rooms-app/CHANGELOG.md)
- [Preparing a room package](docs/room-packages.md) · [portable placement and floors](docs/house-placement.md) · [adjustable desk specification](docs/adjustable-desk.md)
- [Development and contribution guide](AGENTS.md)
- [Validation records](VALIDATION.md)

## Credits

Thanks to [Wes Bos and 3D Model Anything](https://github.com/wesbos/3d-model-anything) for the capture app, reconstruction workflow and viewer foundation used to create our rooms. See the upstream repository for its code license and [demo asset terms](https://github.com/wesbos/3d-model-anything/blob/main/ASSETS-LICENSE.md).

Licensed under the [MIT license](LICENSE). See [third-party notices](THIRD_PARTY_NOTICES.md) for upstream attribution and asset terms.
