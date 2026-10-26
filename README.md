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

## Features

- **Interactive rooms** — orbit, pan and zoom, or use the navigation cube to find the right angle.
- **Lights** — control supported on/off, brightness, color and white temperature settings, with state reflected in the room.
- **Roller shades** — open, stop and close compatible covers, with the modeled shade following their position.
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

[![Add 3D Rooms to Home Assistant](https://my.home-assistant.io/badges/config_flow.svg)](https://my.home-assistant.io/redirect/config_flow/?domain=three_d_rooms)

Or go to **Settings → Devices & services → Add integration**, search for **3D Rooms**, and confirm setup. Refresh your browser to see **3D Rooms** in the sidebar.

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

1. Open a room and choose **Create dashboard view**.
2. Frame the room using the camera controls and give the view a name.
3. Choose **Save view**, then select it in the dashboard card editor.

Cards linked to a saved view follow later changes automatically. Use **Override for this card** to customize an individual field, or **Reset to view** to follow the saved value again.

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

Use `view: floor` for an orthographic floor plan. Optional fields include `title`, `zoom` and `interactive`. To follow a saved view, copy the configuration from **Use in dashboard → Advanced YAML** in the manager.

</details>

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

Licensed under the [MIT license](LICENSE).
