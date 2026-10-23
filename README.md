# 3D Rooms for Home Assistant

A separate Home Assistant OS app (add-on) project. Import multiple private 3D rooms/floors and connect declared lights to existing Home Assistant entities. Version 0.3.1 is an early working build, not yet validated on the user's HA OS VM.

## This private repository

Source: https://github.com/astritzeqiri/ha-3d-rooms

This repository remains private. Home Assistant's normal repository URL field does not inherit your GitHub sign-in and cannot fetch this private URL without separate Git authentication. For the first installation, use the local app instructions below and transfer the prepared source folder to HA OS. Do not put a GitHub token into a repository URL: the Supervisor stores and logs repository URLs.

Your uploaded household models and entity mappings stay in the installed app's private data directory; they are not distributed through this repository. The local `model-exports` folder, app data, dependencies and generated releases are excluded by `.gitignore`.

## Implemented

- Responsive Three.js model viewer with orbit/reset, floor/room titles and optional dollhouse cutaway metadata.
- ZIP model imports, persistent library, model selection, deletion and independent light controls.
- Versioned manifest with stable control IDs, embedded GLB scene and declared on/off/brightness/color capabilities.
- Searchable light/switch entity mapping, highlight action and saved per-model bindings.
- Backend Home Assistant WebSocket connection: initial state, external updates, reconnect, explicit on/off commands brightness, RGB color, Kelvin white temperature, advertised effects and fades.
- Pending-command feedback, unavailable/disconnected states and a clearly separate preview mode with no service calls.
- Dim ambient visibility when lights are off.
- HA OS app configuration, Ingress-only access, admin-verified mutations and a container build.
- Import validation, archive path/size limits, no executable model code, no external GLB resource URLs.

The original viewer and iPhone capture app remain in the sibling `3d-model-anything` project. They are not replaced.

## Local development

Requires Node 22.12+ (Node 24 recommended).

```sh
cd rooms-app
npm ci
npm run example
npm run dev
```

Open http://127.0.0.1:5190. Upload `rooms-app/examples/sample-floor.zip`. It contains two example lights. The local preview has no real Home Assistant credentials; entity mapping is disabled until connected.

```sh
npm test
npm run build
npm start
```

A development-only simulated HA adapter is available with `node tools/mock-ha.mjs` on port 5191. Its test entities and commands never access real devices. Production images do not contain authoring/test tools.

## Upload-ready models

Open the `model-exports/` folder at the root of this local app project. It contains `kitchen.zip` and `sample-floor.zip`, ready to upload without extracting. Local imports, including the kitchen authoring export, automatically save their original ZIP here. HA installations keep their models in `/data` instead.

## Private kitchen export

The existing kitchen has been exported and imported locally. Its package is `model-exports/kitchen.zip`, ignored by Git. Raw scan photographs/depth files are excluded, but the embedded textures include personal room imagery. Do not put this ZIP in a public repository or container image.

To regenerate it, run the original viewer on port 5188 and this app in development on port 5190. Open http://127.0.0.1:5190/export-kitchen.html and choose **Export and import kitchen**. The local exporter reads the sibling kitchen source, protects its light identity from batching, and preserves cutaway metadata. A duplicate model ID is rejected in this release; remove the old model first only if its mappings are no longer needed, or export under a new stable model ID.

To save an imported model back to a portable ZIP without household entity mappings:

```sh
cd rooms-app
node tools/export-model.mjs kitchen
```

## Install on Home Assistant OS

No Proxmox changes, GPU passthrough or externally exposed port are needed.

For a first local installation:

1. Transfer the contents of `rooms-app/` to `/addons/three_d_rooms/` on HA OS, using Samba's `addons` share or SSH access that exposes that folder. Transfer the **source folder**, not just the built `dist/` files. Exclude `node_modules`, `.data`, `.data-mock`, and `dist`. The Dockerfile, config.yaml and package-lock.json must be directly inside `/addons/three_d_rooms/`.
2. In Home Assistant, open **Settings → Apps/Add-ons → Store**, refresh/reload the local app list, and find **3D Rooms** under local apps. Labels depend on your HA version.
3. Install it. The initial build downloads the pinned Node base image and npm dependencies.
4. Start it, enable **Show in sidebar**, and open its web UI as an administrator.
5. Upload `model-exports/kitchen.zip` through the app's **Add a model** dialog.
6. Open **Model settings**, find the ceiling light and select the actual light entity. Preview lighting can be used first without issuing commands. Turn preview off to use live Home Assistant state and commands.

The app uses the Supervisor-provided token on the backend; do not paste a long-lived access token into the browser or configuration. Requests must arrive from the Ingress proxy. Writes and commands additionally verify the authenticated Ingress user's active administrator membership through HA. Missing identities are denied. This first version limits mutations/control to administrators; per-user entity permissions are not implemented.

After a hosted repository is chosen, the whole project can be published as an add-on repository with `repository.yaml` at its root and `rooms-app` as its app directory. No repository has been published by this task.

## Storage and recovery

Local development stores models, manifests and bindings in `rooms-app/.data`. On HA OS all persistent files live under `/data`, which is included in app backups. The app requests cold backups so the Supervisor stops it while taking a consistent copy. The catalog uses versioned atomic JSON writes in this first release; the original plan's SQLite migration is deferred until more complex model editing/revision workflows need it. Import/delete mutations are serialized. No application history or background tasks are required.

Stop the app before manually copying/restoring its data directory; copy the complete catalog and `models/` folder together. HA-managed backups are the normal HA OS recovery path. A failed or duplicate import leaves existing models intact. Large libraries increase backup sizes.

## Model package v1

See `rooms-app/examples/manifest.json`. ZIP files contain `manifest.json` and `scene.glb`; the GLB must embed textures/buffers, use meters and Y-up, and stay within 100 MB compressed / 300 MB expanded. A model can represent a whole floor. Controls need stable semantic IDs; entity mappings are stored separately.

For a fixture's emissive material to follow a control, give its glTF node an `extras.controlId` matching an entry in that control's `nodeIds`. `position` declares the virtual point light and selectable hotspot. `extras.wallNormal` is an inward-facing world-space normal for a cutaway wall; `extras.ceiling: true` hides a ceiling in the dollhouse view. These cutaway conventions currently assume a model with no extra runtime rotation.

Package a scene with:

```sh
node tools/package-model.mjs manifest.json scene.glb floor.zip
```

## Next milestones / limits

- Raw GLB upload with manual hotspot placement, and in-app object authoring are not implemented yet. Current imports require a prepared package.
- Model revision replacement and mapping reconciliation are not implemented; duplicate IDs are rejected to protect existing data.
- Lights and explicitly mapped switch-backed lights only. Sensors, covers, climate and fans are future adapters.
- No floor assembly/scan reconstruction inside HA; export a prepared complete floor.
- Basic lights and shadows are used in this generic viewer. Original viewer AO, reflection capture and other custom shader behavior are not fully portable through GLB.
- Actual HA OS Ingress, backups and real-device behavior still require verification on the user's VM. Local tests use a simulated HA protocol server.

## Verification

Run `npm test` and `npm run build` from `rooms-app`. The focused tests cover package/manifest rejection, GLB resource restrictions, durable bindings, API command allowlists, Ingress direct-access denial and WebSocket state/authorization behavior. Browser verification covers the private kitchen, a second model, independent lights, imports, mapping UI, dim-off lighting and small-screen layout. See `VALIDATION.md` for the current run.

## Official references

- [Ingress](https://contributors.home-assistant.io/apps/guides/ingress/)
- [Home Assistant communication](https://contributors.home-assistant.io/apps/guides/communication/)
- [App configuration](https://contributors.home-assistant.io/apps/reference/configuration/)

## Color lights and tunable whites (0.2.0)

The app reads each mapped entity's `supported_color_modes`, Kelvin limits, effect list and supported features. Color-capable lights show a color picker and presets. Tunable-white lights show a Kelvin slider bounded by their actual range. A combined bulb can switch between color and white temperature; commands never send both modes together. White-only and switch-backed lights do not show unsupported controls. Existing model packages work without re-exporting because the generic scene light supports color. New manifests may explicitly declare `color` and `color_temp` capabilities.

Changes from HA update the fixture's emitted light and emissive material. Warm/cool color in the 3D view is a visual approximation; the actual Kelvin value is sent to HA. RGB commands work with HA color lights using HS, XY, RGB, RGBW or RGBWW modes through HA's conversion.

Advertised effects are selectable by name. The scene follows the color HA reports; it does not invent an animation for device effects that HA does not report continuously. Lights advertising transitions offer a fade time for the next real change. Preview mode supports immediate color/white/brightness changes and sends no device commands.

## Dashboard floor card (0.3.1)

The app has a **Floor view** preset and an **Add to dashboard** setup dialog. The native Home Assistant card shows a front-facing perspective view with hidden ceilings and no entity icons, markers or sidebar. The actual modeled light fixture stays visible: click it to open the mapped Home Assistant light’s native controls, or use Tab to reach its keyboard control. Unmapped fixtures prompt you to connect an entity in Model settings. Light color/brightness still follows actual HA entity states. Floor-view ambient light remains constant so unlit rooms stay readable.

1. Update/install the 0.3.1 add-on on HA OS. Keep the model and its entity mappings there.
2. In the app, select a model and choose **Add to dashboard → Download card**. Alternatively, use `rooms-app/dist/card/three-d-rooms-card.js` after building locally.
3. Copy that JavaScript file into Home Assistant's `config/www/` folder as `three-d-rooms-card.js`. Only the card code goes there; model assets stay behind authenticated Ingress.
4. In your dashboard resources, add `/local/three-d-rooms-card.js?v=0.3.1` with type **JavaScript module**. Advanced Mode may be needed to see dashboard resource settings.
5. Add a **Manual** card with:

```yaml
type: custom:three-d-rooms-card
model: kitchen
height: 600
tilt: 8
heading: 0
```

`tilt` is degrees away from straight overhead (0–35); `heading` rotates the floor around its vertical axis. `height` sets pixels (180–1600). Camera interaction is locked by default, while fixtures remain clickable. Set `interactive: true` to enable camera movement. Use `view: floor` with `tilt: 8` for the previous orthographic view. Optional `title` adds a card heading.

The card automatically finds the installed 3D Rooms add-on. If multiple copies exist, add `addon: YOUR_INSTALLED_ADDON_SLUG`. The first version requires an administrator account, matching the add-on. It obtains an Ingress session through HA's authenticated frontend WebSocket API, periodically validates it, and does not store a long-lived access token. The Supervisor frontend API may change between HA versions, so real HA OS testing remains required. Entity mappings and appearance come from the installed model; no separate card mappings or device icons are needed.

The card is a frontend resource alongside the add-on. It does not require an iframe, copying private GLBs to `/local`, or exposing the add-on's port. A complete floor must be exported/imported as a model; the current kitchen preview is one room.

Local preview: http://127.0.0.1:5190/card-demo.html?model=kitchen . This authoring page is not included in the production viewer entrypoints.

### Install the dashboard card through HACS

The same repository also packages the **frontend card** as a HACS **Dashboard** repository (`hacs.json` and the built `dist/ha-3d-rooms.js` at repository root). The add-on remains installed separately and stores the private models.

In HACS, open **Custom repositories**, add `https://github.com/astritzeqiri/ha-3d-rooms`, choose **Dashboard**, and download **3D Rooms Dashboard**. Your HACS GitHub connection must have access to this private repository. Reload the browser, then add the Manual card shown above. HACS normally registers the resource; if needed, add `/hacsfiles/ha-3d-rooms/ha-3d-rooms.js` as a JavaScript module. Do not register both the manual `/local` resource and the HACS resource.

After changing the card source, run `npm run build` in `rooms-app`. This also refreshes the root `dist/ha-3d-rooms.js` used by HACS. Household models are never included in that bundle.
