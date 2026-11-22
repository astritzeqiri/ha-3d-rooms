# Robot vacuum in a room model

A robot vacuum is a control of type `vacuum` in the room's `manifest.json`. It needs no scene nodes: 3D Rooms draws a dock and a robot itself.

```json
{
  "id": "corridor-vacuum",
  "label": "Robot vacuum",
  "type": "vacuum",
  "position": [-0.97, 0, 2.46],
  "facing": [1, 0, 0],
  "capabilities": ["start", "pause", "stop", "return_home", "locate"]
}
```

| Field | Meaning |
| --- | --- |
| `position` | Centre of the dock's base, on the floor, in room metres. The dock is about 0.44 m wide and 0.47 m deep (tower and ramp); its back sits 0.25 m behind this point. |
| `facing` | Optional horizontal unit vector (`y` must be 0) pointing out of the dock, where the robot drives out. Default `[0, 0, 1]`. House views rotate it with the room. |
| `capabilities` | Must include `start`; may add `pause`, `stop`, `return_home`, `locate`. A button also needs the matching feature reported by the vacuum entity. |
| `markerPosition` | Optional; otherwise the icon floats 0.7 m above the dock. |

Connect the control to any `vacuum.*` entity. Commands go through `vacuum.start`, `vacuum.pause`, `vacuum.stop`, `vacuum.return_to_base` and `vacuum.locate`.

Home Assistant reports the vacuum's activity (cleaning, returning, docked, paused, idle, error), not its position. While cleaning, the drawn robot drives out to 0.55 m in front of the dock and bumps around: short rays at 7 cm above the floor stop it before walls and furniture, and a floor check stops it at stairs and the edge of the scan. Open doorways let it into the next room in house views.

**Cleaning by area.** When the vacuum is sent to clean Home Assistant areas (`vacuum.clean_area`), each 3D room linked to one of those areas (room **Settings → Area**) becomes a destination, in the order chosen. The robot plans a route on a 25 cm grid (a cell needs floor and room for the robot's body; a step needs a clear ray), drives there, cleans without leaving that room's floor (found by a downward ray, so L-shaped rooms work), and moves to the next room after about a minute; it stays in the last one until it returns. Unlinked or unreachable areas are skipped. The card reads the areas from Home Assistant's `call_service` event, which only administrators receive; otherwise, and when cleaning starts outside Home Assistant, the robot roams. Returning, it retraces its own path (loops removed), turns to face out and reverses onto the dock. A single-room view only has that room's floor, so the robot stays inside it.

To add a vacuum to an existing room, add the control to the room's manifest and replace the room in place (the room's **Settings → Replace room model**) with a ZIP of that manifest and the room's `scene.glb`. Mappings, placement and icons are kept.

**The robot's dialog and extra entities.** A tap on the robot (card or full-screen page) opens 3D Rooms' own vacuum dialog, then the vacuum's extra entities as rows grouped by entity category. They are stored per room as `deviceEntities: { controlId: [entity ids] }` (websocket operation `device-entities`, admin only; at most 48, unique, vacuum controls only) and served on the control as `entities`. `device-entity-suggestions` lists the entities of the vacuum's device and of devices linked to it (`via_device`) or of the same integration entry named after it.

**The map.** One `image` entity per vacuum, stored per room as `deviceMaps: { controlId: "image.…" }` (websocket operation `device-map`, admin only; `""` removes it) and served on the control as `map`. The dialog's Map button shows the entity's `entity_picture`, refreshed when its state (the time of the last picture) changes. The map entity is left out of the entity rows.

**The current room.** One `sensor` entity per vacuum naming the room the robot is in (such as Roborock's "Current room"), stored per room as `deviceRooms: { controlId: "sensor.…" }` (websocket operation `device-room`, admin only; `""` removes it) and served on the control as `currentRoom`. "Add all from this vacuum and its dock" connects a `sensor.*current_room` entity. While the robot is away from the dock, the card turns the room name into a Home Assistant area: through the vacuum's own room-to-area mapping (its entity options `last_seen_segments` and `area_mapping`, set in the vacuum's entity settings), else an area with that name or alias, else a 3D room with that title. The robot then plans a route and drives to that 3D room as with cleaning by area; it never jumps. `unknown` and `unavailable` keep the last room. When the room's area is linked to no 3D room in the view (a single-room card while the robot cleans elsewhere), the robot is hidden until it returns or heads home. A name that matches nothing leaves the robot roaming. The registries are read with `config/entity_registry/get` and `config/area_registry/list`, which non-admin users may call; they are re-read at most once a minute when a room name is new.
