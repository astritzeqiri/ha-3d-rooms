# Independent room packages with a shared house anchor

A room ZIP still contains `manifest.json`, `scene.glb`, and optional mappings. It may now contain
`house-placement.json`, also embedded as `housePlacement` in the manifest. Both representations
must agree. Geometry and control positions remain in room-local metres with Y up; placement is
applied only in a composed house/floor view. Single-room views retain their original framing.

```json
{
  "schemaVersion": 1,
  "houseId": "house-example",
  "houseName": "My house",
  "roomId": "hallway",
  "transform": [1,0,0,0, 0,1,0,0, 0,0,1,0, 4,0,2,1],
  "floors": [
    {"id":"first","name":"1st floor","minY":0,"maxY":2.8},
    {"id":"second","name":"2nd floor","minY":2.8,"maxY":6}
  ],
  "floorIds": ["first","second"]
}
```

The transform is a column-major rigid matrix from room space to house space. Scale, reflection,
non-finite numbers and tilting the vertical axis are rejected. The web builder retains a stable
house ID and uses `room-<room UUID>` as the stable model ID. Export all rooms after moving a
connected group so their packages describe the same assembly. Upload order is irrelevant.

Floor ranges are house-space elevations, not room-local heights. They are editable measurements;
initial example heights are not a measurement of the user's building. Assignment is many-to-many:
one hallway model can appear on two floors. A floor view loads assigned rooms, clips their geometry
to the height range, and retains live appearance for controls whose transformed anchors are inside that range (lower
boundary inclusive, upper exclusive). Whole-house view retains complete rooms.

3D Rooms derives read-only whole-house/floor model entries from the room library. These are usable
in the manager, saved views and the bundled dashboard card. Device/control and GLB node IDs are
namespaced per source room. Bindings are read from the original room, avoiding duplicate device
configuration and keeping device configuration in the source rooms. Commands to composed house/floor targets are rejected; use individual room views for entity interaction.

In a source room's Settings, match each exported height range to an actual Home Assistant floor, then check every occupied HA floor. The native floor registry supplies IDs and names, and renames are reflected when the catalog is refreshed. Shared `haFloorId` links are optional portable metadata and propagate across rooms in the house. The selected IDs come from HA; multi-floor 3D model membership is stored in 3D Rooms without rewriting HA's area/floor registry. Existing packages without
placement remain independent rooms. Replacing geometry with a legacy package retains existing
placement. Replacing within the same house retains local floor choices that still exist. Model IDs,
compatible bindings and saved views remain stable. Exported room ZIPs retain placement and floors.

The newest imported member supplies the house's floor definitions. Keep floor definitions consistent
by exporting the rooms from the same saved web house. Exporting the complete house GLB remains an
optional geometry snapshot; independent room ZIPs are the editable Home Assistant workflow.

The **Dashboard view scope** selector offers This room, Whole house and linked HA floors. Selecting a scope loads the corresponding composition; Create dashboard view then saves camera framing for that room/house/floor. A floor composition clips every member to the saved house-space height band, so a multi-floor hallway is not duplicated or shown in full on each floor.

## Presentation-only house views

House and floor compositions show room counts, floor scope and the assembled scene. Device counts,
setup links, entity mapping, marker editing and command actions belong to individual source rooms.
House lighting, shades and moving furniture may still reflect their room entities, but a house
card exposes no device buttons, trays, fixture clicks or entity dialogs. The native command API
rejects house/floor targets; source-room device control remains unchanged.

The house dashboard editor offers House / floor, camera presets, perspective/plan, framing, title,
height and other presentation settings. Device tools are hidden, and saved house views discard
legacy marker overrides. Existing individual room views retain their marker configuration.
