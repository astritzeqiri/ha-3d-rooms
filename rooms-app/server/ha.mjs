import WebSocket from "ws";
import { EventEmitter } from "node:events";

export class HABridge extends EventEmitter {
  constructor({
    token = process.env.SUPERVISOR_TOKEN,
    url = "ws://supervisor/core/websocket",
    retryDelay = 5000,
  } = {}) {
    super();
    this.token = token;
    this.url = url;
    this.retryDelay = retryDelay;
    this.entities = [];
    this.connected = false;
    this.pending = new Map();
    this.nextId = 0;
    this.stopped = false;
  }

  start() {
    if (!this.token || this.stopped) return;
    const socket = (this.socket = new WebSocket(this.url, {
      handshakeTimeout: 10000,
    }));
    let alive = true;
    socket.on("pong", () => {
      alive = true;
    });
    const heartbeat = setInterval(() => {
      if (!alive) {
        socket.terminate();
        return;
      }
      if (socket.readyState === WebSocket.OPEN) {
        alive = false;
        socket.ping();
      }
    }, 30000);
    heartbeat.unref();
    socket.on("error", () => {}); // The close handler publishes a disconnected state.
    socket.on("close", () => {
      clearInterval(heartbeat);
      this.connected = false;
      for (const request of this.pending.values()) {
        clearTimeout(request.timer);
        request.reject(new Error("Home Assistant disconnected."));
      }
      this.pending.clear();
      this.emit("change");
      if (!this.stopped)
        this.retry = setTimeout(() => this.start(), this.retryDelay);
    });
    socket.on("message", async (data) => {
      try {
        const message = JSON.parse(data);
        if (message.type === "auth_required") {
          socket.send(
            JSON.stringify({ type: "auth", access_token: this.token }),
          );
        } else if (message.type === "auth_ok") {
          // Subscribe before the snapshot so state changes during startup are not lost.
          await this.request(
            "subscribe_events",
            { event_type: "state_changed" },
            (event) => {
              const { entity_id, new_state } = event.data;
              this.entities = this.entities.filter(
                (entity) => entity.entity_id !== entity_id,
              );
              if (new_state) this.entities.push(new_state);
              this.emit("change");
            },
          );
          this.entities = await this.request("get_states");
          this.connected = true;
          this.emit("change");
        } else if (message.type === "auth_invalid") {
          socket.close();
        } else if (message.type === "result") {
          const request = this.pending.get(message.id);
          if (!request) return;
          clearTimeout(request.timer);
          if (!request.event) this.pending.delete(message.id);
          if (message.success) request.resolve(message.result);
          else {
            this.pending.delete(message.id);
            request.reject(
              new Error(
                message.error?.message ||
                  "Home Assistant rejected the request.",
              ),
            );
          }
        } else if (message.type === "event") {
          this.pending.get(message.id)?.event?.(message.event);
        }
      } catch {
        this.connected = false;
        this.emit("change");
        socket.close();
      }
    });
  }

  request(type, args = {}, event) {
    return new Promise((resolve, reject) => {
      if (this.socket?.readyState !== WebSocket.OPEN) {
        reject(new Error("Home Assistant is not connected."));
        return;
      }
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Home Assistant response timed out."));
      }, 10000);
      this.pending.set(id, { resolve, reject, event, timer });
      this.socket.send(JSON.stringify({ id, type, ...args }));
    });
  }

  async isAdmin(userId) {
    if (!userId || !this.connected) return false;
    const users = await this.request("config/auth/list");
    return users.some(
      (user) =>
        user.id === userId &&
        user.is_active &&
        (user.is_owner || user.group_ids?.includes("system-admin")),
    );
  }

  async call(command) {
    if (!this.connected) throw new Error("Home Assistant is not connected.");
    return this.request("call_service", command);
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.retry);
    this.socket?.close();
  }
}
