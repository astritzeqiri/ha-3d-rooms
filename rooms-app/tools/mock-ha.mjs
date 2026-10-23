// Development-only test server. Every entity and command is simulated.
import { EventEmitter } from "node:events";
import { kelvinToRgb } from "../shared/light.mjs";
import { createApp } from "../server/index.mjs";
class MockHA extends EventEmitter {
  connected = true;
  simulated = true;
  entities = [
    {
      entity_id: "light.test_kitchen",
      state: "on",
      attributes: {
        friendly_name: "SIMULATED Kitchen",
        brightness: 255,
        supported_color_modes: ["rgb", "color_temp"],
        color_mode: "color_temp",
        color_temp_kelvin: 3000,
        min_color_temp_kelvin: 2200,
        max_color_temp_kelvin: 6500,
        rgb_color: kelvinToRgb(3000),
        supported_features: 36,
        effect_list: ["off", "colorloop"],
        effect: "off",
      },
    },
    {
      entity_id: "light.test_living",
      state: "off",
      attributes: {
        friendly_name: "SIMULATED Living room",
        brightness: 255,
        supported_color_modes: ["color_temp"],
        color_mode: "color_temp",
        color_temp_kelvin: 4000,
        min_color_temp_kelvin: 2700,
        max_color_temp_kelvin: 6000,
        rgb_color: kelvinToRgb(4000),
      },
    },
  ];
  start() {}
  stop() {}
  async call(command) {
    const e = this.entities.find(
      (e) => e.entity_id === command.target.entity_id,
    );
    e.state = command.service === "turn_on" ? "on" : "off";
    if (command.service_data.brightness)
      e.attributes.brightness = command.service_data.brightness;
    const data = command.service_data;
    if (data.rgb_color) {
      e.attributes.rgb_color = data.rgb_color;
      e.attributes.color_mode = "rgb";
    }
    if (data.color_temp_kelvin !== undefined) {
      e.attributes.color_temp_kelvin = data.color_temp_kelvin;
      e.attributes.rgb_color = kelvinToRgb(data.color_temp_kelvin);
      e.attributes.color_mode = "color_temp";
    }
    if (data.effect !== undefined) e.attributes.effect = data.effect;
    this.emit("change");
  }
}
const app = await createApp({
  dataDir: ".data-mock",
  bridge: new MockHA(),
  production: true,
});
app.server.listen(5191, "127.0.0.1", () =>
  console.log(
    "SIMULATED Home Assistant test app on http://127.0.0.1:5191; no real device access.",
  ),
);
