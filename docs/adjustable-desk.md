# Adjustable desk device · 0.16.0

An `adjustable_desk` is a single device containing a height control, a direction
control and four optional macro slots. The manager displays one device card and
one settings box with all six entity mappings. The dashboard displays one desk
marker; selecting it opens a combined height, Up/Stop/Down and macro dialog.

The numeric entity supplies the visible height. The direction cover sends
`open_cover`, `stop_cover` and `close_cover` where supported, without treating its
percent opening as measured desk height. Macros invoke only their mapped entity:
`button`/`input_button` use `press`; `script`/`scene` use `turn_on`.
Unknown button timestamps do not make otherwise available buttons unusable.

Macro names are initially empty. Users can name each macro in the desk settings,
independently of the entity name. The mapped entity supplies its own HA icon.
Names persist with the room and survive replacing the model when the desk and
macro IDs remain the same. Existing standalone lights and covers are unchanged.

A model declares the low-level controls and an optional device wrapper:

```json
{
  "devices": [{
    "id": "desk-height",
    "type": "adjustable_desk",
    "label": "Desk",
    "height": "desk-height",
    "motion": "desk-motion",
    "macros": ["desk-preset-1", "desk-preset-2", "desk-preset-3", "desk-preset-4"]
  }]
}
```

The height control has type `number`, centimetre `unit: "cm"`, finite `min`, `max`,
`step`, `defaultValue`, `capabilities: ["set_value"]` and bound GLB nodes. Bind it
to `number.*` or `input_number.*` in centimetres. Both entity and model ranges and
steps are enforced before service calls. The office model uses 73–130 cm with
0.1 cm steps and preserves its measured 78.2 cm rest geometry.

Its GLB root includes `numberMotion: {min, max, restValue, metersPerUnit: 0.01,
defaultValue}`. Moving descendants include `numberMotionPart: {baseY, factor}`.
Each update derives motion from the authored rest transform, so repeated updates
and imports cannot accumulate drift. Feet remain stationary; supported items move
with the tabletop. Unknown/unavailable heights retain the last valid pose.

The direction control has type `cover`, `motion: "none"`, no geometry node IDs,
and `capabilities: ["open_close", "stop"]`. Macro controls have type `button` and
`capabilities: ["press"]`. Existing roller-shade geometry keeps its own protocol.

Names are saved under `deviceSettings[deviceId].macroNames[controlId]`. Native
requests use operation `device-settings`, with model, deviceId and macroNames.
This does not change storage or model schema versions; all additions are optional.

Included in 3D Rooms 0.16.0. Update the integration before importing a desk-enabled model.
