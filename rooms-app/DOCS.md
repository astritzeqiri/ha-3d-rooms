# Using 3D Rooms

Open the app through Home Assistant's sidebar as an administrator. Add a prepared model ZIP, open **Model settings**, and choose an entity for each listed light. Unmapped lights remain visible. **Preview lighting** simulates appearance without sending device commands; turn it off for live control.

Lights show only controls supported by their entity: on/off, brightness, color, Kelvin white temperature, advertised effects and fade times. Color and white temperature are separate modes. An unavailable or disconnected entity is shown explicitly and cannot be controlled. Actual Home Assistant state is authoritative.

Model files and entity mappings are saved under `/data` and included with app backups. This app serves no unauthenticated host port. For package preparation and installation details, see the project README.

## Dashboard floor view

Choose **Floor view** for a mostly overhead camera. Choose **Add to dashboard** for the frontend-card download and model-specific configuration. The dashboard card hides ceilings, device markers and control panels, and follows HA light state. It needs the updated add-on and an administrator login. Install it through HACS as a **Dashboard** repository, or copy the downloaded JS into `config/www` and register it as a dashboard JavaScript module.
