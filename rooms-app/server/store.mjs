import { validateComponent } from "../shared/component.mjs";
import { mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
export class Store {
  constructor(dir) {
    this.dir = dir;
    this.state = { version: 1, models: [] };
    this.queue = Promise.resolve();
    this.mutations = Promise.resolve();
  }
  async open() {
    await mkdir(join(this.dir, "models"), { recursive: true });
    try {
      this.state = JSON.parse(
        await readFile(join(this.dir, "catalog.json"), "utf8"),
      );
      if (this.state.version !== 1)
        throw new Error("Unsupported catalog version");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    this.state.components ||= [];
    return this;
  }
  async save() {
    const snapshot = JSON.stringify(this.state, null, 2);
    this.queue = this.queue.then(async () => {
      const tmp = join(this.dir, "catalog.json.tmp");
      await writeFile(tmp, snapshot);
      await rename(tmp, join(this.dir, "catalog.json"));
    });
    return this.queue;
  }
  transaction(fn) {
    const next = this.mutations.then(fn);
    this.mutations = next.catch(() => {});
    return next;
  }
  async putComponent(value) {
    return this.transaction(async () => {
      const component = validateComponent(
        value,
        this.state.models.map((m) => m.id),
      );
      const previous = this.state.components;
      this.state.components = [
        ...previous.filter((c) => c.id !== component.id),
        component,
      ];
      try {
        await this.save();
      } catch (error) {
        this.state.components = previous;
        throw error;
      }
      return component;
    });
  }
  async removeComponent(id) {
    return this.transaction(async () => {
      const previous = this.state.components;
      this.state.components = previous.filter((c) => c.id !== id);
      try {
        await this.save();
      } catch (error) {
        this.state.components = previous;
        throw error;
      }
      return { ok: true };
    });
  }
  async install(stage, manifest) {
    return this.transaction(async () => {
      const existing = this.state.models.find((m) => m.id === manifest.id);
      if (existing)
        throw new Error(
          "A model with this ID already exists. Export it with a new ID for this release.",
        );
      const folder = randomUUID();
      await rename(stage, join(this.dir, "models", folder));
      const model = {
        ...manifest,
        folder,
        bindings: {},
        importedAt: new Date().toISOString(),
      };
      this.state.models.push(model);
      await this.save();
      return model;
    });
  }
  find(id) {
    const m = this.state.models.find((m) => m.id === id);
    if (!m) throw new Error("Model not found.");
    return m;
  }
  async remove(id) {
    return this.transaction(async () => {
      const model = this.find(id);
      this.state.models = this.state.models.filter((m) => m.id !== id);
      await this.save();
      await rm(join(this.dir, "models", model.folder), {
        recursive: true,
        force: true,
      });
    });
  }
}
