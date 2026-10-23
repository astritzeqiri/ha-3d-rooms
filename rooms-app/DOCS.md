# Using 3D Rooms

Open the app through Home Assistant's sidebar as an administrator. Add a prepared model ZIP, open **Model settings**, and choose an entity for each listed light. Unmapped lights remain visible. **Preview lighting** simulates appearance without sending device commands; turn it off for live control.

Lights show only controls supported by their entity: on/off, brightness, color, Kelvin white temperature, advertised effects and fade times. Color and white temperature are separate modes. An unavailable or disconnected entity is shown explicitly and cannot be controlled. Actual Home Assistant state is authoritative.

Model files and entity mappings are saved under `/data` and included with app backups. This app serves no unauthenticated host port. For package preparation and installation details, see the project README.
