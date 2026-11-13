/**
 * Library changes for any signed-in user. Home Assistant lets only
 * administrators subscribe to custom events, so the integration offers its
 * own `three_d_rooms/subscribe`; an older backend falls back to the event.
 * Resolves to the unsubscribe function.
 */
export async function subscribeUpdates(connection, onUpdate) {
  if (connection.subscribeMessage) {
    try {
      return await connection.subscribeMessage(() => onUpdate(), {
        type: "three_d_rooms/subscribe",
      });
    } catch (error) {
      if (error?.code !== "unknown_command") throw error;
    }
  }
  return connection.subscribeEvents(() => onUpdate(), "three_d_rooms_updated");
}
