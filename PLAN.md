# Current direction — 0.4.0

The single HACS integration in custom_components/three_d_rooms supersedes the original add-on architecture below. It stores models in Home Assistant Core, includes the sidebar manager and dashboard card, and uses the current HA session. See README.md and VALIDATION.md for installation and tested behavior. The add-on remains only for migration and local authoring.

---

# 3D Rooms: Home Assistant app implementation plan

Status: proposed implementation plan, 2026-10-23. No Home Assistant deployment or real-device changes have been made.

## Product and first release

Run the existing Three.js viewer as an installable Home Assistant OS app (add-on), accessed through Ingress. The target is the user's Home Assistant OS Proxmox VM. No Proxmox-specific integration or server GPU is required: the browser renders the scene; the app stores models and communicates with Home Assistant.

The first release must support multiple imported models, including a whole floor; discover controls declared by each model; let an administrator map them to existing Home Assistant entities; and display live state. Deliver lights first, including independent fixtures and dim ambient visibility when they are off. Other device types follow through the same capability system.

## User workflow

1. Install the app, start it, and open 3D Rooms in the sidebar.
2. Add a model: upload a prepared model package, or a GLB with optional manual control placement.
3. Review its preview, floor/room names, detected declared controls, and import warnings.
4. Open Model settings → Devices. For each object, choose a compatible Home Assistant entity from a searchable list showing names and areas. Selecting a row highlights its object in 3D.
5. Leave objects unmapped if desired; they remain visible and are clearly identified as unconnected. A separate preview mode permits simulated interaction without sending commands.
6. Use the room. A light's actual state controls its appearance. Interactions send explicit on/off commands; external changes update the scene too.
7. Add other models or floors through the model library. Replace a model revision after reviewing preserved, missing, and new controls.

Model-specific mapping belongs inside the app's UI, rather than a long YAML form in the Supervisor Configuration tab. Supervisor options cover global operational settings only.

## What automatic export means

Automatic discovery is deterministic for models created by our exporter: the model author/exporter marks controllable objects, and the exporter writes their metadata. Geometry alone does not reliably identify a controllable light or its Home Assistant entity. Never guess and activate a real device from a mesh name.

For arbitrary GLB imports without metadata, offer a manual fallback: select an object or place a hotspot, label it, select its type, and map it. A single fused scan can use hotspots and separately placed virtual lights; it cannot automatically provide independent material changes or moving parts. AI-assisted suggestions are a later feature requiring review.

## Portable model package v1

Use a ZIP containing a versioned manifest, scene.glb, local textures if not embedded, and an optional thumbnail. Uploaded packages are data, never executable JavaScript or TypeScript. Retain the procedural source as authoring input, exporting a portable scene for distribution.

Manifest fields:

- Schema version, persistent model ID, revision, title, units and coordinate convention.
- Floor/room IDs, labels and bounds; camera defaults, wall/ceiling cutaway groups, ambient-light defaults.
- Controllable objects: stable semantic ID, label, room ID, type, capabilities, target node IDs, and optional interaction anchor.
- Light visual metadata: virtual light position/type/direction, intensity and color defaults, emissive targets and material isolation rules. On/off, brightness and color are distinct optional capabilities.

Keep entity IDs and household-specific mappings outside the package. Stable IDs must survive re-export; do not use runtime Three.js numeric IDs or node-array indexes. GLB extras may carry stable IDs, cross-validated against the manifest.

The exporter must preserve controllable objects, wall roots and material ownership through optimization. Current static batching can merge objects and remove their identity; protect interactive subtrees from merging. Clone shared materials when an independent state needs to change them. Exporting the current GLB alone will not preserve procedural callbacks such as walkability or cutaway behavior: transfer necessary behavior to declarative metadata and generic runtime logic.

## Architecture

Browser: existing Three.js/TypeScript viewer, extended with model library, upload flow, mapping editor and generic capability adapters. Load the selected floor on demand and release the prior scene's GPU resources. Keep runtime budgets and mobile quality settings; do not load every model simultaneously.

App server: Node.js/TypeScript to share manifest validation and types with the viewer. Own uploads, catalog, mappings, entity metadata, live-state relay and bounded service commands. SQLite stores model records, revisions and bindings; model files live under persistent /data. Use staged imports and atomic activation so failed uploads do not damage the working model. Include schema migrations and a consistent backup procedure.

Home Assistant connection: backend-only Supervisor token, homeassistant_api enabled, initial state snapshot and WebSocket updates with reconnect/resynchronization. Query entity/area metadata and supported capabilities for the picker. Home Assistant is authoritative; the browser shows a pending action until state confirmation or timeout. Unavailable, unknown, disconnected and unmapped are distinct from off. Do not replay old commands after reconnection.

Ingress: serve the entire UI, assets, uploads and browser WebSocket through the assigned prefix. Replace root-relative model URLs and ensure the socket path respects that prefix. Accept external access through Ingress only. Keep credentials on the backend. Enforce administrator authorization for imports/mapping/deletion; define and verify viewer control permissions explicitly, because the app's Supervisor token does not automatically inherit an individual user's entity permissions. Restrict commands to configured bindings and supported actions, rather than exposing an arbitrary service-call proxy.

## Lighting and floor behavior

Replace the single global lighting interface with independent controls plus a separate ambient baseline. Toggling one room's light must not dim every floor or extinguish unrelated fixtures. Retain minimum visibility as a model/viewer setting, separate from actual device state. Batch expensive indirect-light refreshes during rapid brightness changes. Support multiple visual fixtures mapped to one entity; show the shared mapping in settings.

First release: light on/off and brightness where supported. Later: light color, switches, read-only sensor labels, cover position/animation, fans and climate controls. Capability adapters define allowed entity domains, supported actions, state interpretation and scene effects. A switch-backed light is supported through an explicit switch mapping, not an assumed brightness-capable light.

## Implementation stages and acceptance gates

1. Model contract and exporter. Define schema v1, stable IDs and safe optimization rules. Export the existing kitchen ceiling light into a portable package. Gate: import/export round-trip preserves appearance, textures, controls and cutaway behavior; no personal photos ship in a public image or sample.
2. Generic runtime and library. Load models without app rebuilds; support GLB fallback, preview, selection, replacement and deletion. Gate: two independent models work, identities persist after restart, unsupported files give useful errors and failed imports leave the old model intact.
3. Device mapping and HA bridge. Implement a development HA adapter, searchable picker, saved bindings and bidirectional light state. Gate: commands reach only mapped entities; wall-switch/automation changes update the model; failures and reconnection are visible; model revision changes never silently reassign a control.
4. HA OS packaging. Add repository metadata, app configuration, pinned container builds, Ingress, persistent storage, health checks and backup/restore. Start with amd64 if confirmed by the VM; add aarch64 build verification for broader distribution. Gate: install/start/restart/update/backup/restore on HA OS without modifying Proxmox or depending on the Mac.
5. Floor and mobile validation. Test independent lights in multiple rooms, multiple models mapped to the same entity, repeated model switching and touch interaction in the HA iPhone app. Check lighting and memory budgets with a representative full-floor model.

Use focused schema/import, mapping, capability, reconnection and backup tests plus browser verification. Test real light commands on the user's nominated test entity only when device testing is authorized. The planning request does not authorize deployment or device changes.

## Import boundaries

Validate schema, file count, expanded size, archive paths, referenced assets, GLB structure and control IDs before activation. Reject path traversal, symlinks, executable payloads and remote asset dependencies in v1. Keep model assets behind Ingress and exclude raw capture photos/depth frames from exported runtime packages by default. Texture imagery remains part of the model and must be treated as private household data.

## Initial scope decisions

- One app manages many models; no separate app installation per floor.
- Separate model packages from installation-specific bindings.
- Begin with the existing kitchen as a private end-to-end fixture, then a two-room floor.
- Keep the current standalone viewer usable through a local simulated adapter.
- Defer dashboard cards, visual floor assembly, automatic scan reconstruction, AI object detection and non-light controls until the import-to-live-light workflow works.

## Official references

- Ingress: https://developers.home-assistant.io/docs/apps/presentation/
- Internal Home Assistant API access: https://developers.home-assistant.io/docs/apps/communication/
- App configuration: https://contributors.home-assistant.io/apps/reference/configuration/
- State and action WebSocket protocol: https://developers.home-assistant.io/docs/api/websocket/
- App persistence and backups: https://contributors.home-assistant.io/apps/how-apps-work/
