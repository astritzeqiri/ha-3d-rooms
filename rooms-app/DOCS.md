# Legacy 3D Rooms add-on

The recommended installation is now the single **3D Rooms HACS Integration**. See the repository README. A separate add-on and HACS Dashboard download are no longer required.

This add-on is retained for local authoring and migration from versions 0.1–0.3.

## Migrate existing rooms

Update this add-on to 0.4.0, select a room, and use **Model settings → Export room & mappings**. In the new integration's sidebar, choose **Add a model** and upload the resulting ZIP. Repeat for other rooms. The exported scene and saved entity mappings are preserved. Verify them in the integration before stopping or uninstalling the add-on.

Keep model packages or a backup of the old add-on until migration is verified. Original model ZIPs can also be uploaded, but need their entity mappings configured again.
