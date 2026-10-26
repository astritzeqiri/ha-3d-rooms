export function actionState(entity) {
  return {
    unavailable:
      !entity ||
      !/^(button|input_button|script|scene)\./.test(entity.entity_id) ||
      entity.state === "unavailable",
  };
}
export function actionCommand(entity, control, action) {
  if (
    action !== "press" ||
    !control.capabilities.includes("press") ||
    actionState(entity).unavailable
  )
    throw new Error("Choose an available preset button, script or scene.");
  const domain = entity.entity_id.split(".")[0];
  return {
    domain,
    service: ["button", "input_button"].includes(domain) ? "press" : "turn_on",
    target: { entity_id: entity.entity_id },
    service_data: {},
  };
}
