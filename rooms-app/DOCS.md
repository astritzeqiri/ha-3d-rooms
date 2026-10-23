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
