import http from "node:http";
import {
  readFile,
  rm,
  mkdtemp,
  mkdir,
  writeFile,
  rename,
} from "node:fs/promises";
import { join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "./store.mjs";
import { extractPackage, MAX_UPLOAD } from "./import.mjs";
import { validateBinding, commandFor } from "./manifest.mjs";
import { HABridge } from "./ha.mjs";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
export async function createApp({
  dataDir = process.env.DATA_DIR || join(root, ".data"),
  bridge = new HABridge(),
  production = process.env.NODE_ENV === "production",
  ingress = !!process.env.SUPERVISOR_TOKEN,
  exportDir = ingress ? null : join(root, "../model-exports"),
} = {}) {
  const store = await new Store(dataDir).open();
  bridge.start();
  const vite = production
    ? null
    : await (
        await import("vite")
      ).createServer({
        configFile: join(root, "vite.config.mjs"),
        server: { middlewareMode: true },
      });
  const clients = new Set();
  const snapshot = () => ({
    connected: bridge.connected,
    mode: bridge.simulated
      ? "simulation"
      : ingress
        ? "homeassistant"
        : "preview",
    entities: bridge.connected
      ? bridge.entities.filter((e) => /^(light|switch)\./.test(e.entity_id))
      : [],
  });
  const changed = () => {
    for (const res of clients)
      res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
  };
  bridge.on("change", changed);
  const keepalive = setInterval(() => {
    for (const res of clients) res.write(": heartbeat\n\n");
  }, 25000);
  keepalive.unref();
  const json = (res, status, data) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  };
  const body = async (req, limit) => {
    let size = 0;
    const chunks = [];
    for await (const c of req) {
      size += c.length;
      if (size > limit) throw new Error("Upload exceeds the size limit.");
      chunks.push(c);
    }
    return Buffer.concat(chunks);
  };
  const server = http.createServer(async (req, res) => {
    try {
      const path = new URL(req.url, "http://localhost").pathname;
      if (path === "/health") {
        res.end("ok");
        return;
      }
      // Do not trust client-supplied ingress/user headers on any exposed port.
      const remote = req.socket.remoteAddress?.replace("::ffff:", "");
      if (ingress && remote !== "172.30.32.2") {
        json(res, 403, { error: "Use Home Assistant Ingress." });
        return;
      }
      if (!["GET", "HEAD"].includes(req.method)) {
        if (req.headers["x-rooms-request"] !== "1")
          throw new Error("Missing request verification.");
        if (
          ingress &&
          !(await bridge.isAdmin(req.headers["x-remote-user-id"]))
        ) {
          json(res, 403, {
            error: "Administrator access is required for this early release.",
          });
          return;
        }
        if (req.headers.origin) {
          const origin = new URL(req.headers.origin);
          if (
            origin.host !== req.headers["x-forwarded-host"] &&
            origin.host !== req.headers.host
          )
            throw new Error("Cross-origin requests are not allowed.");
        }
      }
      if (path === "/api/status" && req.method === "GET") {
        json(res, 200, snapshot());
        return;
      }
      if (path === "/api/events" && req.method === "GET") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return;
      }
      if (path === "/api/models" && req.method === "GET") {
        json(
          res,
          200,
          store.state.models.map(({ folder, ...m }) => m),
        );
        return;
      }
      if (path === "/api/models" && req.method === "POST") {
        const buffer = await body(req, MAX_UPLOAD);
        const stage = await mkdtemp(join(dataDir, "import-"));
        try {
          const manifest = await extractPackage(buffer, stage);
          const model = await store.install(stage, manifest);
          let exportWarning;
          if (!ingress && exportDir) {
            try {
              await mkdir(exportDir, { recursive: true });
              const destination = join(exportDir, `${manifest.id}.zip`);
              await writeFile(destination + ".tmp", buffer);
              await rename(destination + ".tmp", destination);
            } catch {
              exportWarning =
                "Model imported, but the upload-ready ZIP could not be saved to model-exports.";
              console.warn(exportWarning);
            }
          }
          json(res, 201, {
            id: model.id,
            ...(exportWarning ? { exportWarning } : {}),
          });
        } finally {
          await rm(stage, { recursive: true, force: true });
        }
        return;
      }
      const match = path.match(
        /^\/api\/models\/([a-z0-9_-]+)(?:\/(bindings|command|scene\.glb))?$/,
      );
      if (match) {
        const m = store.find(match[1]);
        const op = match[2];
        if (req.method === "DELETE" && !op) {
          await store.remove(m.id);
          json(res, 200, { ok: true });
          return;
        }
        if (req.method === "GET" && op === "scene.glb") {
          res.writeHead(200, {
            "Content-Type": "model/gltf-binary",
            "Cache-Control": "private, max-age=3600",
          });
          res.end(
            await readFile(join(dataDir, "models", m.folder, "scene.glb")),
          );
          return;
        }
        if (req.method === "PUT" && op === "bindings") {
          const b = JSON.parse(await body(req, 65536));
          const control = m.controls.find((c) => c.id === b.controlId);
          if (!control) throw new Error("Unknown model control.");
          if (b.entityId) {
            if (!bridge.connected)
              throw new Error(
                "Connect to Home Assistant before mapping entities.",
              );
            validateBinding(
              control,
              bridge.entities.find((e) => e.entity_id === b.entityId),
            );
            m.bindings[control.id] = b.entityId;
          } else delete m.bindings[control.id];
          await store.save();
          json(res, 200, { bindings: m.bindings });
          return;
        }
        if (req.method === "POST" && op === "command") {
          const b = JSON.parse(await body(req, 65536));
          const c = m.controls.find((c) => c.id === b.controlId);
          const entityId = m.bindings[c?.id];
          if (!c || !entityId)
            throw new Error("Connect this object to an entity first.");
          const entity = bridge.entities.find((e) => e.entity_id === entityId);
          if (!entity || ["unavailable", "unknown"].includes(entity.state))
            throw new Error("This entity is unavailable.");
          await bridge.call(
            commandFor(
              entityId,
              b.action,
              b.brightness,
              c,
              {
                ...(b.rgb_color !== undefined
                  ? { rgb_color: b.rgb_color }
                  : {}),
                ...(b.color_temp_kelvin !== undefined
                  ? { color_temp_kelvin: b.color_temp_kelvin }
                  : {}),
                ...(b.effect !== undefined ? { effect: b.effect } : {}),
                ...(b.transition !== undefined
                  ? { transition: b.transition }
                  : {}),
              },
              entity,
            ),
          );
          json(res, 200, { ok: true });
          return;
        }
      }
      if (path === "/card/three-d-rooms-card.js" && req.method === "GET") {
        const resource = await readFile(
          join(root, "dist/card/three-d-rooms-card.js"),
        );
        res.writeHead(200, {
          "Content-Type": "text/javascript",
          "Cache-Control": "no-cache",
          "X-Content-Type-Options": "nosniff",
        });
        res.end(resource);
        return;
      }
      if (path.startsWith("/api/")) {
        json(res, 404, { error: "Not found." });
        return;
      }
      if (vite) {
        vite.middlewares(req, res, () => {
          res.statusCode = 404;
          res.end("Not found");
        });
        return;
      }
      const file = resolve(
        root,
        "dist",
        "." + decodeURIComponent(path === "/" ? "/index.html" : path),
      );
      if (!file.startsWith(join(root, "dist") + "/")) {
        json(res, 403, { error: "Invalid path" });
        return;
      }
      const mime = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
      };
      try {
        const content = await readFile(file);
        res.writeHead(200, {
          "Content-Type": mime[extname(file)] || "application/octet-stream",
          "X-Content-Type-Options": "nosniff",
        });
        res.end(content);
      } catch {
        json(res, 404, { error: "File not found." });
      }
    } catch (e) {
      if (!res.headersSent) json(res, 400, { error: e.message });
      else res.end();
    }
  });
  return {
    server,
    store,
    bridge,
    async close() {
      clearInterval(keepalive);
      bridge.off("change", changed);
      bridge.stop();
      for (const res of clients) res.end();
      await store.queue;
      await vite?.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = await createApp();
  const host =
    process.env.HOST ||
    (process.env.SUPERVISOR_TOKEN ? "0.0.0.0" : "127.0.0.1");
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    setTimeout(() => process.exit(1), 5000).unref();
    app.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  app.server.listen(Number(process.env.PORT || 5190), host, () =>
    console.log(`3D Rooms listening on ${host}:${process.env.PORT || 5190}`),
  );
}
