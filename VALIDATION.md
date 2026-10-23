# Validation — 2026-10-23

Version: 0.3.1 early build.

## Passed

- Production Vite build and source formatting check. The Three.js renderer is lazy-loaded; the 637 KB renderer chunk still produces a build-size advisory.
- Twelve focused Node tests: manifest/control validation; service/brightness allowlists; scene references/external resource rejection; archive traversal/executable/size rejection; durable catalog/bindings and duplicate protection; import/map/control API behavior; direct-access Ingress denial; simulated HA WebSocket authentication/state/administrator checks; reconnect/resnapshot without replaying commands.
- Docker image builds locally from the pinned multi-architecture Node base. Tested locally on amd64; aarch64 is declared but has not been built or exercised here.
- Container health endpoint, sample ZIP import, scene download, and model persistence across a container restart.
- Production app loads through a localhost proxy at `/api/hassio_ingress/test/`, including its scripts, stylesheet, GLB and event stream; no browser errors in that test. This checks URL handling, not actual Supervisor authorization.
- Private kitchen exported with embedded textures, stable ceiling-light metadata and cutaway groups; imported into the standalone model library.
- Sample floor imported through the browser file picker and displayed alongside the kitchen.
- Independent preview lights: kitchen sample light off while living room light stays on.
- Browser mapping to two simulated entities; mapped on/off command confirmed; saved mapping survives page reload.
- 375-pixel portrait and 812-pixel landscape layouts checked; no horizontal document overflow. Phone mapping dialog scrolls to its actions.
- Light-off mode retains ambient visibility. Lights do not change the floor's ambient baseline.

## Still requires the user's HA OS VM

- Real Supervisor installation/startup and authenticated Ingress user identity/administrator checks.
- Real entity discovery and device command/state behavior.
- Actual HA-managed cold backup/restore and upgrade behavior.
- Home Assistant companion app on the physical iPhone and performance on a representative full-floor model.

No real Home Assistant credentials were used and no real device commands were sent. The source and card bundle are published to the private project repository; no deployment to Home Assistant was performed.

## Color-control verification (0.2.0)

- Backend tests cover RGB byte validation, mutually exclusive color/temperature modes, Kelvin bounds, unsupported features, advertised effects and transition limits.
- Shared tests cover color-mode discovery, warm/cool visualization, authoritative active modes and confirmation tolerances.
- API integration verifies validated color/temperature/effect values reach only the mapped light.
- Browser checked a combined RGB/white simulated light (2200–6500 K) and white-only light (2700–6000 K). Only the combined light shows a color picker/effects/fade. Color preset, 2700 K white and advertised effect selections confirmed against the simulated backend.
- Existing private kitchen package displays color/white controls in preview without re-export.
- No real Home Assistant device commands were sent.

## Dashboard verification (0.3.0)

- Fifteen tests pass, adding floor-bounds framing across portrait/landscape aspects and rotations, authenticated Ingress model transport, missing models, ambiguous add-ons, and cross-origin preview denial.
- Both the regular viewer and the standalone native-card bundle build.
- Browser preview uses the private kitchen model with hidden ceiling, all floor walls, overhead orthographic camera and hidden markers. The sample floor also loads through the same card.
- Native card uses current Home Assistant frontend session endpoints; actual HA OS resource registration, Supervisor sessions and companion-app rendering still need validation on the user's installation.

- Browser checked the model-specific dashboard configuration dialog, multiple models, and light-off readability; no console errors. Narrow kitchen-card preview fits without horizontal document overflow.
- HACS packaging uses root hacs.json and the self-contained root dist/ha-3d-rooms.js bundle; private model textures/GLBs are excluded. HACS installation itself still needs verification on the user's HA instance.

## Front perspective and fixture controls (0.3.1)

- Sixteen tests pass, including perspective bounds across narrow/wide viewports, headings and tilts. Production viewer and card builds pass.
- Browser clicking the physical kitchen pendant opens its local preview controls; power and warm-temperature changes visibly update the room. Off retains low ambient visibility.
- Mapped lights dispatch the native Home Assistant more-info event. Real Home Assistant dialog/device behavior remains to be checked on the user’s instance.
