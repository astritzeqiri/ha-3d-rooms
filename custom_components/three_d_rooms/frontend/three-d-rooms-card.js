import { A as e, C as t, D as n, E as r, M as i, N as a, O as o, P as s, S as c, T as l, _ as u, a as d, b as f, d as p, i as m, j as h, m as g, o as _, r as v, s as ee, t as y, w as b, y as te } from "./three-d-rooms-room-focus-DizMe7SG.js";
import { a as ne, c as re, i as x, l as S, m as C, n as ie, o as w, p as T, r as ae, s as oe, u as se } from "./three-d-rooms-vacuum-Q5sHDcwl.js";
import { a as ce, n as E, o as le, r as ue, s as de, t as fe } from "./three-d-rooms-light-BzGWBUDK.js";
// shared/scene-store.mjs
var pe = "three-d-rooms", D = "scenes", me = 536870912, he = 2e3;
function ge(e, t) {
	let n;
	return Promise.race([e, new Promise((e, r) => {
		n = setTimeout(() => r(/* @__PURE__ */ Error("Model storage timed out.")), t);
	})]).finally(() => clearTimeout(n));
}
function _e(e, t, n) {
	return `${e || "user"}:${t.id}:${n}`;
}
function O(e) {
	return new Promise((t, n) => {
		e.onsuccess = () => t(e.result), e.onerror = () => n(e.error);
	});
}
function ve(e = globalThis.indexedDB) {
	if (!e) return null;
	let t, n = () => t ??= new Promise((n, r) => {
		let i = e.open(pe, 1);
		i.onupgradeneeded = () => i.result.createObjectStore(D), i.onsuccess = () => {
			let e = i.result;
			e.onversionchange = e.onclose = () => {
				e.close(), t = null;
			}, n(e);
		}, i.onerror = () => r(i.error), i.onblocked = () => r(/* @__PURE__ */ Error("Model storage is blocked."));
	}).catch((e) => {
		throw t = null, e;
	}), r = async (e, t) => {
		let r = (await n()).transaction(D, e), i = new Promise((e, t) => {
			r.oncomplete = e, r.onerror = r.onabort = () => t(r.error);
		}), a = await t(r.objectStore(D));
		return await i, a;
	};
	return {
		get: (e) => r("readonly", (t) => O(t.get(e))),
		put: (e, t) => r("readwrite", (n) => n.put(t, e)),
		delete: (e) => r("readwrite", (t) => t.delete(e)),
		async entries() {
			return r("readonly", async (e) => {
				let [t, n] = await Promise.all([O(e.getAllKeys()), O(e.getAll())]);
				return t.map((e, t) => [e, n[t]]);
			});
		}
	};
}
var k;
function A() {
	if (k === void 0) try {
		k = ve();
	} catch {
		k = null;
	}
	return k;
}
async function ye(e, t, n = he) {
	let r = A();
	if (!r) return null;
	let i;
	try {
		i = await ge(r.get(e), n);
	} catch {
		return null;
	}
	if (!i || i.revision !== t) return null;
	let a = i.data;
	return !(a instanceof ArrayBuffer) || !a.byteLength || a.byteLength !== i.size ? (r.delete(e).catch?.(() => {}), null) : (r.put(e, {
		...i,
		usedAt: Date.now()
	}).catch?.(() => {}), new Blob([a], { type: i.type || "model/gltf-binary" }));
}
async function be(e, t, n, r = me) {
	let i = A();
	if (!i || !n?.size || n.size > r) return !1;
	try {
		globalThis.navigator?.storage?.persist?.().catch?.(() => {});
		let a = await n.arrayBuffer(), o = (await i.entries()).filter(([t]) => t !== e), s = o.reduce((e, [, t]) => e + (t?.size || 0), 0);
		o.sort(([, e], [, t]) => (e?.usedAt || 0) - (t?.usedAt || 0));
		for (let [e, t] of o) {
			if (s + a.byteLength <= r) break;
			await i.delete(e), s -= t?.size || 0;
		}
		let c = Date.now();
		return await i.put(e, {
			revision: t,
			data: a,
			type: n.type || "model/gltf-binary",
			size: a.byteLength,
			savedAt: c,
			usedAt: c
		}), !0;
	} catch {
		return !1;
	}
}
// shared/scene-download.mjs
var j = /* @__PURE__ */ new WeakMap(), xe = 100663296, Se = 6e5;
function M(e) {
	return e.connection || e.auth || e;
}
function Ce(e) {
	j.delete(M(e));
}
async function we(e, t) {
	let n = e.body?.getReader?.();
	if (!n) return e.blob();
	let r = (t) => e.headers?.get?.(t), i = Number(r("content-length")), a = !r("content-encoding") && Number.isFinite(i) && i > 0 ? i : void 0, o = [], s = 0;
	for (t({
		loaded: s,
		total: a
	});;) {
		let { done: e, value: r } = await n.read();
		if (e) break;
		o.push(r), s += r.byteLength, t({
			loaded: s,
			total: a
		});
	}
	return new Blob(o, { type: r("content-type") || "model/gltf-binary" });
}
async function N(e, t, n = "original", r, { fresh: i = !1 } = {}) {
	let a = M(e), o = j.get(a);
	o || j.set(a, o = /* @__PURE__ */ new Map());
	let s = t.sceneRevision || t.importedAt || "legacy", c = `${t.id}:${s}:${n}`, l = Date.now();
	for (let [e, t] of o) t.expires < l && o.delete(e);
	let u = o.get(c);
	if (u) return o.delete(c), o.set(c, u), r && u.listeners && (u.listeners.add(r), u.progress && r(u.progress)), u.promise;
	u = {
		bytes: 0,
		expires: l + Se,
		listeners: /* @__PURE__ */ new Set()
	}, r && u.listeners.add(r);
	let d = (e) => {
		u.progress = e;
		for (let t of u.listeners || []) t(e);
	}, f = _e(e.user?.id, t, n);
	return u.promise = (async () => {
		let r = i ? null : await ye(f, s);
		if (r) d({
			loaded: r.size,
			total: r.size
		});
		else {
			let a = `/api/three_d_rooms/models/${encodeURIComponent(t.id)}/scene.glb?v=${encodeURIComponent(s)}&variant=${encodeURIComponent(n)}`, o = await (i ? e.fetchWithAuth(a, { cache: "reload" }) : e.fetchWithAuth(a));
			if (!o.ok) throw Error("Could not download your room. Check your login and the 3D Rooms integration.");
			r = await we(o, d), be(f, s, r);
		}
		u.listeners = null, u.bytes = r.size;
		let a = [...o.values()].reduce((e, t) => e + t.bytes, 0);
		for (let [e, t] of o) {
			if (a <= xe) break;
			o.delete(e), a -= t.bytes;
		}
		return r;
	})().catch((e) => {
		throw o.get(c) === u && o.delete(c), e;
	}), o.set(c, u), u.promise;
}
// dashboard/layout.js
var Te = class {
	constructor(e) {
		this.host = e, this.card = e.shadowRoot.querySelector("ha-card"), this.scene = e._container, this.style = document.createElement("style"), this.style.textContent = "ha-card[data-fill]{display:flex;flex-direction:column;box-sizing:border-box}ha-card[data-fill] .scene{flex:1;min-height:0;height:auto!important}ha-card[data-fill] .card-top{flex-shrink:0}ha-card[data-fill] .fixture-tray{flex-shrink:0;max-height:30%;overflow:auto;box-sizing:border-box}ha-card:fullscreen{width:100%;border:0;border-radius:0;padding-bottom:env(safe-area-inset-bottom)}.fullscreen-toggle svg{width:22px;height:22px}:host([fill-page]) ha-card{border-radius:0}:host([fill-page]) .card-top,:host([fill-page]) .panel-toggles,:host([fill-page]) .room-nav,:host([fill-page]) .house-summary,:host([fill-page]) .light-panel{margin-top:calc(env(safe-area-inset-top,0px) + 16px)}:host([fill-page]) .panel-toggles,:host([fill-page]) .light-panel,:host([fill-page]) .card-controls{margin-left:env(safe-area-inset-left,0px)}:host([fill-page]) .card-top,:host([fill-page]) .card-controls{margin-right:env(safe-area-inset-right,0px)}:host([fill-page]) .light-panel{max-height:calc(100% - 150px - env(safe-area-inset-top,0px))}", e.shadowRoot.append(this.style), this.button = document.createElement("button"), this.button.className = "fullscreen-toggle", this.button.type = "button", this.button.innerHTML = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" aria-hidden=\"true\"><path d=\"M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5\"/></svg>", this.button.hidden = !document.fullscreenEnabled || !this.card.requestFullscreen, this.button.onclick = async () => {
			try {
				this.fullscreen ? await document.exitFullscreen() : await this.card.requestFullscreen();
			} catch {
				this.button.title = "Fullscreen is unavailable in this browser";
			}
		}, (e._controls || this.scene).prepend(this.button), this.schedule = () => {
			cancelAnimationFrame(this.frame), this.frame = requestAnimationFrame(() => this.update());
		}, this.changed = () => {
			this.schedule(), this.button.focus();
		}, window.addEventListener("resize", this.schedule), window.visualViewport?.addEventListener("resize", this.schedule), document.addEventListener("fullscreenchange", this.changed), this.observer = new ResizeObserver(this.schedule), this.observer.observe(e), this.observer.observe(e.shadowRoot.querySelector(".card-top")), this.schedule();
	}
	get fullscreen() {
		return this.host.shadowRoot.fullscreenElement === this.card;
	}
	update() {
		let e = this.fullscreen || this.host._config?.height === "auto";
		if (this.card.toggleAttribute("data-fill", e), e && this.host.hasAttribute("fill-page")) this.card.style.height !== "100%" && (this.card.style.height = "100%");
		else if (e) {
			let e = window.visualViewport, t = e ? e.height + e.offsetTop : window.innerHeight, n = this.fullscreen ? 0 : Math.max(0, this.card.getBoundingClientRect().top), r = `${Math.max(180, Math.floor(t - n))}px`;
			this.card.style.height !== r && (this.card.style.height = r);
		} else this.card.style.height = "", this.scene.style.height = `${this.host._config?.height || 500}px`;
		let t = this.fullscreen ? "Exit fullscreen" : "Enter fullscreen";
		this.button.setAttribute("aria-label", t), this.button.setAttribute("aria-pressed", String(this.fullscreen)), this.button.title = t;
	}
	dispose() {
		cancelAnimationFrame(this.frame), this.observer.disconnect(), window.removeEventListener("resize", this.schedule), window.visualViewport?.removeEventListener("resize", this.schedule), document.removeEventListener("fullscreenchange", this.changed), this.button.remove(), this.style.remove();
	}
}, P = [
	"spotlight",
	"classic",
	"grid",
	"sky",
	"aurora",
	"image",
	"theme"
], Ee = {
	spotlight: "Spotlight · soft light behind the house",
	classic: "Classic · flat dark",
	grid: "Blueprint grid",
	sky: "Sky · follows day and night",
	aurora: "Aurora · slow ambient colour",
	image: "Custom image",
	theme: "Home Assistant theme"
}, F = [
	"background",
	"background_image",
	"background_shadow"
], De = (e) => e !== "classic";
function Oe(e) {
	let { background: t, background_image: n, background_shadow: r } = e;
	if (t !== void 0 && !P.includes(t)) throw Error(`Background must be one of ${P.join(", ")}.`);
	if (r !== void 0 && typeof r != "boolean") throw Error("background_shadow must be true or false.");
	if (n !== void 0) {
		if (typeof n != "string" || n.length > 2e3) throw Error("Background image must be a web address.");
		if (n && !I(n)) throw Error("Background image must start with /, http:// or https://.");
	}
	if (t === "image" && !n) throw Error("Choose a background image address.");
}
function I(e) {
	let t = String(e || "").trim();
	return /\s/.test(t) ? "" : /^\/(?!\/)/.test(t) || /^https?:\/\//i.test(t) ? t : "";
}
function L(e) {
	return e.view === "floor" ? !1 : (e.background || "spotlight") === "classic" ? e.background_shadow === !0 : e.background_shadow !== !1;
}
function ke(e) {
	return Number.isFinite(e) ? e >= 12 ? "day" : e >= 0 ? "golden" : e >= -8 ? "dusk" : "night" : "night";
}
function Ae(e, t) {
	if (e === "day") return 45;
	if (e === "night") return -30;
	let n = Number(t?.attributes?.elevation);
	return Number.isFinite(n) ? n : t?.state === "above_horizon" ? 30 : -30;
}
var je = {
	day: {
		top: "#4f93d6",
		mid: "#8fc3ee",
		bottom: "#d9ecf8",
		stars: 0
	},
	golden: {
		top: "#4a6fa8",
		mid: "#e8a46b",
		bottom: "#f6d9a8",
		stars: 0
	},
	dusk: {
		top: "#1c2550",
		mid: "#6a4f86",
		bottom: "#d98a6a",
		stars: .35
	},
	night: {
		top: "#070b1a",
		mid: "#0f1a38",
		bottom: "#1d2a4d",
		stars: 1
	}
}, Me = {
	day: {
		core: "#524d44",
		edge: "#1e1d1a"
	},
	golden: {
		core: "#55483a",
		edge: "#1f1b18"
	},
	dusk: {
		core: "#3a3550",
		edge: "#15141f"
	},
	night: {
		core: "#2b3447",
		edge: "#10141d"
	}
};
function Ne(e, t, n) {
	let r = je[t] || je.night, i = Me[t] || Me.night, a = {
		"--bd-sky-top": r.top,
		"--bd-sky-mid": r.mid,
		"--bd-sky-bottom": r.bottom,
		"--bd-stars": String(r.stars),
		"--bd-spot-core": i.core,
		"--bd-spot-edge": i.edge
	}, o = I(n);
	return e === "image" && o && (a["--bd-image"] = `url(${JSON.stringify(o)})`), a;
}
function Pe(e, t, n) {
	let r = t.background || "spotlight";
	e.dataset.background = r, e.dataset.time = n;
	for (let t of [...e.style]) t.startsWith("--bd-") && e.style.removeProperty(t);
	for (let [i, a] of Object.entries(Ne(r, n, t.background_image))) e.style.setProperty(i, a);
	r === "aurora" && !e.childElementCount ? e.append(...[
		1,
		2,
		3
	].map(() => e.ownerDocument.createElement("i"))) : r !== "aurora" && e.replaceChildren();
}
var Fe = "\n.backdrop{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none;transition:background 1.2s ease}\n.backdrop[data-background=classic]{background:#242320}\n.backdrop[data-background=theme]{background:transparent}\n.backdrop[data-background=spotlight]{background:radial-gradient(ellipse 70% 62% at 50% 46%,var(--bd-spot-core) 0%,var(--bd-spot-edge) 100%)}\n.backdrop[data-background=sky]{background:linear-gradient(180deg,var(--bd-sky-top) 0%,var(--bd-sky-mid) 58%,var(--bd-sky-bottom) 100%)}\n.backdrop[data-background=sky]::before{content:\"\";position:absolute;inset:0;opacity:var(--bd-stars);transition:opacity 1.2s ease;background-image:radial-gradient(1.4px 1.4px at 12% 18%,#fff 50%,transparent),radial-gradient(1px 1px at 27% 8%,#fff 50%,transparent),radial-gradient(1.6px 1.6px at 41% 26%,#fff 50%,transparent),radial-gradient(1px 1px at 58% 12%,#fff 50%,transparent),radial-gradient(1.4px 1.4px at 73% 22%,#fff 50%,transparent),radial-gradient(1px 1px at 86% 9%,#fff 50%,transparent),radial-gradient(1.2px 1.2px at 94% 30%,#fff 50%,transparent),radial-gradient(1px 1px at 6% 42%,#fff 50%,transparent),radial-gradient(1.2px 1.2px at 66% 40%,#fff 50%,transparent),radial-gradient(1px 1px at 34% 46%,#fff 50%,transparent)}\n.backdrop[data-background=grid]{background:radial-gradient(ellipse 80% 70% at 50% 50%,#17304a 0%,#0b1624 100%)}\n.backdrop[data-background=grid]::before{content:\"\";position:absolute;left:-50%;right:-50%;top:38%;bottom:-60%;background-image:linear-gradient(rgba(120,180,255,.22) 1px,transparent 1px),linear-gradient(90deg,rgba(120,180,255,.22) 1px,transparent 1px);background-size:48px 48px;transform:perspective(520px) rotateX(62deg);transform-origin:50% 0;-webkit-mask-image:radial-gradient(ellipse 50% 60% at 50% 30%,#000 0%,transparent 78%);mask-image:radial-gradient(ellipse 50% 60% at 50% 30%,#000 0%,transparent 78%)}\n.backdrop[data-background=aurora]{background:#0d1018}\n.backdrop[data-background=aurora] i{position:absolute;width:62%;aspect-ratio:1;border-radius:50%;filter:blur(70px);opacity:.55;animation:bd-drift 26s ease-in-out infinite alternate}\n.backdrop[data-background=aurora] i:nth-child(1){left:-12%;top:-20%;background:var(--primary-color,#03a9f4)}\n.backdrop[data-background=aurora] i:nth-child(2){right:-14%;top:10%;background:#7b4fd6;animation-duration:32s;animation-delay:-8s}\n.backdrop[data-background=aurora] i:nth-child(3){left:22%;bottom:-34%;background:#1fb89a;animation-duration:38s;animation-delay:-16s}\n.backdrop[data-background=image]{background:#14130f var(--bd-image) center/cover no-repeat}\n.backdrop[data-background=image]::after{content:\"\";position:absolute;inset:0;background:radial-gradient(ellipse at 50% 46%,rgba(0,0,0,.25),rgba(0,0,0,.6));backdrop-filter:blur(3px)}\n@keyframes bd-drift{to{transform:translate(14%,10%) scale(1.18)}}\n@media (prefers-reduced-motion:reduce){.backdrop[data-background=aurora] i{animation:none}}\n", R = [
	"model",
	"title",
	"show_title",
	"view",
	"heading",
	"tilt",
	"zoom",
	"height",
	"interactive"
];
function z(e, t) {
	if (!e.saved_view) return { ...e };
	let n = t?.find((t) => t.id === e.saved_view);
	if (!n || n.layers?.length !== 1) throw Error("Saved view not found. Choose another saved view in the card editor.");
	let r = n.layers[0], i = {
		...structuredClone(r),
		title: n.title,
		show_title: n.show_title ?? !0,
		height: n.height,
		...n.quality ? { quality: n.quality } : {},
		...n.floorPlan ? { floorPlan: structuredClone(n.floorPlan) } : {},
		...n.markers === void 0 ? {} : { markers: structuredClone(n.markers) },
		...Object.fromEntries(F.filter((e) => n[e] !== void 0).map((e) => [e, n[e]])),
		interactive: !1,
		...e
	};
	return (i.model !== r.model || i.view !== r.view) && delete i.camera, i.model !== r.model && delete i.markers, i;
}
// shared/load-progress.mjs
function Ie(e) {
	let t = Math.max(1, e?.count || 1), n = Math.min(t - 1, Math.max(0, e?.index || 0)), r = Math.max(0, e?.loaded || 0), i = e?.total > 0 ? e.total : void 0, a = i ? Math.min(1, r / i) : 0, o = r / 1024 / 1024, s = o >= .1 ? ` · ${o.toFixed(+(o < 10))} MB` : "";
	return {
		value: t > 1 || i ? (n + a) / t : void 0,
		text: t > 1 ? `Downloading room ${n + 1} of ${t}…${i ? "" : s}` : i ? `Downloading your room… ${Math.round(a * 100)}%` : `Downloading your room…${s}`
	};
}
// shared/room-route.mjs
function B(e) {
	let t = new URLSearchParams(e), n = new URLSearchParams();
	for (let e of ["model", "saved_view"]) {
		let r = t.get(e);
		r && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(r) && !["constructor", "prototype"].includes(r) && n.set(e, r);
	}
	return [
		"devices",
		"views",
		"settings"
	].includes(t.get("tab")) && n.set("tab", t.get("tab")), ["floor", "front"].includes(t.get("view")) && n.set("view", t.get("view")), n;
}
function Le(e, t = new URLSearchParams()) {
	let n = new URLSearchParams(t), r = new URL(e).searchParams.get("v");
	return r && /^[0-9A-Za-z.+-]{1,40}$/.test(r) && n.set("v", r), new URL(".", e).href + "index.html?" + n;
}
// shared/marker-groups.mjs
function Re(e, { open: t = /* @__PURE__ */ new Set(), overlap: n = .9 } = {}) {
	let r = /* @__PURE__ */ new Map();
	for (let t of e) t.room && (r.has(t.room) || r.set(t.room, []), r.get(t.room).push(t));
	let i = [];
	for (let [e, a] of r) {
		if (a.length < 2 || t.has(e)) continue;
		let r = !1;
		for (let e = 0; e < a.length && !r; e++) for (let t = e + 1; t < a.length; t++) {
			let i = a[e], o = a[t];
			if (Math.hypot(i.x - o.x, i.y - o.y) < (i.size + o.size) / 2 * n) {
				r = !0;
				break;
			}
		}
		r && i.push({
			room: e,
			ids: a.map((e) => e.id),
			x: a.reduce((e, t) => e + t.x, 0) / a.length,
			y: a.reduce((e, t) => e + t.y, 0) / a.length
		});
	}
	return i;
}
function ze(e, t, n = .9) {
	return Re(e.filter((e) => e.room === t), { overlap: n }).length > 0;
}
// shared/action.mjs
function V(e) {
	return { unavailable: !e || !/^(button|input_button|script|scene)\./.test(e.entity_id) || e.state === "unavailable" };
}
// shared/number.mjs
function Be(e, t) {
	let n = typeof e?.state == "string" && e.state.trim() ? Number(e.state) : NaN, r = !e || !/^(number|input_number)\./.test(e.entity_id) || !Number.isFinite(n) || n < t.min || n > t.max || e.attributes?.unit_of_measurement && e.attributes.unit_of_measurement !== t.unit;
	return {
		value: r ? void 0 : n,
		unavailable: r,
		label: r ? "Unavailable" : `${n} ${t.unit}`
	};
}
// dashboard/desk-dialog.mjs
var Ve = "\ndialog.dm{--dm-bg:var(--ha-card-background,var(--card-background-color,#1c1c1c));--dm-fg:var(--primary-text-color,#e1e1e1);--dm-muted:var(--secondary-text-color,#9b9b9b);--dm-line:var(--divider-color,#ffffff1f);--dm-surface:color-mix(in srgb,var(--dm-fg) 8%,transparent);--dm-surface-2:color-mix(in srgb,var(--dm-fg) 14%,transparent);--dm-accent:var(--primary-color,#03a9f4);--dm-accent-ink:var(--text-primary-color,#fff);\n box-sizing:border-box;width:min(520px,calc(100vw - 32px));max-width:none;max-height:min(92vh,880px);margin:auto;padding:0;overflow:hidden;border:0;border-radius:28px;background:var(--dm-bg);color:var(--dm-fg);font:400 14px/1.45 Roboto,system-ui,sans-serif;box-shadow:0 24px 64px #0009;animation:dm-in .22s cubic-bezier(.2,.8,.2,1)}\n@media (prefers-color-scheme:light){dialog.dm{--dm-bg:var(--ha-card-background,var(--card-background-color,#fff));--dm-fg:var(--primary-text-color,#212121);--dm-muted:var(--secondary-text-color,#727272);--dm-line:var(--divider-color,#0000001f);box-shadow:0 24px 64px #0004}}\ndialog.dm::backdrop{background:#000a}\n@keyframes dm-in{from{opacity:0;transform:translateY(20px) scale(.98)}}\n@media (max-width:600px){dialog.dm{width:100vw;margin:auto 0 0;border-radius:28px 28px 0 0;max-height:94vh;padding-bottom:env(safe-area-inset-bottom);animation-name:dm-up}@keyframes dm-up{from{transform:translateY(100%)}}}\n@media (prefers-reduced-motion:reduce){dialog.dm{animation:none}.dm *{transition:none!important}}\n.dm form{display:flex;flex-direction:column;max-height:inherit;margin:0}\n.dm-head{display:flex;align-items:center;gap:4px;padding:12px 16px 4px 12px;flex-shrink:0}\n.dm-titles{flex:1;min-width:0;padding-left:4px}\ndialog.dm h2{margin:0;font-weight:500;font-size:20px;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\ndialog.dm p{margin:0;color:var(--dm-muted);font-size:13px;line-height:1.45}\ndialog.dm button{min-height:0;padding:0;border:0;border-radius:0;background:none;color:inherit;font:inherit;cursor:pointer}\ndialog.dm button:focus-visible,.dm-slider:focus-visible{outline:2px solid var(--dm-accent);outline-offset:3px}\n.dm-close{display:grid;place-items:center;flex-shrink:0;width:48px;height:48px;border-radius:50%!important;transition:background .15s}\n.dm-close:hover{background:var(--dm-surface)!important}\n.dm svg{width:24px;height:24px;display:block;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}\n.dm-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:8px 24px 24px;display:flex;flex-direction:column;align-items:center;gap:20px}\n.dm-slider{position:relative;width:132px;height:min(300px,38vh);min-height:200px;border-radius:28px;overflow:hidden;background:var(--dm-surface);touch-action:none;cursor:pointer;user-select:none;-webkit-user-select:none;transition:background .15s}\n.dm-slider:hover{background:var(--dm-surface-2)}\n.dm-slider[aria-disabled=true]{opacity:.5;cursor:default}\n.dm-fill{position:absolute;left:0;right:0;bottom:0;background:var(--dm-accent);opacity:.92;transition:height .2s}\n.dm-slider.dm-dragging .dm-fill{transition:none}\n.dm-readout{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;pointer-events:none;text-shadow:0 1px 2px #0004}\n.dm-big{font:500 34px/1.1 Roboto,system-ui,sans-serif}\n.dm-small{font-size:14px;opacity:.85}\n.dm-row{display:flex;justify-content:center;flex-wrap:wrap;gap:14px 10px;width:100%}\n.dm-round{display:flex!important;flex-direction:column;align-items:center;gap:6px;width:76px;font-size:12px!important}\n.dm-disc{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:var(--dm-surface-2);transition:background .15s,color .15s}\n.dm-round:hover .dm-disc{background:color-mix(in srgb,var(--dm-surface-2) 70%,var(--dm-fg) 14%)}\n.dm-round:active .dm-disc{background:var(--dm-accent);color:var(--dm-accent-ink)}\n.dm-round:disabled{opacity:.4;cursor:default!important}\n.dm-round>span:last-child{max-width:100%;color:var(--dm-muted);text-align:center;overflow-wrap:anywhere;line-height:1.3}\n.dm-round ha-state-icon{--mdc-icon-size:24px;width:24px;height:24px;display:flex}\n.dm-section{width:100%;border-top:1px solid var(--dm-line);padding-top:16px;display:grid;gap:14px}\n.dm-section h3{margin:0;font-size:14px;font-weight:500}\n.dm-error:empty{display:none}\ndialog.dm .dm-error{color:var(--error-color,#db4437)}\n", He = {
	close: "<path d=\"M6 6l12 12M18 6 6 18\"/>",
	up: "<path d=\"M12 19V5M6 11l6-6 6 6\"/>",
	stop: "<rect x=\"7\" y=\"7\" width=\"10\" height=\"10\" rx=\"1.5\" fill=\"currentColor\" stroke=\"none\"/>",
	down: "<path d=\"M12 5v14M6 13l6 6 6-6\"/>"
}, Ue = (e) => `<svg viewBox="0 0 24 24" aria-hidden="true">${He[e]}</svg>`, H = (e, t, n) => `<button type="button" class="dm-round" data-action="${e}"><span class="dm-disc">${Ue(n)}</span><span>${t}</span></button>`, We = `<style>${Ve}${ce}.sheet-grab{color:var(--dm-muted)}</style><form method="dialog"><div class="sheet-grab" aria-hidden="true"></div><div class="dm-head"><button class="dm-close" value="close" aria-label="Close">${Ue("close")}</button><div class="dm-titles"><h2></h2><p data-desk-status></p></div></div><div class="dm-body"><div class="dm-slider" role="slider" tabindex="0" aria-label="Desk height" aria-orientation="vertical"><div class="dm-fill"></div><div class="dm-readout"><span class="dm-big"></span><span class="dm-small">Height</span></div></div><div class="dm-row">${H("open", "Up", "up")}${H("stop", "Stop", "stop")}${H("close", "Down", "down")}</div><div class="dm-section" data-desk-macros-section><h3>Macros</h3><div class="dm-row dm-macros"></div></div><p class="dm-error" data-desk-error role="alert"></p><p>Set entities and macro names in 3D Rooms → Devices → Desk settings.</p></div></form>`;
function Ge(e, { min: t, max: n, step: r }) {
	let i = t + Math.round((Math.min(n, Math.max(t, e)) - t) / (r || 1)) * (r || 1);
	return Number(Math.min(n, i).toFixed(6));
}
function Ke(e, t, n) {
	let r = t.height ? 1 - (e - t.top) / t.height : 0;
	return Ge(n.min + r * (n.max - n.min), n);
}
function qe(e, { min: t, max: n }) {
	return !Number.isFinite(e) || n <= t ? 0 : Math.min(1, Math.max(0, (e - t) / (n - t)));
}
// shared/marker.mjs
function Je(e, t, n, r = !1) {
	if (e.type === "climate") {
		let e = t ? i(t) : n?.mode ? n : i(void 0), r = h(e);
		return {
			active: e.on,
			unavailable: e.unavailable,
			moving: !1,
			tone: r.tone,
			badge: e.unavailable ? "Unavailable" : e.temperature === void 0 ? r.label : `${r.label} · ${e.temperature}°`,
			description: e.unavailable ? "Unavailable" : `${r.label}, Home Assistant climate controls`,
			stateObj: t || {
				entity_id: "climate.three_d_rooms_preview",
				state: e.mode || "unavailable",
				attributes: { icon: "mdi:air-conditioner" }
			}
		};
	}
	if (e.type === "vacuum") {
		let e = r ? n || {} : t ? x(t) : n || {}, i = r || !!t, a = !i || !!e.unavailable;
		return {
			badge: i ? a ? "!" : e.label : "—",
			description: i ? a ? "Unavailable" : `${e.label}${e.battery === void 0 ? "" : ` · ${e.battery}%`}, Home Assistant vacuum controls` : "Not connected",
			active: !a && !!e.active,
			moving: !a && !!e.active,
			unavailable: a,
			tone: a ? void 0 : e.error ? "jammed" : e.cleaning ? "cleaning" : e.returning ? "moving" : void 0,
			stateObj: t || {
				entity_id: "vacuum.three_d_rooms_preview",
				state: e.state || "docked",
				attributes: {}
			}
		};
	}
	if (e.type === "lock") {
		let e = r ? n || {} : t ? u(t) : n || {}, i = r || !!t, a = !i || !!e.unavailable;
		return {
			badge: i ? a ? "!" : e.label : "—",
			description: i ? a ? "Unavailable" : `${e.label}, Home Assistant lock controls` : "Not connected",
			active: !a && e.locked === !0,
			moving: !!e.moving,
			unavailable: a,
			tone: a ? void 0 : e.jammed ? "jammed" : e.moving ? "moving" : e.locked === !0 ? "locked" : e.locked === !1 ? "unlocked" : void 0,
			stateObj: t || {
				entity_id: "lock.three_d_rooms_preview",
				state: e.locked === !1 ? "unlocked" : "locked",
				attributes: {}
			}
		};
	}
	if (e.type === "button") {
		let e = !(r || t) || !!n.unavailable;
		return {
			badge: e ? "—" : "Run",
			description: e ? "Not connected" : "Run preset",
			active: !1,
			moving: !1,
			unavailable: e,
			stateObj: t || {
				entity_id: "button.preview",
				state: "unknown",
				attributes: { icon: "mdi:gesture-tap-button" }
			}
		};
	}
	if (e.type === "number") {
		let i = r || !!t, a = !i || !!n.unavailable, o = Number.isFinite(n.value) ? `${n.value} ${e.unit}` : "Unknown";
		return {
			badge: i ? a ? "!" : o : "—",
			description: i ? a ? "Unavailable" : o : "Not connected",
			active: !a,
			moving: !1,
			unavailable: a,
			stateObj: t || {
				entity_id: "number.three_d_rooms_preview",
				state: String(n.value ?? e.defaultValue),
				attributes: {
					unit_of_measurement: e.unit,
					icon: "mdi:desk"
				}
			}
		};
	}
	let a = e.type === "cover", o = r || !!t, s = !r && o && n.unavailable, c = r ? a ? n.position === 0 ? "closed" : "open" : n.on ? "on" : "off" : t?.state, l = a && ["opening", "closing"].includes(c), d = Number.isFinite(n.position) ? Math.round(n.position) : void 0, f = !s && o && (a ? d === void 0 ? c === "open" || l : d > 0 : !!n.on), p = o ? s ? "!" : a ? `${l ? c === "opening" ? "↑ " : "↓ " : ""}${d === void 0 ? c === "closed" ? "0%" : c === "open" ? "Open" : "?" : d + "%"}` : n.on ? "On" : "Off" : "—", m = o ? s ? "Unavailable" : a ? `${l ? c + ", " : ""}${d === void 0 ? c || "Position unknown" : d + "% open"}` : n.on ? `On${Number.isFinite(n.brightness) ? ", " + Math.round(n.brightness / 255 * 100) + "% brightness" : ""}` : "Off" : "Not connected", g = !r && t ? t : {
		entity_id: `${a ? "cover" : "light"}.three_d_rooms_preview`,
		state: c || "unavailable",
		attributes: a ? {
			device_class: "shade",
			...d === void 0 ? {} : { current_position: d }
		} : { brightness: n.brightness }
	}, _ = !a && f && !r && Array.isArray(t?.attributes?.rgb_color) ? t.attributes.rgb_color.slice(0, 3).map(Number) : void 0, v = _?.length === 3 && _.every((e) => e >= 0 && e <= 255);
	return {
		badge: p,
		description: m,
		active: f,
		moving: l,
		unavailable: !o || s,
		stateObj: g,
		tone: f ? a ? "open" : "light" : void 0,
		...v ? {
			toneColor: `rgb(${_.map(Math.round).join(",")})`,
			toneInk: Ye(_)
		} : {}
	};
}
function Ye([e, t, n]) {
	let r = (e) => e / 255 <= .03928 ? e / 255 / 12.92 : ((e / 255 + .055) / 1.055) ** 2.4;
	return .2126 * r(e) + .7152 * r(t) + .0722 * r(n) > .4 ? "#1c1c1c" : "#fff";
}
function Xe(e, t) {
	t?.tone ? e.dataset.tone = t.tone : delete e.dataset.tone;
	for (let [n, r] of [["--tone", t?.tone && t.toneColor], ["--tone-ink", t?.tone && t.toneInk]]) r ? e.style?.setProperty?.(n, r) : e.style?.removeProperty?.(n);
}
var Ze = "<path d=\"M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 0 1 6 0v3Zm3 4a2 2 0 0 1 1 3.73V19h-2v-1.27A2 2 0 0 1 12 14Z\"/>", Qe = "<path fill-rule=\"evenodd\" d=\"M4 3h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 2v5h16V5H4Z\"/><path d=\"M5 7h14v2H5zm2 7h2v3a2 2 0 0 1-2 2H5v-2h2zm4 0h2v7h-2zm4 0h2v3h2v2h-2a2 2 0 0 1-2-2z\"/>";
// dashboard/updates.mjs
async function $e(e, t) {
	if (e.subscribeMessage) try {
		return await e.subscribeMessage(() => t(), { type: "three_d_rooms/subscribe" });
	} catch (e) {
		if (e?.code !== "unknown_command") throw e;
	}
	return e.subscribeEvents(() => t(), "three_d_rooms_updated");
}
// dashboard/hold-hint.mjs
var et = 150, tt = "three-d-rooms:hold-tip", nt = 3;
function U(e, t, n = globalThis) {
	n.clearTimeout(e._holdRing), e._holdRing = void 0, delete e.dataset.holding, t && (e.style.setProperty("--hold-ms", "350ms"), e._holdRing = n.setTimeout(() => {
		e.dataset.holding = "true";
	}, et));
}
function rt(e) {
	try {
		let t = Number(e?.getItem(tt)) || 0;
		return t >= nt ? !1 : (e.setItem(tt, String(t + 1)), !0);
	} catch {
		return !1;
	}
}
// shared/spread-icons.mjs
function it(e, { gap: t = 6, maxShift: n = 40, iterations: r = 80 } = {}) {
	let i = e.length, a = e.map((e) => e.x), o = e.map((e) => e.y), s = Array(i).fill(!1);
	for (let n = 0; n < i; n++) for (let r = n + 1; r < i; r++) Math.hypot(a[n] - a[r], o[n] - o[r]) < e[n].r + e[r].r + t && (s[n] = s[r] = !0);
	if (!s.some(Boolean)) return e.map(() => ({
		dx: 0,
		dy: 0
	}));
	for (let c = 0; c < r; c++) {
		let r = !1;
		for (let c = 0; c < i; c++) {
			if (!s[c]) continue;
			for (let n = 0; n < i; n++) {
				if (c === n) continue;
				let i = a[c] - a[n], l = o[c] - o[n], u = Math.hypot(i, l), d = e[c].r + e[n].r + t;
				if (u >= d) continue;
				if (u < .01) {
					let e = (c - n) * 2.399963 % (2 * Math.PI);
					i = Math.cos(e), l = Math.sin(e), u = 1;
				}
				let f = s[n] ? .5 : 1, p = (d - u) * f * .5;
				a[c] += i / u * p, o[c] += l / u * p, r = !0;
			}
			let l = a[c] - e[c].x, u = o[c] - e[c].y, d = Math.hypot(l, u);
			d > n && (a[c] = e[c].x + l / d * n, o[c] = e[c].y + u / d * n);
		}
		if (!r) break;
	}
	return e.map((e, t) => ({
		dx: Math.round((a[t] - e.x) * 10) / 10,
		dy: Math.round((o[t] - e.y) * 10) / 10
	}));
}
// shared/house-summary.mjs
var at = /* @__PURE__ */ new Set([
	"door",
	"window",
	"garage",
	"gate",
	"opening"
]), ot = /* @__PURE__ */ new Set([
	"open",
	"opening",
	"on"
]), st = /* @__PURE__ */ new Set([
	"unlocked",
	"open",
	"opening",
	"jammed",
	"unlocking"
]), ct = {
	cleaning: "cleaning",
	returning: "going home",
	error: "needs help"
}, lt = {
	cool: "Cooling",
	heat: "Heating",
	dry: "Drying",
	fan_only: "Fan on",
	heat_cool: "Climate on",
	auto: "Climate on"
}, W = (e, t, n) => `${e} ${e === 1 ? t : n}`, ut = (e, t) => c(e, t).split(" · ").pop();
function dt(e, t = {}) {
	let n = [], r = (e?.controls || []).filter((e) => !e.hidden && e.lightGroupPrimary !== !1), i = (n) => t[e.bindings?.[n.id]], a = (e) => i(e) && !["unavailable", "unknown"].includes(i(e).state), o = r.filter((e) => e.type === "light" && a(e)), s = o.filter((e) => i(e).state === "on");
	o.length && n.push({
		kind: "light",
		text: s.length ? W(s.length, "light on", "lights on") : "Lights off",
		tone: s.length ? "light" : "",
		ids: s.map((e) => e.id)
	});
	let c = r.filter((t) => {
		if (t.type !== "cover" || !a(t)) return !1;
		let n = i(t);
		return e.bindings[t.id].startsWith("binary_sensor.") || at.has(n.attributes?.device_class);
	}), l = c.filter((e) => ot.has(i(e).state));
	c.length && n.push({
		kind: "opening",
		text: l.length === 1 ? `${ut(l[0], "Door")} open` : l.length ? W(l.length, "door or window open", "doors & windows open") : "Doors & windows closed",
		tone: l.length ? "open" : "",
		ids: l.map((e) => e.id)
	});
	let u = r.filter((e) => e.type === "lock" && a(e)), d = u.filter((e) => st.has(i(e).state));
	u.length && n.push({
		kind: "lock",
		text: d.length ? d.length === 1 ? `${ut(d[0], "Lock")} ${i(d[0]).state === "jammed" ? "jammed" : "unlocked"}` : W(d.length, "lock open", "locks open") : "Locked",
		tone: d.length ? "unlocked" : "locked",
		ids: (d.length ? d : u).map((e) => e.id)
	});
	for (let e of r.filter((e) => e.type === "vacuum" && a(e))) {
		let t = ct[i(e).state];
		t && n.push({
			kind: "vacuum",
			text: `Vacuum ${t}`,
			tone: i(e).state === "error" ? "unlocked" : "cleaning",
			ids: [e.id]
		});
	}
	let f = r.filter((e) => e.type === "climate" && a(e) && lt[i(e).state]);
	return f.length && n.push({
		kind: "climate",
		text: f.length === 1 ? lt[i(f[0]).state] : W(f.length, "climate device on", "climate devices on"),
		tone: f.length === 1 ? i(f[0]).state : "auto",
		ids: f.map((e) => e.id)
	}), n;
}
// shared/device-camera.mjs
var ft = "three-d-rooms:device-camera:";
function pt({ card: e, view: t, plan: n = !1, aspect: r = 1 }) {
	return !e || !t ? null : `${ft}${e}:${t}:${n ? "plan" : "3d"}:${r < 1 ? "portrait" : "landscape"}`;
}
function mt(e, t) {
	if (t) try {
		let n = e?.getItem(t);
		return n ? g(JSON.parse(n)) : void 0;
	} catch {
		return;
	}
}
function ht(e, t, n) {
	if (!t || !e) return !1;
	try {
		return n ? e.setItem(t, JSON.stringify(g(n))) : e.removeItem(t), !0;
	} catch {
		return !1;
	}
}
// shared/upload.mjs
function gt(e, { method: t = "POST", file: n, headers: r = {}, onProgress: i = () => {}, onUploaded: a = () => {}, createXHR: o = () => new XMLHttpRequest() }) {
	return new Promise((s, c) => {
		let l = o();
		l.open(t, e);
		for (let [e, t] of Object.entries(r)) l.setRequestHeader(e, t);
		l.upload.onprogress = (e) => i({
			loaded: e.loaded,
			total: e.lengthComputable ? e.total : null
		}), l.upload.onload = () => a(), l.onerror = () => c(/* @__PURE__ */ Error("Upload interrupted. Check your connection and try again.")), l.onabort = () => c(/* @__PURE__ */ Error("Upload cancelled. You can try again.")), l.onload = () => {
			let e;
			try {
				e = JSON.parse(l.responseText);
			} catch {}
			l.status >= 200 && l.status < 300 && e ? s(e) : c(Error(e?.error || `Upload failed (${l.status}). Please try again.`));
		}, l.send(n);
	});
}
async function _t(e, t, n) {
	if (!(t === "/api/three_d_rooms/models" && n.method === "POST" || /^\/api\/three_d_rooms\/models\/[a-z0-9_-]+$/.test(t) && n.method === "PUT" || /^\/api\/three_d_rooms\/houses\/[a-z0-9_-]+$/.test(t) && ["POST", "PUT"].includes(n.method) || /^\/api\/three_d_rooms\/models\/[a-z0-9_-]+\/optimized\/(full|phone)$/.test(t) && n.method === "PUT")) throw Error("Unknown model upload.");
	let r = t.includes("/optimized/"), i = n.headers?.["X-Rooms-Source-Revision"];
	if (r && !/^[a-f0-9]{24}$/.test(i || "")) throw Error("Optimized scenes must name the upload they came from.");
	let a = n.headers?.["X-Rooms-Matches"];
	if (a !== void 0 && !/^[A-Za-z0-9_-]{1,6000}$/.test(a)) throw Error("Too many room and device choices to send at once.");
	return e.auth.expired && await e.auth.refreshAccessToken(), gt(t, {
		...n,
		headers: {
			...n.headers?.["X-Rooms-Revision"] ? { "X-Rooms-Revision": n.headers["X-Rooms-Revision"] } : {},
			...a ? { "X-Rooms-Matches": a } : {},
			...r ? { "X-Rooms-Source-Revision": i } : {},
			"Content-Type": r ? "model/gltf-binary" : "application/zip",
			Authorization: `Bearer ${e.auth.accessToken}`
		}
	});
}
// shared/entity-icon.mjs
function vt(e) {
	let t = e.querySelector?.("svg");
	if (t) return t;
	for (let t of e.querySelectorAll?.("*") || []) if (t.shadowRoot) {
		let e = vt(t.shadowRoot);
		if (e) return e;
	}
	return null;
}
async function yt(e, t, n, { frames: r = 120 } = {}) {
	let i = e.ownerDocument;
	if (!i.defaultView.customElements.get("ha-state-icon")) return null;
	let a = i.createElement("ha-state-icon");
	a.hass = t, a.stateObj = n, a.setAttribute("aria-hidden", "true"), a.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;width:24px;height:24px", e.append(a);
	try {
		for (let e = 0; e < r; e++) {
			let e = a.shadowRoot && vt(a.shadowRoot), t = e && [...e.querySelectorAll("path")];
			if (t?.length) return {
				viewBox: e.getAttribute("viewBox") || "0 0 24 24",
				paths: t.map((e) => ({
					d: e.getAttribute("d") || "",
					fillRule: e.getAttribute("fill-rule"),
					clipRule: e.getAttribute("clip-rule"),
					transform: e.getAttribute("transform")
				}))
			};
			await new Promise((e) => i.defaultView.requestAnimationFrame(e));
		}
		return null;
	} finally {
		a.remove();
	}
}
// dashboard/preview.js
function bt(e, t, n) {
	let r = document.createElement("dialog");
	r.setAttribute("aria-labelledby", "dashboard-preview-title"), r.innerHTML = "<style>\n    dialog.dashboard-preview{box-sizing:border-box;width:min(960px,calc(100vw - 24px));max-width:none;max-height:calc(100dvh - 24px);padding:0;border:1px solid var(--divider-color,#777);border-radius:12px;background:var(--primary-background-color,#fafafa);color:var(--primary-text-color,#212121);font:14px/1.5 system-ui}\n    .dashboard-preview::backdrop{background:#0009}\n    .preview-toolbar{position:sticky;top:0;z-index:2;background:var(--primary-background-color,#fafafa);display:flex;align-items:center;flex-wrap:wrap;gap:12px;padding:16px;border-bottom:1px solid var(--divider-color,#777)}\n    .preview-toolbar h2{font-size:18px;margin:0;flex:1;min-width:160px}\n    .preview-actions{display:flex;align-items:center;gap:12px;margin-left:auto}\n    .preview-widths{display:flex;padding:3px;border:1px solid var(--divider-color,#ddd);border-radius:8px;background:var(--secondary-background-color,#eee)}\n    .preview-toolbar button{display:inline-flex;align-items:center;justify-content:center;gap:8px;box-sizing:border-box;min-height:44px;padding:8px 12px;border:0;border-radius:5px;color:var(--secondary-text-color,#555);background:transparent;font:500 14px/20px system-ui;cursor:pointer;white-space:nowrap}\n    .preview-widths button[aria-pressed=\"true\"]{color:var(--primary-text-color,#212121);background:var(--card-background-color,#fff);box-shadow:0 1px 3px #0002}\n    .preview-toolbar button:hover{color:var(--primary-text-color,#212121);background:var(--card-background-color,#fff)}\n    .preview-toolbar .preview-close{width:44px;padding:10px;border-radius:50%}\n    .preview-toolbar svg{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}\n    @media(max-width:480px){.preview-toolbar{gap:8px;padding:12px}.preview-toolbar h2{flex-basis:100%}.preview-actions{width:100%;justify-content:space-between}.preview-widths{flex:1}.preview-widths button{flex:1}}\n    .preview-toolbar :focus-visible{outline:2px solid var(--primary-color,#03a9f4);outline-offset:2px}\n    .preview-note{margin:0;padding:12px 16px;color:var(--secondary-text-color,#555)}\n    .preview-dashboard{padding:16px;background:var(--lovelace-background,var(--primary-background-color,#fafafa))}\n    .preview-card{width:100%;max-width:560px;margin:auto}\n    .preview-card[data-width=\"phone\"]{max-width:360px}\n    @media(max-width:600px){dialog.dashboard-preview{width:100vw;max-width:100vw;max-height:100dvh;margin:auto 0;border-radius:0;overflow:auto;overscroll-behavior:contain}.preview-toolbar{gap:8px;padding:12px}.preview-toolbar h2{font-size:16px}.preview-note{font-size:13px;padding:12px}.preview-dashboard{padding:12px;padding-bottom:max(12px,env(safe-area-inset-bottom))}}\n  </style><div class=\"preview-toolbar\"><h2 id=\"dashboard-preview-title\">Dashboard preview</h2><div class=\"preview-actions\"><div class=\"preview-widths\" role=\"group\" aria-label=\"Preview card width\"><button type=\"button\" data-width=\"desktop\" aria-pressed=\"true\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"12\" rx=\"2\"/><path d=\"M8 21h8M12 16v5\"/></svg>Desktop</button><button type=\"button\" data-width=\"phone\" aria-pressed=\"false\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"6\" y=\"2\" width=\"12\" height=\"20\" rx=\"2\"/><path d=\"M11 18h2\"/></svg>Phone</button></div><button class=\"preview-close\" type=\"button\" aria-label=\"Close preview\" title=\"Close preview\" autofocus><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m6 6 12 12M18 6 6 18\"/></svg></button></div></div><p class=\"preview-note\">Your current changes, without saving. Device controls are live. The final card width depends on your dashboard layout.</p><div class=\"preview-dashboard\"><div class=\"preview-card\"></div></div>", r.className = "dashboard-preview";
	let i = document.createElement("three-d-rooms-card");
	i.setConfig({
		type: "custom:three-d-rooms-card",
		...structuredClone(t.layers[0]),
		title: t.title,
		show_title: t.show_title ?? !0,
		height: t.height === "auto" ? 600 : t.height,
		markers: t.markers,
		...Object.fromEntries(F.filter((e) => t[e] !== void 0).map((e) => [e, t[e]]))
	}), i.hass = n, r.querySelector(".preview-card").append(i);
	for (let e of r.querySelectorAll(".preview-widths button")) e.onclick = () => {
		r.querySelector(".preview-card").dataset.width = e.dataset.width;
		for (let t of r.querySelectorAll(".preview-widths button")) t.setAttribute("aria-pressed", String(t === e));
	};
	return r.querySelector(".preview-close").onclick = () => r.close(), r.addEventListener("click", (e) => {
		let t = r.getBoundingClientRect();
		e.target === r && (e.clientX < t.left || e.clientX > t.right || e.clientY < t.top || e.clientY > t.bottom) && r.close();
	}), e.append(r), r.showModal(), {
		card: i,
		close: () => r.close(),
		closed: new Promise((e) => {
			r.addEventListener("close", () => {
				r.remove(), e();
			}, { once: !0 });
		})
	};
}
// shared/dashboard-cards.mjs
function xt(e, t, n) {
	let r = structuredClone(e), i = r?.views?.[t];
	if (!i) throw Error("That dashboard view no longer exists.");
	if (i.strategy) throw Error("That view is generated automatically; choose another.");
	return i.type === "sections" || Array.isArray(i.sections) ? (i.sections ||= [], i.sections.push({
		type: "grid",
		cards: [n]
	})) : (i.cards ||= [], i.cards.push(n)), r;
}
function St(e) {
	return !e || e.strategy || !Array.isArray(e.views) ? [] : e.views.map((e, t) => ({
		index: t,
		title: e.title || e.path || `View ${t + 1}`,
		path: e.path || String(t),
		editable: !e.strategy
	})).filter((e) => e.editable);
}
async function Ct(e) {
	let t = [{
		url_path: null,
		title: "Overview"
	}, ...(await e.callWS({ type: "lovelace/dashboards/list" }) || []).filter((e) => e.mode !== "yaml")], n = [];
	for (let r of t) {
		let t;
		try {
			t = await e.callWS({
				type: "lovelace/config",
				...r.url_path ? { url_path: r.url_path } : {}
			});
		} catch {
			continue;
		}
		let i = St(t);
		i.length && n.push({
			url_path: r.url_path,
			title: r.title || r.url_path || "Dashboard",
			views: i
		});
	}
	return n;
}
async function wt(e, t, n, r) {
	let i = t ? { url_path: t } : {}, a = await e.callWS({
		type: "lovelace/config",
		...i
	});
	await e.callWS({
		type: "lovelace/config/save",
		...i,
		config: xt(a, n, r)
	});
}
// dashboard/panel.js
var Tt = class extends HTMLElement {
	constructor() {
		super(), this.attachShadow({ mode: "open" }), this.shadowRoot.innerHTML = "<style>:host{display:block;height:100%;min-height:100vh}iframe{display:block;width:100%;height:100vh;border:0}</style><iframe title=\"3D Rooms model library\"></iframe>", this._frame = this.shadowRoot.querySelector("iframe"), this._frame.addEventListener("load", () => this._applyTheme()), this._iconCache = /* @__PURE__ */ new Map(), this._ready = (e) => {
			if (e.source !== this._frame.contentWindow || e.origin !== location.origin || e.data?.type !== "three-d-rooms-ready") return;
			let t = {
				moreInfo: (e) => {
					this._hass?.states?.[e] && this.dispatchEvent(new CustomEvent("hass-more-info", {
						detail: { entityId: e },
						bubbles: !0,
						composed: !0
					}));
				},
				preview: async (e) => {
					this._preview?.close();
					let t = bt(this.shadowRoot, e, this._hass);
					this._preview = t, await t.closed, this._preview === t && (this._preview = null);
				},
				navigate: (e) => {
					if (B(e).toString() === B(location.search).toString()) return;
					let t = new URL(location.href);
					for (let e of [
						"model",
						"tab",
						"saved_view",
						"view"
					]) t.searchParams.delete(e);
					for (let [n, r] of B(e)) t.searchParams.set(n, r);
					history.replaceState(history.state, "", t);
				},
				dashboards: () => Ct(this._hass),
				addCard: (e, t, n) => wt(this._hass, e, t, n),
				states: () => Object.values(this._hass?.states || {}),
				request: (e, t = {}) => this._hass.callWS({
					type: "three_d_rooms/request",
					operation: e,
					data: t
				}),
				asset: (e, t) => this._hass.fetchWithAuth(e, t),
				upload: (e, t) => _t(this._hass, e, t),
				scene: (e, t = "full") => N(this._hass, e, t),
				entityIcon: (e) => {
					let t = JSON.stringify([
						e.entity_id,
						e.state,
						e.attributes?.icon,
						e.attributes?.device_class
					]);
					return this._iconCache.has(t) || (this._iconCache.set(t, yt(this.shadowRoot, this._hass, e)), this._iconCache.size > 32 && this._iconCache.delete(this._iconCache.keys().next().value)), this._iconCache.get(t);
				},
				subscribeModels: (e) => this._hass.connection.subscribeEvents(e, "three_d_rooms_updated"),
				subscribe: (e) => (this._listener = e, this._publish(), () => {
					this._listener === e && (this._listener = null);
				})
			};
			this._applyTheme(), this._frame.contentWindow.threeDRoomsBridge = t, this._frame.contentWindow.dispatchEvent(new Event("three-d-rooms-connected"));
		};
	}
	set hass(e) {
		this._hass = e, this._preview && (this._preview.card.hass = e), this._applyTheme(), this._publish();
	}
	_applyTheme() {
		let e = this._hass?.themes?.darkMode, t = this._frame.contentDocument?.documentElement;
		if (typeof e != "boolean" || !t) return;
		let n = e ? "dark" : "light";
		t.dataset.theme !== n && (t.dataset.theme = n);
	}
	_publish() {
		this._hass && this._listener?.({
			connected: this._hass.connected !== !1,
			mode: "homeassistant",
			entities: Object.values(this._hass.states).filter((e) => /^(climate|light|switch|cover|lock|vacuum|sun|binary_sensor|number|input_number|button|input_button|script|scene)\./.test(e.entity_id))
		});
	}
	connectedCallback() {
		window.addEventListener("message", this._ready);
		let e = B(location.search);
		e.set("native", "1"), this._frame.src = Le(import.meta.url, e);
	}
	disconnectedCallback() {
		this._preview?.close(), window.removeEventListener("message", this._ready), this._listener = null;
	}
};
customElements.get("three-d-rooms-panel") || customElements.define("three-d-rooms-panel", Tt);
// shared/house-floors.mjs
function G(e, t) {
	if (!t?.houseView || !Array.isArray(e)) return [];
	let n = e.filter((e) => e?.houseView && e.houseId === t.houseId);
	return n.length < 2 ? [] : n.map((e) => ({
		id: e.id,
		floorId: e.houseFloor?.id ?? null,
		label: e.houseFloor?.name || "Whole house"
	})).sort((e, t) => e.floorId === null ? -1 : +(t.floorId === null));
}
function Et(e, t, n) {
	return !n || n === t?.id ? t : G(e, t).some((e) => e.id === n) && e.find((e) => e.id === n) || t;
}
function Dt(e, t, n = !0) {
	let r = n ? G(e, t) : [];
	if (!r.length) return {
		model: t,
		floors: [],
		views: []
	};
	let i = r.map((t) => e.find((e) => e.id === t.id));
	return {
		model: i.find((e) => !e.houseFloor) || t,
		floors: r,
		views: i
	};
}
// dashboard/editor.js
var Ot = {
	model: "Room",
	title: "Title",
	show_title: "Show title",
	view: "View",
	heading: "Rotation",
	tilt: "Tilt",
	zoom: "Zoom",
	height: "Height",
	interactive: "Camera movement"
}, kt = {
	show_title: !0,
	height: 500,
	view: "front",
	heading: 0,
	tilt: 28,
	zoom: 1
}, At = class extends HTMLElement {
	constructor() {
		super(), this.attachShadow({ mode: "open" }), this.shadowRoot.innerHTML = `<style>
      :host{display:block;container-type:inline-size;color:var(--primary-text-color);font:14px/1.5 var(--paper-font-body1_-_font-family,system-ui)}
      label{display:grid;gap:6px;margin:16px 0}input,select,button{box-sizing:border-box;min-height:44px;width:100%;font:inherit;color:var(--primary-text-color);background:var(--card-background-color);border:1px solid var(--divider-color);border-radius:8px;padding:10px}
      input:focus-visible,select:focus-visible,button:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}
      .field-setting{position:relative;min-width:0;margin:16px 0}.field-setting>label{margin:0;gap:10px}.field-setting:not(.boolean)>label{padding-top:4px}.field-setting.boolean{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px}.field-setting.boolean>label{flex:1;min-width:0}.field-setting.boolean>label input{flex-shrink:0}
      .override-controls{position:absolute;top:0;right:0;display:flex;align-items:center;gap:2px;min-height:28px;color:var(--secondary-text-color);font-size:12px}.boolean .override-controls{position:static;flex-shrink:0}.override-controls .reset-field{display:inline-flex;align-items:center;gap:4px;width:auto;min-height:28px;padding:3px 5px;border:0;background:transparent;color:var(--secondary-text-color);font-size:12px;cursor:pointer}.reset-field svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.6}.override-controls .reset-field:hover{color:var(--primary-color);background:color-mix(in srgb,var(--primary-text-color) 5%,transparent)}
      input:disabled,select:disabled{opacity:.65}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}.check{display:flex;align-items:center}.check input{width:22px;margin-right:8px}
      p{color:var(--secondary-text-color)}[role=alert]{color:var(--error-color)}[hidden]{display:none!important}
      @container(max-width:420px){.grid{grid-template-columns:1fr}}
    </style>
    <p>Choose a room or link a saved view. Linked fields follow changes saved in 3D Rooms. Edit any field for this card. Reset a changed field to follow the saved view again.</p>
    <p id="status" role="status">Loading rooms…</p><button id="retry" hidden>Retry loading rooms</button>
    <label>Saved view<select id="component"><option value="">Choose a saved view (optional)</option></select></label>
    <label>Room<select id="model"><option value="">Choose a room</option></select></label>
    <label>Title<input id="title" type="text" maxlength="160"></label>
    <label class="check"><input id="show_title" type="checkbox">Show title on card</label>
    <label>View<select id="view"><option value="front">Perspective</option><option value="floor">Floor</option></select></label>
    <div class="grid">
      <label>Rotation (°)<input id="heading" type="number" min="0" max="359.99" step="0.01"></label>
      <label>Tilt (°)<input id="tilt" type="number" min="0" max="180" step="0.01"></label>
      <label>Zoom<input id="zoom" type="number" min="0.01" max="100" step="0.01"></label>
      <label>Height<select id="height-mode" aria-label="Height mode"><option value="fixed">Fixed height</option><option value="auto">Auto · fill available screen</option></select><input id="height" type="number" min="180" max="1600" step="1" aria-label="Height in pixels" aria-describedby="height-note"></label>
      <p id="height-note">Auto fills the space below the dashboard header. Best used in a single-card Panel view.</p>
    </div>
    <label class="check"><input id="interactive" type="checkbox">Allow camera movement by default</label>
    <label class="check"><input id="camera_controls" type="checkbox">Show camera buttons on the card (move camera and reset view)</label>
    <label class="check" id="floor-plan-button-setting"><input id="floor_plan_button" type="checkbox">Show the Floor plan button (switch between the 3D view and a top-down floor plan)</label>
    <label class="check"><input id="edit_button" type="checkbox">Show the Edit button to administrators (opens this view in the 3D Rooms editor)</label>
    <label class="check"><input id="light_panel" type="checkbox">Show the Lights button (each room's lights, with one switch per room)</label>
    <label class="check"><input id="shade_panel" type="checkbox">Show the Shades button (each room's shades, with one switch per room)</label>
    <label class="check"><input id="summary" type="checkbox">Show the at-a-glance bar (lights on, doors open, locks, anything busy)</label>
    <label class="check"><input id="spread_icons" type="checkbox">Move icons that overlap apart (a dot and line mark their real spot)</label>
    <label class="check" id="room-focus-setting" hidden><input id="room_focus" type="checkbox">Show a button in front of each room to view that room on its own</label>
    <label class="check" id="floor-selector-setting" hidden><input id="floor_selector" type="checkbox">Show floor switcher (whole house or one floor)</label>
    <label>Background<select id="background">${P.map((e) => `<option value="${e}">${Ee[e]}</option>`).join("")}</select></label>
    <label id="background-image-setting" hidden>Background image address<input id="background_image" type="url" inputmode="url" maxlength="2000" placeholder="/local/backgrounds/garden.jpg"></label>
    <label class="check"><input id="background_shadow" type="checkbox">Soft shadow under the house</label>
    <label>Rendering quality<select id="quality">
      <option value="auto">Automatic · lighter on phones and tablets</option>
      <option value="high">High · full shadows and sharpness</option>
      <option value="low">Low · faster and uses less battery</option>
    </select></label>
    <label id="daylight-setting" hidden>Time of day<select id="daylight">
      <option value="auto">Automatic · follow the Home Assistant sun</option>
      <option value="day">Always day</option>
      <option value="night">Always night</option>
    </select></label>
    <p id="daylight-note" hidden>Saved with this room, so every dashboard and the 3D Rooms manager use the same setting.</p>
    <button id="reset">Reset camera framing</button>
    <p id="error" role="alert" hidden></p>
    <p>Upload rooms and manage device mappings in the 3D Rooms sidebar. Save this card with Home Assistant’s Save button.</p>`, this._field = (e) => this.shadowRoot.getElementById(e);
		for (let e of [
			"model",
			"title",
			"show_title",
			"view",
			"heading",
			"tilt",
			"zoom",
			"height",
			"interactive"
		]) this._field(e).addEventListener("change", () => this._change(e));
		for (let e of R) {
			let t = this._field(e), n = t.closest("label"), r = document.createElement("div");
			r.className = t.type === "checkbox" ? "field-setting boolean" : "field-setting", n.after(r);
			let i = document.createElement("div");
			i.className = "override-controls", i.id = `override-controls-${e}`, i.hidden = !0;
			let a = document.createElement("button");
			a.type = "button", a.id = `reset-field-${e}`, a.className = "reset-field", a.innerHTML = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 10a8 8 0 1 1 1 8M4 4v6h6\"/></svg><span>Reset</span>", a.title = "Use saved view value", a.hidden = !0, a.setAttribute("aria-label", `Reset ${Ot[e]} to saved view`), a.addEventListener("click", () => this._resetField(e)), i.append(a), r.append(n, i);
		}
		this._field("height-mode").onchange = () => {
			this._field("height-mode").disabled || this._emit({
				...this._config,
				height: this._field("height-mode").value === "auto" ? "auto" : 500
			});
		}, this._field("component").onchange = () => this._component(), this._field("camera_controls").onchange = () => {
			let e = { ...this._config };
			this._field("camera_controls").checked ? delete e.camera_controls : e.camera_controls = !1, this._emit(e);
		}, this._field("floor_plan_button").onchange = () => {
			let e = { ...this._config };
			this._field("floor_plan_button").checked ? delete e.floor_plan_button : e.floor_plan_button = !1, this._emit(e);
		};
		for (let e of ["summary", "spread_icons"]) this._field(e).onchange = () => {
			let t = { ...this._config };
			this._field(e).checked ? delete t[e] : t[e] = !1, this._emit(t);
		};
		this._field("shade_panel").onchange = () => {
			let e = { ...this._config };
			this._field("shade_panel").checked ? delete e.shade_panel : e.shade_panel = !1, this._emit(e);
		}, this._field("edit_button").onchange = () => {
			let e = { ...this._config };
			this._field("edit_button").checked ? delete e.edit_button : e.edit_button = !1, this._emit(e);
		}, this._field("light_panel").onchange = () => {
			let e = { ...this._config };
			this._field("light_panel").checked ? delete e.light_panel : e.light_panel = !1, this._emit(e);
		}, this._field("room_focus").onchange = () => {
			let e = { ...this._config };
			this._field("room_focus").checked ? delete e.room_focus : e.room_focus = !1, this._emit(e);
		}, this._field("floor_selector").onchange = () => {
			let e = { ...this._config };
			this._field("floor_selector").checked ? delete e.floor_selector : e.floor_selector = !1, this._emit(e);
		};
		for (let e of [
			"background",
			"background_image",
			"background_shadow"
		]) this._field(e).onchange = () => this._changeBackground();
		this._field("quality").onchange = () => {
			let e = { ...this._config }, t = this._field("quality").value;
			t === "auto" ? delete e.quality : e.quality = t, this._emit(e);
		}, this._field("daylight").addEventListener("change", () => this._daylight()), this._field("retry").onclick = () => this._load(), this._field("reset").onclick = () => {
			if (this._config.saved_view) {
				let e = { ...this._config };
				for (let t of [
					"view",
					"heading",
					"tilt",
					"zoom",
					"camera"
				]) delete e[t];
				this._emit(e);
				return;
			}
			let e = {
				...this._config,
				view: "front",
				heading: 0,
				tilt: 28,
				zoom: 1
			};
			delete e.camera, this._emit(e);
		};
	}
	setConfig(e) {
		this._config = { ...e }, this._sync();
	}
	set hass(e) {
		this._hass?.connection !== e.connection && (this._attempted = !1), this._hass?.connection !== e.connection && (this._unsub?.(), this._unsub = null), this._hass = e, this._subscribe(), !this._attempted && !this._loading && this._load();
	}
	connectedCallback() {
		this._subscribe();
	}
	disconnectedCallback() {
		this._unsub?.(), this._unsub = null;
	}
	async _subscribe() {
		if (!this.isConnected || this._unsub || this._subscribing || !this._hass?.connection?.subscribeEvents) return;
		this._subscribing = !0;
		let e = this._hass.connection;
		try {
			let t = await e.subscribeEvents(() => this._load(), "three_d_rooms_updated");
			!this.isConnected || e !== this._hass.connection ? t() : this._unsub = t;
		} catch {} finally {
			this._subscribing = !1;
		}
	}
	_changeBackground() {
		let e = { ...this._config }, t = (e) => this._field(e), n = {};
		if (this._config.saved_view) try {
			let { saved_view: e } = this._config;
			n = z({ saved_view: e }, this._components);
		} catch {}
		let r = t("background").value, i = t("background_image").value.trim(), a = t("background_shadow").checked;
		r === (n.background || "spotlight") ? delete e.background : e.background = r, r === "image" && i && i !== n.background_image ? e.background_image = i : delete e.background_image, a === L({
			background: r,
			background_shadow: n.background_shadow,
			view: "front"
		}) ? delete e.background_shadow : e.background_shadow = a, this._emit(e);
	}
	_sync() {
		if (!this._config) return;
		let e = this._config;
		try {
			e = z(this._config, this._components);
		} catch (e) {
			this._loaded && (this._field("error").hidden = !1, this._field("error").textContent = e.message);
		}
		let t = this._field("component");
		this._config.saved_view && this._loaded && ![...t.options].some((e) => e.value === this._config.saved_view) && t.add(new Option(`${this._config.saved_view} (unavailable)`, this._config.saved_view)), t.value = this._config.saved_view || "", this._field("reset").textContent = this._config.saved_view ? "Use saved camera framing" : "Reset camera framing";
		let n;
		if (this._config.saved_view) try {
			n = z({ saved_view: this._config.saved_view }, this._components);
		} catch {}
		for (let e of R) {
			let t = !!this._config.saved_view, r = Object.hasOwn(this._config, e);
			this._field(`reset-field-${e}`).hidden = !t || !r || !n || this._config[e] === n[e], this._field(`override-controls-${e}`).hidden = this._field(`reset-field-${e}`).hidden, this._field(e).disabled = !1;
		}
		for (let t of Object.keys(kt).concat([
			"model",
			"title",
			"interactive"
		])) {
			let n = this._field(t), r = e.camera, i = t === "zoom" ? r?.referenceZoom : r?.[t], a = e[t] ?? i ?? (t === "tilt" && e.view === "floor" ? 0 : kt[t]) ?? "";
			t === "interactive" || t === "show_title" ? n.checked = !!a : n.value = a;
		}
		this._field("height-mode").value = e.height === "auto" ? "auto" : "fixed", this._field("height-mode").disabled = this._field("height").disabled, this._field("height").hidden = e.height === "auto";
		let r = e.model, i = this._field("model");
		r && ![...i.options].some((e) => e.value === r) && (i.add(new Option(`${r} (not in room library)`, r)), i.value = r);
		let a = this._models?.find((e) => e.id === r);
		this._field("floor-selector-setting").hidden = !G(this._models, a).length, this._field("room-focus-setting").hidden = !a?.houseView, this._field("room_focus").checked = this._config.room_focus !== !1, this._field("floor_selector").checked = this._config.floor_selector !== !1, this._field("camera_controls").checked = this._config.camera_controls !== !1, this._field("floor_plan_button").checked = this._config.floor_plan_button !== !1, this._field("floor-plan-button-setting").hidden = (e.view || "front") === "floor", this._field("light_panel").checked = this._config.light_panel !== !1, this._field("edit_button").checked = this._config.edit_button !== !1, this._field("shade_panel").checked = this._config.shade_panel !== !1, this._field("summary").checked = this._config.summary !== !1, this._field("spread_icons").checked = this._config.spread_icons !== !1;
		let o = e.background || "spotlight";
		this._field("background").value = o, this._field("background-image-setting").hidden = o !== "image", this._field("background_image").value = e.background_image || "", this._field("background_image").setCustomValidity(!e.background_image || I(e.background_image) ? "" : "Use an address starting with /, http:// or https://"), this._field("background_shadow").checked = L({
			...e,
			view: "front"
		}), this._field("quality").value = this._config.quality || "auto";
		let s = this._models?.find((e) => e.id === r)?.daylight;
		this._field("daylight-setting").hidden = !s, this._field("daylight-note").hidden = !s, s && (this._field("daylight").value = s.mode);
	}
	async _load() {
		if (!this._hass) return;
		this._loading = !0, this._attempted = !0;
		let e = this._hass;
		this._field("status").textContent = "Loading rooms…", this._field("retry").hidden = !0;
		try {
			let [t, n] = await Promise.all([e.callWS({
				type: "three_d_rooms/request",
				operation: "models"
			}), e.callWS({
				type: "three_d_rooms/request",
				operation: "components"
			})]);
			if (e.connection !== this._hass.connection) return;
			this._components = n, this._models = t;
			let r = this._field("model");
			r.replaceChildren(new Option("Choose a room", ""));
			for (let e of t) r.add(new Option(e.title || e.name || e.id, e.id));
			let i = this._field("component");
			i.replaceChildren(new Option("Choose a saved view (optional)", ""));
			for (let e of n) i.add(new Option(`${t.find((t) => t.id === e.layers[0].model)?.title || "Room unavailable"} · ${e.title}`, e.id));
			this._loaded = !0, this._field("status").textContent = t.length ? "" : "No rooms yet. Upload a model in the 3D Rooms sidebar first.", this._sync();
		} catch (e) {
			this._field("status").textContent = e.message || "Could not load rooms. Check that 3D Rooms is installed and you are an administrator.", this._field("retry").hidden = !1;
		} finally {
			this._loading = !1;
		}
	}
	_component() {
		let e = this._components?.find((e) => e.id === this._field("component").value);
		if (!this._field("component").value) {
			let e;
			try {
				e = z(this._config, this._components);
			} catch {
				e = { ...this._config };
			}
			delete e.saved_view, this._emit(e);
			return;
		}
		if (!e || e.layers?.length !== 1) return;
		let t = {
			...this._config,
			saved_view: e.id
		};
		for (let e of [
			...R,
			"camera",
			"markers"
		]) delete t[e];
		this._emit(t);
	}
	_resetField(e) {
		let t = { ...this._config };
		delete t[e], this._emit(t);
	}
	_change(e) {
		let t = this._field(e);
		if (t.disabled) return;
		if (!t.checkValidity()) {
			this._field("error").hidden = !1, this._field("error").textContent = t.validationMessage;
			return;
		}
		let n = e === "height" ? t.value.trim().toLowerCase() === "auto" ? "auto" : Number(t.value) : t.type === "checkbox" ? t.checked : t.type === "number" ? Number(t.value) : t.value;
		if (t.type === "number" && t.value === "" || e === "model" && !n) return;
		if (e === "height" && n !== "auto" && (!Number.isInteger(n) || n < 180 || n > 1600)) {
			this._field("error").hidden = !1, this._field("error").textContent = "Enter auto or a height between 180 and 1600 pixels.";
			return;
		}
		this._field("error").hidden = !0;
		let r = {
			...this._config,
			[e]: n
		};
		r.saved_view || e !== "model" && e !== "view" || (delete r.camera, Object.assign(r, {
			heading: 0,
			tilt: r.view === "floor" ? 0 : 28,
			zoom: 1
		})), this._emit(r);
	}
	async _daylight() {
		let e = this._models?.find((e) => e.id === z(this._config, this._components).model), t = this._field("daylight");
		if (!e?.daylight || !this._hass) return;
		let n = e.daylight.mode;
		this._field("error").hidden = !0;
		try {
			let n = await this._hass.callWS({
				type: "three_d_rooms/request",
				operation: "daylight",
				data: {
					model: e.id,
					mode: t.value,
					entity: e.daylight.entity
				}
			});
			e.daylight = {
				...e.daylight,
				...n.daylight
			};
		} catch (e) {
			t.value = n, this._field("error").hidden = !1, this._field("error").textContent = e.message || "Could not save the time of day for this room.";
		}
	}
	_emit(e) {
		if (this._field("error").hidden = !0, e.saved_view) try {
			let t = z({ saved_view: e.saved_view }, this._components);
			e = { ...e };
			for (let n of R) Object.hasOwn(e, n) && e[n] === t[n] && delete e[n];
		} catch {}
		this._config = {
			...e,
			type: "custom:three-d-rooms-card"
		}, this._sync(), this.dispatchEvent(new CustomEvent("config-changed", {
			detail: { config: this._config },
			bubbles: !0,
			composed: !0
		}));
	}
};
customElements.get("three-d-rooms-editor") || customElements.define("three-d-rooms-editor", At);
// dashboard/transport.mjs
async function jt(e, t, n, r = fetch) {
	if (!t.preview_url && !t.addon) return {
		preview: !1,
		async load({ onProgress: n, onModel: r, fresh: i = !1 } = {}) {
			let a = await e.callWS({
				type: "three_d_rooms/request",
				operation: "models"
			}), o = a.find((e) => e.id === t.model);
			if (!o) throw Error("Model not found. Upload it in the 3D Rooms sidebar first.");
			let c = p(t.quality), { model: l, floors: u, views: d } = Dt(a, o, t.floor_selector !== !1);
			if (r?.({
				model: l,
				configured: o,
				views: d
			}), l.members) {
				let t = [];
				try {
					for (let [r, o] of l.members.entries()) {
						let u = a.find((e) => e.id === o.model);
						if (!u) throw Error("A room in this house is missing.");
						let d = n && ((e) => n({
							...e,
							index: r,
							count: l.members.length
						}));
						d?.({ loaded: 0 }), t.push({
							...o,
							assetCache: {
								owner: M(e),
								key: s(u, c)
							},
							url: URL.createObjectURL(await N(e, u, c, d, { fresh: i }))
						});
					}
					return {
						model: l,
						configured: o,
						floors: u,
						views: d,
						layers: t,
						release: () => t.forEach((e) => URL.revokeObjectURL(e.url))
					};
				} catch (e) {
					throw t.forEach((e) => URL.revokeObjectURL(e.url)), e;
				}
			}
			let f = URL.createObjectURL(await N(e, l, c, n && ((e) => n({
				...e,
				index: 0,
				count: 1
			})), { fresh: i }));
			return {
				model: l,
				configured: o,
				floors: u,
				views: d,
				sceneURL: f,
				assetCache: {
					owner: M(e),
					key: s(l, c)
				},
				release: () => URL.revokeObjectURL(f)
			};
		}
	};
	let i, a;
	if (t.preview_url) {
		let e = new URL(t.preview_url, n);
		if (![
			"127.0.0.1",
			"localhost",
			"[::1]"
		].includes(e.hostname) || e.origin !== n) throw Error("Preview URLs are only allowed on the same local development server.");
		i = e.href, i.endsWith("/") || (i += "/");
	} else {
		if (e.user?.is_admin === !1) throw Error("This first version requires a Home Assistant administrator.");
		let r = t.addon;
		if (!r) {
			let t = (await e.callWS({
				type: "supervisor/api",
				endpoint: "/addons",
				method: "get"
			})).addons.filter((e) => e.slug.endsWith("_three_d_rooms"));
			if (t.length !== 1) throw Error("Set addon to the installed 3D Rooms add-on slug.");
			r = t[0].slug;
		}
		if (!/^[a-zA-Z0-9_-]+$/.test(r)) throw Error("Invalid add-on slug.");
		let o = await e.callWS({
			type: "supervisor/api",
			endpoint: `/addons/${r}/info`,
			method: "get"
		});
		if (o.state !== "started") throw Error("Start the 3D Rooms add-on first.");
		if (!o.ingress_url?.startsWith("/api/hassio_ingress/")) throw Error("This app needs Home Assistant Ingress enabled.");
		if (a = (await e.callWS({
			type: "supervisor/api",
			endpoint: "/ingress/session",
			method: "post"
		})).session, typeof a != "string" || !/^[-_a-zA-Z0-9.]+$/.test(a)) throw Error("Home Assistant did not provide a valid Ingress session.");
		i = new URL(o.ingress_url.replace(/\/$/, "") + "/", n).href;
	}
	return {
		base: i,
		session: a,
		preview: !!t.preview_url,
		async load() {
			let e = await r(new URL("api/models", i), { credentials: "same-origin" });
			if (!e.ok) throw Error("Could not read models. Open the 3D Rooms add-on and try again.");
			let n = await e.json(), a = n.find((e) => e.id === t.model);
			if (!a) throw Error("Model not found. Upload it in the 3D Rooms add-on first.");
			let { model: o, floors: s, views: c } = Dt(n, a, t.floor_selector !== !1);
			return o.members ? {
				model: o,
				configured: a,
				floors: s,
				views: c,
				layers: o.members.map((e) => ({
					...e,
					url: new URL(`api/models/${encodeURIComponent(e.model)}/scene.glb`, i).href
				}))
			} : {
				model: o,
				configured: a,
				floors: s,
				views: c,
				sceneURL: new URL(`api/models/${encodeURIComponent(o.id)}/scene.glb`, i).href
			};
		}
	};
}
// shared/room-lights.mjs
var K = {
	light: {
		entity: /^(light|switch)\.[a-z0-9_]+$/,
		isOn: (e) => !!e.on,
		services: {
			on: "turn_on",
			off: "turn_off"
		}
	},
	shade: {
		entity: /^cover\.[a-z0-9_]+$/,
		isOn: (e) => (e.position ?? e.motionPosition ?? 0) > 0,
		services: {
			on: "open_cover",
			off: "close_cover"
		}
	}
};
function Mt(e, n = "light", r = () => !1) {
	let { entity: i } = K[n], a = (e) => n === "light" ? e.type === "light" : e.type === "cover" && e.motion !== "none" && r(e), o = /* @__PURE__ */ new Map(), s = new Set((e?.controls || []).filter((e) => e.hidden && a(e)).map((t) => e.bindings?.[t.id]).filter(Boolean));
	for (let r of e?.controls || []) {
		if (!a(r) || r.hidden || r.lightGroupPrimary === !1) continue;
		let c = r.sourceModel || e.id, l = t(r.roomTitle || e.title || "Room");
		o.has(c) || o.set(c, {
			id: c,
			kind: n,
			title: l,
			lights: [],
			entities: []
		});
		let u = o.get(c), d = r.roomTitle ? `${r.roomTitle} · ` : "", f = (r.lightGroup ? r.lightGroupLabel : r.label) || r.name || (n === "light" ? "Light" : "Shade");
		d && f.startsWith(d) && (f = f.slice(d.length));
		let p = e.bindings?.[r.id], m = i.test(p || "");
		u.lights.push({
			id: r.id,
			label: f,
			entityId: m ? p : void 0,
			group: !!r.lightGroup
		}), m && !s.has(p) && !u.entities.includes(p) && u.entities.push(p);
	}
	return [...o.values()];
}
var q = (e) => Mt(e, "light");
function J(e, t) {
	let { isOn: n } = K[e.kind || "light"], r = 0, i = 0;
	for (let a of e.lights) {
		let e = t.get(a.id);
		e && !e.unavailable && (i++, n(e) && r++);
	}
	return {
		on: r,
		available: i,
		total: e.lights.length
	};
}
function Nt(e, t, n = {}) {
	let { services: r } = K[e.kind || "light"], i = J(e, t).on === 0, a = i ? r.on : r.off, o = /* @__PURE__ */ new Map();
	for (let t of e.entities) {
		let e = n[t];
		if (!e || ["unavailable", "unknown"].includes(e.state)) continue;
		let r = t.split(".")[0];
		o.has(r) || o.set(r, []), o.get(r).push(t);
	}
	return {
		turnOn: i,
		calls: [...o].map(([e, t]) => [
			e,
			a,
			{ entity_id: t }
		])
	};
}
function Y(e) {
	return {
		id: "",
		kind: e[0]?.kind || "light",
		title: "All",
		lights: e.flatMap((e) => e.lights),
		entities: [...new Set(e.flatMap((e) => e.entities))]
	};
}
function X(e, t = {}) {
	return e.map((e) => {
		let n = t[e];
		if (!n || ["unavailable", "unknown"].includes(n.state)) return null;
		let r = n.attributes?.current_position;
		return {
			entityId: e,
			state: n.state,
			...typeof r == "number" ? { position: r } : {}
		};
	}).filter(Boolean);
}
function Pt(e) {
	let t = /* @__PURE__ */ new Map(), n = [];
	for (let { entityId: r, state: i, position: a } of e) {
		let e = r.split(".")[0];
		if (e === "cover") {
			typeof a == "number" ? n.push([
				"cover",
				"set_cover_position",
				{
					entity_id: r,
					position: a
				}
			]) : (i === "open" || i === "closed") && n.push([
				"cover",
				i === "open" ? "open_cover" : "close_cover",
				{ entity_id: r }
			]);
			continue;
		}
		if (i !== "on" && i !== "off") continue;
		let o = `${e}.${i}`;
		t.has(o) || t.set(o, [
			e,
			i,
			[]
		]), t.get(o)[2].push(r);
	}
	for (let [e, r, i] of t.values()) n.push([
		e,
		r === "on" ? "turn_on" : "turn_off",
		{ entity_id: i }
	]);
	return n;
}
// dashboard/card.js
var Z = "M12,2C14.65,2 17.19,3.06 19.07,4.93L17.65,6.35C16.15,4.85 14.12,4 12,4C9.88,4 7.84,4.84 6.35,6.35L4.93,4.93C6.81,3.06 9.35,2 12,2M3.66,6.5L5.11,7.94C4.39,9.17 4,10.57 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,10.57 19.61,9.17 18.88,7.94L20.34,6.5C21.42,8.12 22,10.04 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12C2,10.04 2.58,8.12 3.66,6.5M12,6A6,6 0 0,1 18,12C18,13.59 17.37,15.12 16.24,16.24L14.83,14.83C14.08,15.58 13.06,16 12,16C10.94,16 9.92,15.58 9.17,14.83L7.76,16.24C6.63,15.12 6,13.59 6,12A6,6 0 0,1 12,6M12,8A1,1 0 0,0 11,9A1,1 0 0,0 12,10A1,1 0 0,0 13,9A1,1 0 0,0 12,8Z";
function Ft(e, t) {
	return `<svg viewBox="0 0 24 24">${t ? T(t) || "" : e.type === "climate" ? Qe : e.type === "lock" ? Ze : `<path d="${e.type === "vacuum" ? Z : e.type === "button" ? "m8 4 12 8-12 8Z" : e.type === "number" ? "M3 7h18v3H3zm2 3h2v11H5zm12 0h2v11h-2z" : e.type === "light" ? "M9 21h6v-1H9v1Zm3-19a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2Zm2.85 11.1-.85.6V16h-4v-2.3l-.85-.6a5 5 0 1 1 5.7 0Z" : "M3 3h18v2H3zm1 4h16v2H4zm0 4h16v2H4zm0 4h16v2H4zm7 4h2v3h-2z"}"/>`}</svg>`;
}
var It = /* @__PURE__ */ new Set([
	"shade",
	"blind",
	"curtain",
	"shutter",
	"awning"
]), Lt, Rt = () => Lt ||= import("./three-d-rooms-scene-iEIiKNNz.js").catch((e) => {
	throw Lt = void 0, e;
}), zt = {
	light: "mdi:lightbulb",
	opening: "mdi:door-open",
	lock: "mdi:lock",
	climate: "mdi:air-conditioner"
}, Bt = (e) => e.kind === "vacuum" ? `<path d="${Z}"/>` : T(e.kind === "lock" && e.tone === "unlocked" ? "mdi:lock-open-variant" : zt[e.kind]), Q = {
	auto: {
		label: "Auto",
		hint: "follow the sun",
		icon: "<path d=\"M12 3v3M5.6 7.6 7 9M18.4 7.6 17 9M3 16h18M7 16a5 5 0 0 1 10 0M8 20h8\"/>"
	},
	day: {
		label: "Day",
		hint: "always daylight",
		icon: "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4\"/>"
	},
	night: {
		label: "Night",
		hint: "always night",
		icon: "<path d=\"M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z\"/>"
	}
}, Vt = (e, t = 1) => {
	let n = Object.keys(Q);
	return n[(n.indexOf(e) + t + n.length) % n.length];
}, $ = class extends HTMLElement {
	static getConfigElement() {
		return document.createElement("three-d-rooms-editor");
	}
	static getStubConfig() {
		return {
			height: 500,
			view: "front",
			tilt: 28
		};
	}
	constructor() {
		super(), this.attachShadow({ mode: "open" }), this.shadowRoot.innerHTML = `<style>:host{display:block;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}input,textarea{-webkit-user-select:text;user-select:text}.switching{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;cursor:progress;background:color-mix(in srgb,var(--card-background-color,#101715) 40%,transparent);-webkit-backdrop-filter:blur(1.5px);backdrop-filter:blur(1.5px)}.switching-pill{display:inline-flex;align-items:center;gap:10px;max-width:calc(100% - 32px);padding:10px 18px 10px 14px;border-radius:999px;color:var(--primary-text-color,#edf2eb);background:color-mix(in srgb,var(--card-background-color,#101715) 90%,transparent);box-shadow:0 2px 8px #0006;font:500 14px/1.3 system-ui}.switching-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.spinner{flex-shrink:0;width:18px;height:18px;box-sizing:border-box;border:2px solid color-mix(in srgb,var(--primary-text-color,#edf2eb) 25%,transparent);border-top-color:var(--primary-color,#aacaab);border-radius:50%;will-change:transform;animation:switch-spin .8s linear infinite}@keyframes switch-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.spinner{animation-duration:2.4s}}ha-card{container:card-root/inline-size;display:block;position:relative;overflow:hidden;background:var(--ha-card-background,var(--card-background-color,#101715));border-radius:var(--ha-card-border-radius,12px)}header{padding:16px 20px 0;font:500 18px system-ui;color:var(--primary-text-color,#edf2eb)}.scene{position:relative;isolation:isolate;width:100%;height:500px;container:card-scene/inline-size}.scene canvas{display:block;width:100%;height:100%}${Fe}.message{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;gap:16px;color:var(--primary-text-color,#edf2eb);font:14px/1.5 system-ui;background:var(--card-background-color,#101715);z-index:1}.loading-preview{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;transition:opacity .3s ease-out}.loading-preview.fading{opacity:0}.message.over-preview{background:color-mix(in srgb,var(--card-background-color,#101715) 45%,transparent);backdrop-filter:blur(1.5px);-webkit-backdrop-filter:blur(1.5px)}.message.over-preview>span{padding:6px 12px;border-radius:999px;background:color-mix(in srgb,var(--card-background-color,#101715) 80%,transparent)}@media(prefers-reduced-motion:reduce){.loading-preview{transition:none}}.message progress{appearance:none;-webkit-appearance:none;width:min(220px,70%);height:4px;border:0;border-radius:2px;overflow:hidden;background:color-mix(in srgb,var(--primary-text-color,#edf2eb) 18%,transparent);color:var(--primary-color,#aacaab)}.message progress::-webkit-progress-bar{background:transparent}.message progress::-webkit-progress-value{background:var(--primary-color,#aacaab);border-radius:2px;transition:width .2s}.message progress::-moz-progress-bar{background:var(--primary-color,#aacaab);border-radius:2px}button{font:inherit;min-height:44px;padding:10px 18px;border:1px solid var(--divider-color,#536258);border-radius:8px;background:transparent;color:inherit;cursor:pointer}button:focus-visible{outline:2px solid var(--primary-color,#aacaab)}.fixture-access{position:absolute;inset:0;pointer-events:none}.fixture-access button{position:absolute;box-sizing:border-box;width:var(--marker-size,32px);height:var(--marker-size,32px);min-height:var(--marker-size,32px);padding:6px;border-radius:50%;background:var(--card-background-color,#202923);color:var(--primary-text-color,#edf2eb);border-color:color-mix(in srgb,var(--primary-text-color,#edf2eb) 45%,transparent);pointer-events:auto;touch-action:none;box-shadow:0 2px 8px #0006}.fixture-access button::before{content:"";position:absolute;inset:-6px;border-radius:50%}.fixture-access button[aria-pressed="true"]{color:#ffd66b;border-color:#ffd66b}.fixture-access button[aria-disabled="true"]{opacity:.55}.fixture-access button svg{width:18px;height:18px;fill:currentColor}.fixture-feedback{position:absolute;bottom:12px;left:12px;right:12px;color:var(--primary-text-color,#edf2eb);background:var(--card-background-color,#202923);padding:8px;border-radius:8px;pointer-events:none}.fixture-access ha-state-icon{display:block;width:18px;height:18px;--mdc-icon-size:18px;color:inherit}.fixture-access button[data-active="true"]{color:var(--primary-text-color,#edf2eb);border-color:var(--state-active-color,#ffd66b);background:color-mix(in srgb,var(--state-active-color,#ffd66b) 18%,var(--card-background-color,#202923))}.fixture-access button[data-unavailable="true"]{opacity:.65;color:var(--disabled-text-color,#9aa29e);border-style:dashed}.fixture-state{position:absolute;top:calc(var(--marker-size,32px) - 6px);left:50%;transform:translateX(-50%);padding:1px 4px;min-width:20px;white-space:nowrap;border:1px solid var(--divider-color,#536258);border-radius:6px;background:var(--card-background-color,#202923);color:var(--primary-text-color,#edf2eb);font:600 10px/14px system-ui;pointer-events:none}.fixture-access button[data-moving="true"] .fixture-state{color:var(--primary-color,#aacaab)}dialog{box-sizing:border-box;width:min(360px,calc(100vw - 32px));border:1px solid var(--divider-color,#536258);border-radius:var(--ha-dialog-border-radius,16px);padding:24px;background:var(--ha-card-background,var(--card-background-color,#202923));color:var(--primary-text-color,#edf2eb);font:14px system-ui;box-shadow:0 12px 40px #0005}dialog::backdrop{background:var(--mdc-dialog-scrim-color,#0008)}dialog h2{font-size:20px;margin:0 0 8px}dialog p{color:var(--secondary-text-color,#aebbb2);line-height:1.5}dialog label{display:grid;gap:8px;margin:18px 0}dialog .confirm{background:var(--primary-color,#aacaab);color:var(--text-primary-color,#101715);border-color:var(--primary-color,#aacaab)}dialog input{width:100%;min-height:32px;box-sizing:border-box}dialog .close{margin-top:12px}.daylight-switch{position:absolute;top:12px;right:12px;z-index:1;box-sizing:border-box;display:inline-flex;height:44px;padding:3px;color:var(--primary-text-color,#edf2eb);background-color:var(--card-background-color,#202923);border:1px solid var(--divider-color,#536258);border-radius:8px;box-shadow:0 2px 8px #0006}.daylight-switch button{position:relative;z-index:1;display:grid;place-items:center;width:40px;height:36px;min-height:0;padding:0;border:0;border-radius:6px;color:inherit;transition:color .2s}.daylight-switch button[aria-checked="true"]{color:var(--text-primary-color,#101715)}.daylight-switch button:focus-visible{outline:2px solid var(--primary-color,#aacaab);outline-offset:1px}.daylight-switch svg{width:20px;height:20px}.daylight-thumb{position:absolute;top:3px;left:3px;width:40px;height:36px;border-radius:6px;background:var(--primary-color,#aacaab);transition:transform .22s cubic-bezier(.3,.7,.3,1)}.daylight-switch[data-mode="day"] .daylight-thumb{transform:translateX(40px)}.daylight-switch[data-mode="night"] .daylight-thumb{transform:translateX(80px)}@media(prefers-reduced-motion:reduce){.daylight-thumb,.daylight-switch button{transition:none}}[hidden]{display:none!important}.card-top{display:none;align-items:center;gap:12px;min-width:0;box-sizing:border-box}.card-top:has(header:not([hidden])),.card-top:has(.daylight-switch:not([hidden])){display:flex;padding:12px 16px}.card-top header{padding:0;flex:1;min-width:0;overflow-wrap:anywhere;font-size:16px;line-height:1.4}.card-top .daylight-switch{position:relative;top:auto;right:auto;flex-shrink:0;margin-left:auto;box-shadow:none}.card-top.card-top:has(header[hidden]){position:absolute;top:12px;right:12px;z-index:1;padding:0}.fixture-access button{min-width:var(--marker-size,32px);min-height:var(--marker-size,32px);width:var(--marker-size,32px);height:var(--marker-size,32px)}.fixture-access button::before{inset:min(-4px,calc((var(--marker-size,32px) - 46px)/2))}.fixture-state{top:calc(var(--marker-size,32px) - 6px);font-size:11px;line-height:16px}.fixture-tray{display:flex;flex-direction:column;gap:8px;padding:12px}.fixture-tray:empty{display:none}.fixture-tray button{display:flex;align-items:center;gap:12px;min-height:44px;text-align:left;color:var(--primary-text-color,#edf2eb);background:var(--card-background-color,#202923)}.fixture-tray ha-state-icon{width:var(--marker-size,32px);height:var(--marker-size,32px);--mdc-icon-size:var(--marker-size,32px)}.fixture-tray ha-state-icon svg{width:100%;height:100%;fill:currentColor}.fixture-tray .fixture-state{position:static;transform:none;margin-left:auto;font:inherit;white-space:nowrap}.fixture-name{flex:1}.fixture-tray button[data-unavailable="true"]{opacity:.65}.fixture-tray button[data-active="true"] ha-state-icon{color:var(--state-active-color,#ffd66b)}.fixture-access button{display:grid;place-items:center;padding:0;--marker-glyph-size:clamp(12px,calc(var(--marker-size,32px) - 14px),24px)}.fixture-access ha-state-icon{width:var(--marker-glyph-size);height:var(--marker-glyph-size);--mdc-icon-size:var(--marker-glyph-size)}.fixture-access button svg{display:block;width:var(--marker-glyph-size);height:var(--marker-glyph-size)}.fixture-access .fixture-state{top:calc(var(--marker-size,32px) - 2px);font-size:clamp(9px,calc(var(--marker-size,32px) - 15px),11px);line-height:14px}.fixture-access ha-state-icon,.fixture-tray ha-state-icon{display:flex;align-items:center;justify-content:center;line-height:0;font-size:0;flex-shrink:0}.fixture-ac-icon{display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:0}.fixture-access .fixture-ac-icon{width:var(--marker-glyph-size);height:var(--marker-glyph-size)}.fixture-tray .fixture-ac-icon{width:var(--marker-size,32px);height:var(--marker-size,32px)}.fixture-ac-icon svg{display:block;width:100%;height:100%;fill:currentColor}.fixture-tray button[data-active="true"] .fixture-ac-icon{color:var(--state-active-color,#ffd66b)}.card-controls{position:absolute;right:12px;bottom:max(12px,env(safe-area-inset-bottom));left:12px;z-index:2;display:flex;flex-direction:row-reverse;flex-wrap:wrap-reverse;align-items:center;gap:8px;pointer-events:none}.card-controls>*{pointer-events:auto;flex-shrink:0}.card-controls>button{display:grid;place-items:center;box-sizing:border-box;width:44px;height:44px;min-height:44px;padding:10px;color:var(--primary-text-color,#edf2eb);background:var(--card-background-color,#202923);box-shadow:0 2px 8px #0006}.card-controls>button svg{width:22px;height:22px}.model-refresh:disabled{opacity:.5;cursor:wait}.camera-move[aria-pressed="true"],.camera-floor-plan[aria-pressed="true"]{color:var(--text-primary-color,#101715);background:var(--primary-color,#aacaab);border-color:var(--primary-color,#aacaab)}.floor-switch{display:flex;gap:2px;box-sizing:border-box;height:44px;max-width:100%;padding:3px;overflow-x:auto;scrollbar-width:none;background:var(--card-background-color,#202923);border:1px solid var(--divider-color,#536258);border-radius:8px;box-shadow:0 2px 8px #0006}.floor-switch button{flex-shrink:0;height:36px;min-height:0;min-width:44px;padding:0 12px;border:0;border-radius:6px;font:500 14px system-ui;white-space:nowrap;color:var(--primary-text-color,#edf2eb)}.floor-switch button:hover{background:color-mix(in srgb,var(--primary-text-color,#edf2eb) 10%,transparent)}.floor-switch button[aria-pressed="true"]{background:var(--primary-color,#aacaab);color:var(--text-primary-color,#101715)}.floor-switch button:focus-visible{outline:2px solid var(--primary-color,#aacaab);outline-offset:-2px}.panel-toggles{position:absolute;top:12px;left:12px;z-index:3;display:flex;gap:8px}[data-tone="locked"]{--tone:var(--state-lock-locked-color,#43a047)}[data-tone="unlocked"]{--tone:var(--state-lock-unlocked-color,#e5533d)}[data-tone="jammed"]{--tone:var(--state-lock-jammed-color,#e5533d)}[data-tone="moving"]{--tone:var(--state-lock-locking-color,#ff9800)}[data-tone="light"]{--tone:var(--state-light-active-color,#ffc107);--tone-ink:#1c1c1c}[data-tone="open"]{--tone:var(--state-cover-active-color,#9c27b0)}[data-tone="cool"]{--tone:var(--state-climate-cool-color,#2196f3)}[data-tone="heat"]{--tone:var(--state-climate-heat-color,#ff5722)}[data-tone="dry"]{--tone:var(--state-climate-dry-color,#ff9800)}[data-tone="fan_only"]{--tone:var(--state-climate-fan_only-color,#00bcd4)}[data-tone="auto"]{--tone:var(--state-climate-auto-color,#4caf50)}[data-tone="cleaning"]{--tone:var(--state-vacuum-active-color,#009688)}.fixture-access button[data-tone]{color:var(--tone-ink,#fff);border-color:var(--tone);background:var(--tone)}.fixture-tray button[data-tone] ha-state-icon,.fixture-tray button[data-tone] .fixture-ac-icon{color:var(--tone)}.fixture-tray button[data-tone] .fixture-state{color:var(--tone);border-color:var(--tone)}.light-panel-toggle{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;width:auto;height:44px;min-height:44px;padding:0 14px 0 11px;font:500 14px system-ui;color:var(--primary-text-color,#edf2eb);background:var(--card-background-color,#202923);box-shadow:0 2px 8px #0006}.light-panel-toggle svg{flex-shrink:0;width:20px;height:20px}.light-panel-toggle[aria-expanded="true"]{color:var(--text-primary-color,#101715);background:var(--primary-color,#aacaab);border-color:var(--primary-color,#aacaab)}.light-panel{position:absolute;top:64px;left:12px;bottom:68px;z-index:3;display:flex;flex-direction:column;box-sizing:border-box;width:min(300px,calc(100% - 24px));max-height:calc(100% - 132px);height:fit-content;overflow:hidden;color:var(--primary-text-color,#edf2eb);background:var(--ha-card-background,var(--card-background-color,#202923));-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:1px solid var(--divider-color,#536258);border-radius:12px;box-shadow:0 4px 16px #0008;font:14px/1.4 system-ui}.light-panel>h2{display:flex;align-items:center;gap:8px;margin:0;padding:10px 8px 10px 14px;font:600 15px system-ui;border-bottom:1px solid var(--divider-color,#536258)}.light-panel>h2>span:first-child{flex:1}.light-panel>h2 .light-room-count{font-weight:400}.light-panel>h2 [role="switch"]{margin-right:2px}.light-panel .panel-close{min-height:36px;width:36px;padding:0;border:0;font-size:20px;line-height:1}.light-rooms{overflow-y:auto;overscroll-behavior:contain;padding:4px 0}.light-room+.light-room{border-top:1px solid color-mix(in srgb,var(--divider-color,#536258) 60%,transparent)}.light-room-head,.light-row{display:flex;align-items:center;gap:6px;padding:0 10px 0 4px}.light-room-head>button:first-child,.light-row>button:first-child{display:flex;flex:1;align-items:center;gap:8px;min-width:0;min-height:44px;padding:4px 6px;border:0;border-radius:8px;text-align:left}.light-room-head>button:first-child:hover,.light-row>button:first-child:hover{background:color-mix(in srgb,var(--primary-text-color,#edf2eb) 8%,transparent)}.light-room-title{flex:1;min-width:0;font-weight:600;overflow:hidden;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-height:1.3}.light-room-count{flex-shrink:0;color:var(--secondary-text-color,#aebbb2);font-size:12px}.light-chevron{flex-shrink:0;width:16px;transition:transform .15s}.light-room-head>button[aria-expanded="true"] .light-chevron{transform:rotate(90deg)}.light-list{margin:0 0 6px;padding:0;list-style:none}.light-row{padding-left:22px}.light-row>button:first-child{min-height:40px}.light-row ha-state-icon,.light-row .light-glyph{display:flex;flex-shrink:0;width:20px;height:20px;--mdc-icon-size:20px;color:var(--secondary-text-color,#aebbb2)}.light-row .light-glyph svg{width:100%;height:100%;fill:currentColor}.light-row[data-on="true"] ha-state-icon,.light-row[data-on="true"] .light-glyph{color:var(--state-active-color,#ffd66b)}.light-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.light-row[data-unavailable="true"] .light-name{color:var(--disabled-text-color,#9aa29e)}.light-panel button[role="switch"]{position:relative;flex-shrink:0;width:40px;min-height:24px;height:24px;padding:0;border-radius:12px;background:color-mix(in srgb,var(--primary-text-color,#edf2eb) 35%,transparent);border:0}.light-panel button[role="switch"]::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px #0006;transition:left .15s}.light-panel button[role="switch"][aria-checked="true"]{background:var(--state-active-color,#ffd66b)}.light-panel[data-kind="shade"] button[role="switch"][aria-checked="true"]{background:var(--state-cover-active-color,#9c27b0)}.light-panel[data-kind="shade"] .light-row[data-on="true"] ha-state-icon{color:var(--state-cover-active-color,#9c27b0)}.light-row{flex-wrap:wrap}.light-position{flex-shrink:0;margin-left:auto;padding-left:8px;color:var(--secondary-text-color,#aebbb2);font-size:12px}.light-dim{flex-basis:100%;box-sizing:border-box;width:auto;height:28px;margin:-4px 0 6px 34px;accent-color:var(--state-active-color,#ffd66b);cursor:pointer}.light-panel button[role="switch"][aria-checked="true"]::after{left:19px}.light-panel button[role="switch"]:disabled{opacity:.4;cursor:default}.light-panel button[role="switch"][aria-busy="true"]{opacity:.7;cursor:progress}.fixture-access button[data-highlight="true"]{outline:3px solid var(--primary-color,#aacaab);outline-offset:2px;z-index:1}.fixture-access .room-group{position:absolute;display:inline-flex;align-items:center;gap:6px;box-sizing:border-box;width:auto;min-width:0;height:34px;min-height:34px;padding:0 6px 0 10px;border-radius:17px;background:var(--card-background-color,#202923);color:var(--primary-text-color,#edf2eb);border:1px solid var(--divider-color,#536258);font:600 13px/1 system-ui;white-space:nowrap;transform:translate(-50%,-50%);box-shadow:0 2px 8px #0006;z-index:2}.fixture-access .room-group::before{content:"";position:absolute;inset:-5px;border-radius:22px}.fixture-access .room-group .group-count{display:grid;place-items:center;min-width:22px;height:22px;padding:0 6px;box-sizing:border-box;border-radius:11px;background:color-mix(in srgb,var(--primary-text-color,#edf2eb) 14%,transparent);font-size:12px}.fixture-access .room-group[data-active="true"] .group-count{background:var(--state-light-active-color,#ffc107);color:#1c1c1c}.fixture-access .room-group[data-highlight="true"]{outline:3px solid var(--primary-color,#aacaab);outline-offset:2px}.room-tags{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden}.room-tags .room-tag{position:absolute;display:inline-flex;align-items:center;gap:calc(var(--room-tag-size,30px)*.2);box-sizing:border-box;height:var(--room-tag-size,30px);min-height:var(--room-tag-size,30px);padding:0 calc(var(--room-tag-size,30px)*.37) 0 calc(var(--room-tag-size,30px)*.27);border-radius:calc(var(--room-tag-size,30px)/2);transform:translate(-50%,6px);white-space:nowrap;pointer-events:auto;color:var(--primary-text-color,#edf2eb);background:color-mix(in srgb,var(--card-background-color,#202923) 92%,transparent);border:1px solid var(--divider-color,#536258);box-shadow:0 2px 8px #0006;font:500 calc(var(--room-tag-size,30px)*.4)/1 system-ui}.room-tags .room-tag::before{content:"";position:absolute;inset:-8px -4px}.room-tags .room-tag svg{width:calc(var(--room-tag-size,30px)*.47);height:calc(var(--room-tag-size,30px)*.47);flex-shrink:0;opacity:.8}.room-tags .room-tag[data-manual="true"]{transform:translate(-50%,-50%)}.room-tags .room-tag .room-tag-count{display:grid;place-items:center;min-width:calc(var(--room-tag-size,30px)*.6);height:calc(var(--room-tag-size,30px)*.6);padding:0 calc(var(--room-tag-size,30px)*.17);box-sizing:border-box;border-radius:calc(var(--room-tag-size,30px)*.3);background:var(--state-light-active-color,#ffc107);color:#1c1c1c;font-size:calc(var(--room-tag-size,30px)*.37);font-weight:600}.room-tags .room-tag:hover{background:var(--card-background-color,#202923);border-color:var(--primary-color,#aacaab)}.room-nav{position:absolute;top:12px;left:50%;z-index:3;transform:translateX(-50%);display:flex;align-items:center;justify-content:center;gap:8px}.room-nav .room-step{display:grid;place-items:center;flex-shrink:0;box-sizing:border-box;width:44px;height:44px;min-height:44px;padding:0;color:var(--primary-text-color,#edf2eb);background:var(--card-background-color,#202923);box-shadow:0 2px 8px #0006}.room-nav .room-step svg{width:22px;height:22px}.room-back{display:inline-flex;align-items:center;gap:6px;box-sizing:border-box;height:44px;min-height:44px;flex:0 0 auto;width:clamp(150px,calc(100cqw - 404px),260px);justify-content:center;padding:0 16px 0 10px;white-space:nowrap;color:var(--text-primary-color,#101715);background:var(--primary-color,#aacaab);border-color:var(--primary-color,#aacaab);box-shadow:0 2px 8px #0006;font:600 14px/1 system-ui}.room-back svg{width:20px;height:20px;flex-shrink:0}.room-back>span:not(.room-back-name){flex-shrink:0}.room-back .room-back-name{min-width:0;overflow:hidden;text-overflow:ellipsis;font-weight:400;opacity:.85;padding-left:8px;border-left:1px solid color-mix(in srgb,currentColor 35%,transparent)}.room-back .room-back-name:empty{display:none}@container card-root (max-width:520px){.card-controls{right:8px;left:8px;bottom:max(8px,env(safe-area-inset-bottom));gap:6px}.card-controls>button{width:44px;height:44px;min-height:44px;padding:10px;position:relative;background:color-mix(in srgb,var(--card-background-color,#202923) 88%,transparent);box-shadow:0 1px 4px #0004;border-color:color-mix(in srgb,var(--divider-color,#536258) 60%,transparent)}.card-controls>button::before,.light-panel-toggle::before{content:"";position:absolute;inset:-5px}.card-controls>button svg,.light-panel-toggle svg{width:20px;height:20px;opacity:.85}.panel-toggles{top:8px;left:8px;gap:6px}.floor-switch{height:44px;padding:3px;background:color-mix(in srgb,var(--card-background-color,#202923) 88%,transparent);box-shadow:0 1px 4px #0004;border-color:color-mix(in srgb,var(--divider-color,#536258) 60%,transparent)}.floor-switch button{height:36px;min-width:44px;padding:0 12px;font:500 14px system-ui}.card-top.card-top:has(header[hidden]){top:8px;right:8px}.daylight-switch{height:44px;padding:3px;background:color-mix(in srgb,var(--card-background-color,#202923) 88%,transparent);box-shadow:0 1px 4px #0004;border-color:color-mix(in srgb,var(--divider-color,#536258) 60%,transparent)}.daylight-switch button{width:40px;height:36px}.daylight-switch svg{width:20px;height:20px}.daylight-thumb{top:3px;left:3px;width:40px;height:36px}.daylight-switch[data-mode="day"] .daylight-thumb{transform:translateX(40px)}.daylight-switch[data-mode="night"] .daylight-thumb{transform:translateX(80px)}.light-panel{top:60px;left:8px;bottom:62px;width:min(300px,calc(100% - 16px));max-height:calc(100% - 122px)}.room-nav{top:60px;gap:6px}.room-nav .room-step{width:44px;height:44px;min-height:44px;position:relative;background:color-mix(in srgb,var(--card-background-color,#202923) 88%,transparent);box-shadow:0 1px 4px #0004;border-color:color-mix(in srgb,var(--divider-color,#536258) 60%,transparent)}.room-nav .room-step::before{content:"";position:absolute;inset:-5px}.room-nav .room-step svg{width:22px;height:22px}.room-back{height:44px;min-height:44px;width:clamp(130px,calc(100cqw - 132px),200px);padding:0 12px 0 8px;font:600 12px/1 system-ui;box-shadow:0 1px 4px #0004}.room-back svg{width:16px;height:16px}}.reload-menu{position:absolute;bottom:calc(100% + 8px);z-index:4;display:flex;flex-direction:column;gap:2px;box-sizing:border-box;width:min(250px,calc(100vw - 32px));padding:6px;color:var(--primary-text-color,#edf2eb);background:var(--ha-card-background,var(--card-background-color,#202923));-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:1px solid var(--divider-color,#536258);border-radius:12px;box-shadow:0 4px 16px #0008;pointer-events:auto}.reload-menu button{display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:8px 12px;border:0;border-radius:8px;text-align:left;color:inherit;font:500 15px/1.25 system-ui}.reload-menu button:hover{background:color-mix(in srgb,var(--primary-text-color,#edf2eb) 8%,transparent)}.reload-menu button:disabled{opacity:.5;cursor:wait}.reload-menu svg{flex-shrink:0;width:22px;height:22px}.reload-menu small{display:block;margin-top:2px;color:var(--secondary-text-color,#aebbb2);font:400 12px/1.3 system-ui}.model-refresh[aria-expanded="true"]{color:var(--text-primary-color,#101715);background:var(--primary-color,#aacaab);border-color:var(--primary-color,#aacaab)}.undo-toast{position:absolute;left:50%;bottom:72px;z-index:6;transform:translateX(-50%);display:flex;align-items:center;gap:4px;box-sizing:border-box;max-width:calc(100% - 24px);padding:4px 4px 4px 16px;border-radius:10px;color:var(--card-background-color,#fff);background:var(--primary-text-color,#212121);box-shadow:0 4px 16px #0006;font:500 14px/1.3 system-ui;animation:undo-in .2s cubic-bezier(.2,.7,.2,1)}.undo-toast span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.undo-toast button{flex-shrink:0;min-height:40px;padding:0 14px;border:0;color:inherit;font-weight:700;text-decoration:underline;text-underline-offset:3px}.undo-toast button:hover{background:color-mix(in srgb,currentColor 12%,transparent)}@keyframes undo-in{from{opacity:0;transform:translate(-50%,8px)}}@media(prefers-reduced-motion:reduce){.undo-toast{animation:none}}.fixture-access button{--activity:var(--info-color,#039be5)}.marker-activity,.marker-activity-tip{display:none}.fixture-access button[data-activity="true"]{border-color:var(--activity);animation:activity-ring 1.8s ease-out infinite}@keyframes activity-ring{0%{box-shadow:0 2px 8px #0006,0 0 0 0 color-mix(in srgb,var(--activity) 70%,transparent)}100%{box-shadow:0 2px 8px #0006,0 0 0 12px transparent}}.fixture-access button[data-activity="true"] .marker-activity{position:absolute;top:-6px;left:calc(100% - 12px);display:flex;align-items:center;justify-content:center;gap:2px;box-sizing:border-box;min-width:18px;height:18px;padding:0 3px;border-radius:9px;background:var(--activity);color:#fff;box-shadow:0 0 0 2px var(--card-background-color,#202923);font:700 10px/1 system-ui;pointer-events:none}.marker-activity ha-state-icon{display:flex;width:12px;height:12px;--mdc-icon-size:12px;--marker-glyph-size:12px;color:#fff}@media(hover:hover){.fixture-access button[data-activity="true"]:hover .marker-activity-tip,.fixture-access button[data-activity="true"]:focus-visible .marker-activity-tip{position:absolute;bottom:calc(100% + 10px);left:50%;z-index:3;display:flex;flex-direction:column;gap:4px;transform:translateX(-50%);box-sizing:border-box;width:max-content;max-width:240px;padding:7px 10px;border-radius:8px;background:var(--card-background-color,#202923);border:1px solid var(--divider-color,#536258);box-shadow:0 4px 12px #0007;color:var(--primary-text-color,#edf2eb);font:500 12px/1.3 system-ui;text-align:left;white-space:nowrap;pointer-events:none}}.marker-activity-tip span{display:flex;align-items:center;gap:6px;overflow:hidden;text-overflow:ellipsis}.marker-activity-tip span::before{content:"";flex-shrink:0;width:6px;height:6px;border-radius:50%;background:var(--activity);animation:activity-pulse 1.6s ease-in-out infinite}@keyframes activity-pulse{0%,100%{opacity:1}50%{opacity:.35}}@media(prefers-reduced-motion:reduce){.fixture-access button[data-activity="true"],.marker-activity-tip span::before{animation:none!important}}.fixture-access button[data-holding="true"]::after{content:"";position:absolute;inset:-5px;border-radius:50%;pointer-events:none;background:conic-gradient(var(--primary-color,#aacaab) calc(var(--hold,0)*1turn),transparent 0);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 3px));mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 3px));animation:hold-fill var(--hold-ms,350ms) linear forwards}@property --hold{syntax:"<number>";inherits:false;initial-value:0}@keyframes hold-fill{to{--hold:1}}.undo-toast[data-tip] span{white-space:normal}.undo-tip{display:block;margin-top:2px;font:400 12px/1.3 system-ui;opacity:.75}@media(prefers-reduced-motion:reduce){.fixture-access button[data-holding="true"]::after{animation:none;--hold:1}}.icon-leaders{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}.icon-leaders line{stroke:var(--primary-text-color,#edf2eb);stroke-opacity:.8;stroke-width:1.5}.icon-leaders circle{fill:var(--primary-text-color,#edf2eb);stroke:#0009;stroke-width:1}.house-summary{position:absolute;top:12px;left:50%;z-index:3;transform:translateX(-50%);display:flex;align-items:center;gap:2px;box-sizing:border-box;max-width:calc(100% - 24px);height:44px;padding:3px;overflow-x:auto;scrollbar-width:none;border-radius:22px;color:var(--primary-text-color,#edf2eb);background:var(--card-background-color,#202923);border:1px solid var(--divider-color,#536258);box-shadow:0 2px 8px #0006}.house-summary::-webkit-scrollbar{display:none}.house-summary button{display:inline-flex;flex-shrink:0;align-items:center;gap:6px;height:36px;min-height:0;padding:0 12px 0 10px;border:0;border-radius:18px;font:500 13px/1 system-ui;white-space:nowrap;color:inherit}.house-summary button:hover{background:color-mix(in srgb,currentColor 10%,transparent)}.house-summary svg{flex-shrink:0;width:18px;height:18px;fill:currentColor;opacity:.7}.house-summary button[data-tone] svg{fill:var(--tone);opacity:1}.house-summary[data-below]{left:12px;right:12px;transform:none;max-width:none;width:fit-content;margin:0 auto;height:auto;flex-wrap:wrap;justify-content:center;border-radius:16px}@container card-root (max-width:520px){.house-summary[data-below]{left:8px;right:8px}.house-summary button{height:30px;padding:0 9px 0 7px;font-size:12.5px;gap:5px}.house-summary svg{width:16px;height:16px}}:host([adjusting]) .fixture-access,:host([adjusting]) .room-tags,:host([adjusting]) .house-summary,:host([adjusting]) .panel-toggles,:host([adjusting]) .card-controls,:host([adjusting]) .room-nav,:host([adjusting]) .daylight-switch,:host([adjusting]) .light-panel{display:none!important}:host([adjusting]) .scene{outline:2px solid var(--primary-color,#aacaab);outline-offset:-2px}.adjust-bar{position:absolute;left:50%;bottom:max(12px,env(safe-area-inset-bottom));z-index:6;transform:translateX(-50%);display:flex;flex-direction:column;gap:10px;box-sizing:border-box;width:min(560px,calc(100% - 24px));padding:12px;border-radius:14px;color:var(--primary-text-color,#edf2eb);background:var(--ha-card-background,var(--card-background-color,#202923));border:1px solid var(--divider-color,#536258);box-shadow:0 4px 16px #0008;font:14px/1.35 system-ui}.adjust-bar p{display:flex;flex-direction:column;gap:2px;margin:0;text-align:center}.adjust-bar p span{color:var(--secondary-text-color,#aebbb2);font-size:13px}.adjust-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}.adjust-actions button{flex:1 1 auto;min-height:44px;padding:0 14px;font:500 14px system-ui;white-space:nowrap}.adjust-actions .primary{color:var(--text-primary-color,#101715);background:var(--primary-color,#aacaab);border-color:var(--primary-color,#aacaab)}.notice-toast{padding:12px 16px}</style><ha-card><div class="card-top"><header hidden></header><div class="daylight-switch" role="radiogroup" aria-label="Time of day" hidden></div></div><div class="scene"><div class="backdrop" aria-hidden="true"></div><div class="message" role="status"><span>Connecting to 3D Rooms…</span><progress max="1" aria-label="Download progress" hidden></progress><button hidden>Retry</button></div></div></ha-card>`, this._container = this.shadowRoot.querySelector(".scene"), this._message = this.shadowRoot.querySelector(".message"), this._daylightSwitch = this.shadowRoot.querySelector(".daylight-switch");
		let e = document.createElement("span");
		e.className = "daylight-thumb", this._daylightSwitch.append(e);
		for (let [e, { label: t, hint: n, icon: r }] of Object.entries(Q)) {
			let i = document.createElement("button");
			i.type = "button", i.dataset.mode = e, i.setAttribute("role", "radio"), i.setAttribute("aria-label", t), i.title = `${t} — ${n}`, i.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${r}</svg>`, i.onclick = () => this._chooseDaylight(e), this._daylightSwitch.append(i);
		}
		this._daylightSwitch.onkeydown = (e) => {
			let t = {
				ArrowRight: 1,
				ArrowDown: 1,
				ArrowLeft: -1,
				ArrowUp: -1
			}[e.key];
			if (!t) return;
			e.preventDefault();
			let n = Vt(this._daylightSwitch.value, t);
			this._chooseDaylight(n), this._daylightSwitch.querySelector(`[data-mode="${n}"]`)?.focus();
		}, this._showDaylightMode("auto"), this.shadowRoot.querySelector(".message button").onclick = () => this._load(), this._controls = document.createElement("div"), this._controls.className = "card-controls", this._container.append(this._controls), this._refresh = document.createElement("button"), this._refresh.type = "button", this._refresh.className = "model-refresh", this._refresh.setAttribute("aria-label", "More"), this._refresh.setAttribute("aria-haspopup", "menu"), this._refresh.setAttribute("aria-expanded", "false"), this._refresh.title = "More: reload, edit", this._refresh.innerHTML = "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><circle cx=\"5\" cy=\"12\" r=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/><circle cx=\"19\" cy=\"12\" r=\"2\"/></svg>", this._refresh.onclick = () => this._setReloadMenu(!this._reloadMenu), this._resetCamera = document.createElement("button"), this._resetCamera.type = "button", this._resetCamera.className = "camera-reset", this._resetCamera.setAttribute("aria-label", "Reset view"), this._resetCamera.title = "Reset view to the card framing", this._resetCamera.innerHTML = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 11.5 12 4l9 7.5M5.5 9.5V20h4.5v-6h4v6h4.5V9.5\"/></svg>", this._resetCamera.hidden = !0, this._resetCamera.onclick = () => this._resetView(), this._moveCamera = document.createElement("button"), this._moveCamera.type = "button", this._moveCamera.className = "camera-move", this._moveCamera.setAttribute("aria-label", "Move camera"), this._moveCamera.innerHTML = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3v18M3 12h18M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5\"/></svg>", this._moveCamera.hidden = !0, this._moveCamera.onclick = () => this._setCameraMovement(!this._cameraFree), this._floorPlanButton = document.createElement("button"), this._floorPlanButton.type = "button", this._floorPlanButton.className = "camera-floor-plan", this._floorPlanButton.setAttribute("aria-label", "Floor plan"), this._floorPlanButton.setAttribute("aria-pressed", "false"), this._floorPlanButton.innerHTML = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><path d=\"M3 12h7M10 3v13M14 12h7M14 12v9\"/></svg>", this._floorPlanButton.hidden = !0, this._floorPlanButton.onclick = () => this._setFloorPlan(!this._floorPlan), this._editButton = document.createElement("button"), this._editButton.type = "button", this._editButton.className = "card-edit", this._editButton.hidden = !0, this._editButton.setAttribute("aria-label", "Edit in 3D Rooms"), this._editButton.title = "Edit in 3D Rooms — opens this view in the editor in a new tab", this._editButton.innerHTML = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z\"/></svg>", this._editButton.onclick = () => this._openEditor(), this._controls.append(this._refresh, this._resetCamera, this._moveCamera, this._floorPlanButton), this._panelToggles = document.createElement("div"), this._panelToggles.className = "panel-toggles", this._panelButtons = {}, this._panelIcons = {};
		for (let [e, t, n, r] of [[
			"light",
			"Room lights",
			"Room lights — switch each room's lights",
			"<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M9 21h6v-1H9v1Zm3-19a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2Zm2.85 11.1-.85.6V16h-4v-2.3l-.85-.6a5 5 0 1 1 5.7 0Z\"/></svg>"
		], [
			"shade",
			"Room shades",
			"Room shades — open or close each room's shades",
			"<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M3 3h18v2H3zm1 4h16v2H4zm0 4h16v2H4zm0 4h16v2H4zm7 4h2v3h-2z\"/></svg>"
		]]) {
			let i = document.createElement("button");
			i.type = "button", i.className = "light-panel-toggle", i.dataset.panel = e, i.setAttribute("aria-label", t), i.setAttribute("aria-expanded", "false"), i.title = n, i.innerHTML = `${r}<span class="toggle-label">${e === "shade" ? "Shades" : "Lights"}</span>`, this._panelIcons[e] = r, i.hidden = !0, i.onclick = () => this._setLightPanel(this._panelKind === e ? null : e), this._panelButtons[e] = i, this._panelToggles.append(i);
		}
		this._lightsButton = this._panelButtons.light, this._container.append(this._panelToggles), this._summary = document.createElement("div"), this._summary.className = "house-summary", this._summary.setAttribute("role", "group"), this._summary.setAttribute("aria-label", "At a glance"), this._summary.hidden = !0, this._container.append(this._summary), this._roomTags = document.createElement("div"), this._roomTags.className = "room-tags", this._container.append(this._roomTags), this._roomBack = document.createElement("button"), this._roomBack.type = "button", this._roomBack.className = "room-back", this._roomBack.hidden = !0, this._roomBack.title = "Back to the house view", this._roomBack.innerHTML = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m15 5-7 7 7 7\"/></svg><span>House</span><span class=\"room-back-name\"></span>", this._roomBack.onclick = () => this._exitRoom(), this._roomNav = document.createElement("div"), this._roomNav.className = "room-nav", this._roomNav.hidden = !0, this._roomSteps = [-1, 1].map((e) => {
			let t = document.createElement("button");
			return t.type = "button", t.className = "room-step", t.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${e < 0 ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7"}"/></svg>`, t.onclick = () => this._stepRoom(e), t;
		}), this._roomNav.append(this._roomSteps[0], this._roomBack, this._roomSteps[1]), this._container.append(this._roomNav), this._switchOverlay = document.createElement("div"), this._switchOverlay.className = "switching", this._switchOverlay.hidden = !0, this._switchOverlay.setAttribute("role", "status"), this._switchOverlay.innerHTML = "<span class=\"switching-pill\"><span class=\"spinner\" aria-hidden=\"true\"></span><span class=\"switching-label\"></span></span>", this._switchLabel = this._switchOverlay.querySelector(".switching-label"), this._container.append(this._switchOverlay), this._switching = !1, this._focus = null, this._panelKind = null, this._panelRooms = {
			light: [],
			shade: []
		}, this._expandedRooms = /* @__PURE__ */ new Set(), this._pendingRooms = /* @__PURE__ */ new Set(), this._floorSwitch = document.createElement("div"), this._floorSwitch.className = "floor-switch", this._floorSwitch.setAttribute("role", "group"), this._floorSwitch.setAttribute("aria-label", "Floor"), this._floorSwitch.hidden = !0, this._controls.append(this._floorSwitch), this._floors = [], this._views = [], this._floor = null, this._generation = 0, this._groupChips = /* @__PURE__ */ new Map(), this._openGroup = null, this._groupOf = /* @__PURE__ */ new Map(), this.shadowRoot.addEventListener("keydown", (e) => {
			if (e.key === "Escape" && this._adjusting) this._endAdjust("cancel");
			else if (e.key === "Escape" && this._focus && !this._openGroup && !e.composedPath().some((e) => e?.tagName === "DIALOG" || e?.classList?.contains("light-panel"))) this._exitRoom();
			else if (this._focus && (e.key === "ArrowLeft" || e.key === "ArrowRight") && !e.composedPath().some((e) => e?.tagName === "DIALOG" || e?.tagName === "INPUT" || e?.tagName === "SELECT" || e?.classList?.contains("light-panel"))) e.preventDefault(), this._stepRoom(e.key === "ArrowLeft" ? -1 : 1);
			else if (e.key === "Escape" && this._openGroup) {
				let e = this._openGroup;
				this._openGroup = null, this._positionButtons(), this._groupChips.get(e)?.focus();
			}
		}), this._container.addEventListener("pointerdown", (e) => {
			this._openGroup && !e.composedPath().some((e) => e?.dataset?.control || e?.dataset?.groupRoom) && (this._openGroup = null, this._positionButtons());
		});
	}
	setConfig(t) {
		if (t.saved_view !== void 0 && (typeof t.saved_view != "string" || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(t.saved_view))) throw Error("Choose a valid saved view ID.");
		if ((this._sourceConfig?.model !== t.model || this._sourceConfig?.saved_view !== t.saved_view) && (this._floor = null), this._sourceConfig = { ...t }, t.model !== void 0 && (typeof t.model != "string" || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(t.model))) throw Error("Choose a model ID, for example kitchen.");
		if (t.height !== void 0 && t.height !== "auto" && (!Number.isFinite(t.height) || t.height < 180 || t.height > 1600)) throw Error("Card height must be auto or between 180 and 1600 pixels.");
		if (t.zoom !== void 0 && (!Number.isFinite(t.zoom) || t.zoom < .01 || t.zoom > 100)) throw Error("Zoom must be between 0.01 and 100.");
		for (let e of ["tilt", "heading"]) if (t[e] !== void 0 && !Number.isFinite(t[e])) throw Error(`${e} must be a number.`);
		if (t.tilt !== void 0 && (t.tilt < 0 || t.tilt > 180)) throw Error("Tilt must be between 0 and 180 degrees.");
		if (t.view !== void 0 && !["front", "floor"].includes(t.view)) throw Error("Choose front or floor view.");
		if (Oe(t), t.quality !== void 0 && !ee.includes(t.quality)) throw Error("Quality must be auto, high or low.");
		for (let e of [
			"floor_selector",
			"camera_controls",
			"light_panel",
			"shade_panel",
			"summary",
			"spread_icons",
			"room_focus",
			"edit_button",
			"floor_plan_button"
		]) if (t[e] !== void 0 && typeof t[e] != "boolean") throw Error(`${e} must be true or false.`);
		let n = t.camera === void 0 ? void 0 : g(t.camera);
		if (n && (t.view || "front") === "floor" != (n.projection === "orthographic")) throw Error("Saved camera projection must match the selected view.");
		this._config = {
			height: 500,
			view: "front",
			tilt: n?.tilt ?? (t.view === "floor" ? 0 : 28),
			heading: n?.heading ?? 0,
			zoom: n?.referenceZoom ?? 1,
			interactive: !1,
			...t,
			markers: e(t.markers),
			camera: n
		}, this._cameraFree = !!this._config.interactive, this._cameraTouched = !1, this._restoreFloorPlan(), this._applyHeight(), this._applyBackdrop();
		let r = this.shadowRoot.querySelector("header");
		r.textContent = t.title || "", r.hidden = !t.title || t.show_title === !1, this._reload = !0, this._hass && this.isConnected && this._load();
	}
	set hass(e) {
		this._hass = e, this._robotDialog?.update(), this._config && this.isConnected && (this._reload || !this._view ? this._loading ? this._earlyStates() : this._load() : this._states());
	}
	getCardSize() {
		return Math.ceil(((typeof this._config?.height == "number" ? this._config.height : 500) + o(this._config?.markers, this._model?.controls)) / 50);
	}
	getGridOptions() {
		return {
			columns: 12,
			rows: Math.ceil(((typeof this._config?.height == "number" ? this._config.height : 500) + o(this._config?.markers, this._model?.controls)) / 56),
			min_columns: 6,
			min_rows: 4
		};
	}
	_applyHeight() {
		this._layout ? this._layout.update() : this._container.style.height = this._config?.height === "auto" ? "500px" : `${this._config?.height || 500}px`;
	}
	connectedCallback() {
		this._outsidePanel ??= (e) => {
			let t = e.composedPath();
			this._reloadMenu && !t.includes(this._reloadMenu) && !t.includes(this._refresh) && this._setReloadMenu(!1), this._lightPanel && (t.includes(this._lightPanel) || t.includes(this._panelToggles) || t.some((e) => e instanceof HTMLDialogElement) || this._setLightPanel(null));
		}, document.addEventListener("pointerdown", this._outsidePanel, !0), this._layout = new Te(this), this._applyHeight(), this.hasAttribute("fill-page") && (this._refresh.setAttribute("aria-label", "Reload"), this._refresh.setAttribute("aria-haspopup", "menu"), this._refresh.setAttribute("aria-expanded", "false"), this._refresh.title = "Reload the page or the room model"), this._hass && this._config && this._load();
	}
	disconnectedCallback() {
		this._robotDialog?.close(), document.removeEventListener("pointerdown", this._outsidePanel, !0), this._setReloadMenu(!1), this._layout?.dispose(), this._layout = null, ++this._generation, clearInterval(this._keepalive), this._unsubModels?.(), this._unsubModels = null, this._unsubEffects?.(), this._unsubEffects = null, this._dialog?.remove(), clearTimeout(this._coverTimer), clearTimeout(this._warmTimer), this._switching = !1, this._switchOverlay.hidden = !0, this._view?.dispose(), this._view = null, this._loading = !1;
	}
	async _refreshModels() {
		!this._loading && this._hass && (Ce(this._hass), a(M(this._hass)), await this._load({ fresh: !0 }));
	}
	_setReloadMenu(e) {
		if (!e) {
			if (!this._reloadMenu) return;
			this._reloadMenu.remove(), this._reloadMenu = null, this._refresh.setAttribute("aria-expanded", "false");
			return;
		}
		if (this._reloadMenu) return;
		let t = document.createElement("div");
		t.className = "reload-menu", t.setAttribute("role", "menu"), t.setAttribute("aria-label", "More");
		let n = [
			...this.hasAttribute("fill-page") ? [[
				"reload-page",
				"Reload page",
				"Start the page again",
				"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M21 12a9 9 0 1 1-2.64-6.36L21 8\"/><path d=\"M21 3v5h-5\"/></svg>",
				() => location.reload()
			]] : [],
			[
				"reload-model",
				"Reload model",
				"Download the room again and keep it on this device",
				"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m12 3 8 4.5v9L12 21l-8-4.5v-9Z\"/><path d=\"M12 12v9M12 12l8-4.5M12 12 4 7.5\"/></svg>",
				() => this._refreshModels()
			],
			...this._view?.model && !this._preview ? [[
				"adjust-view",
				"Adjust view",
				"Move, zoom and tilt the house, and keep it on this device",
				"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20\"/></svg>",
				() => this._startAdjust()
			]] : [],
			...this._editButton.hidden ? [] : [[
				"edit-view",
				"Edit in 3D Rooms",
				"Change this view in the sidebar",
				"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z\"/></svg>",
				() => this._openEditor()
			]]
		];
		for (let [e, r, i, a, o] of n) {
			let n = document.createElement("button");
			n.type = "button", n.className = e, n.setAttribute("role", "menuitem"), n.innerHTML = `${a}<span>${r}<small>${i}</small></span>`, e === "reload-model" && (n.disabled = this._loading), n.onclick = () => {
				this._setReloadMenu(!1), o();
			}, t.append(n);
		}
		t.addEventListener("keydown", (e) => {
			let n = [...t.querySelectorAll("button:not(:disabled)")], r = n.indexOf(this.shadowRoot.activeElement);
			e.key === "Escape" ? (e.preventDefault(), this._setReloadMenu(!1), this._refresh.focus()) : (e.key === "ArrowDown" || e.key === "ArrowUp") && (e.preventDefault(), n[(r + (e.key === "ArrowDown" ? 1 : -1) + n.length) % n.length]?.focus());
		});
		let r = this._controls.clientWidth - (this._refresh.offsetLeft + this._refresh.offsetWidth);
		t.style.right = `${Math.max(0, r)}px`, this._controls.append(t), this._reloadMenu = t, this._refresh.setAttribute("aria-expanded", "true"), t.querySelector("button:not(:disabled)")?.focus({ preventScroll: !0 });
	}
	async _load({ fresh: t = !1 } = {}) {
		if (!this._config || !this._hass) return;
		let n = ++this._generation;
		Rt().catch(() => {}), this._loading = !0, this._contextLost = !1, this._refresh.disabled = !this.hasAttribute("fill-page"), this._container.setAttribute("aria-busy", "true"), this._reload = !1, clearInterval(this._keepalive), (this._config.preview_url || this._config.addon) && (this._unsubModels?.(), this._unsubModels = null), this._changedDuringLoad = !1, this._message.hidden = !1, this._message.querySelector("span").textContent = "Downloading your room…", this._message.querySelector("button").hidden = !0, this._message.querySelector("button").textContent = "Retry";
		let r = this._message.querySelector("progress");
		r.hidden = !0, this._view || this._showLoadingPreview(this._cachedThumbnail());
		let i = !1, a = !1;
		try {
			if (this._sourceConfig?.saved_view) {
				let t = await this._hass.callWS({
					type: "three_d_rooms/request",
					operation: "components",
					data: {
						id: this._sourceConfig.saved_view,
						include_thumbnails: !0
					}
				});
				if (n !== this._generation) return;
				let r = t.find((e) => e.id === this._sourceConfig.saved_view)?.thumbnail;
				r && (this._cacheThumbnail(r), this._view || this._showLoadingPreview(r)), this._config = z(this._sourceConfig, t), this._config.markers = e(this._config.markers), this._restoreFloorPlan(), this._cameraTouched || (this._cameraFree = !!this._config.interactive), this._applyHeight();
				let i = this.shadowRoot.querySelector("header");
				i.textContent = this._config.title || "", i.hidden = !this._config.title || this._config.show_title === !1;
			}
			if (!this._config.model) {
				this._message.querySelector("span").textContent = "Choose a room in the visual editor.";
				return;
			}
			let a = await jt(this._hass, this._config, location.origin);
			if (n !== this._generation) return;
			a.session && (document.cookie = `ingress_session=${a.session};path=/api/hassio_ingress/;SameSite=Strict${location.protocol === "https:" ? ";Secure" : ""}`);
			let { model: o, configured: s, floors: c, views: l, sceneURL: u, layers: d, release: f, assetCache: p } = await a.load({
				fresh: t,
				onModel: (e) => {
					n === this._generation && this._showEarlyPanels(e);
				},
				onProgress: (e) => {
					if (n !== this._generation) return;
					let { value: t, text: i } = Ie(e);
					this._message.querySelector("span").textContent = i, r.hidden = t === void 0, t !== void 0 && (r.value = t);
				}
			});
			if (n !== this._generation || (i = !0, r.hidden = !0, this._message.querySelector("span").textContent = "Preparing the 3D view…", await new Promise(requestAnimationFrame), n !== this._generation)) {
				f?.();
				return;
			}
			let { SceneView: m } = await Rt();
			if (n !== this._generation) {
				f?.();
				return;
			}
			if (this._view?.dispose(), this._view = new m(this._container, (e) => this._pick(e), {
				markers: !1,
				interactive: this._cameraFree,
				...this._cameraOptions(),
				cameraModel: this._config.model,
				deviceCamera: (e, t, n) => mt(globalThis.localStorage, this._deviceCameraKey(e, t, n)),
				frameInset: () => this._toolbarInset(),
				quality: this._config.quality,
				transparent: De(this._background()),
				groundShadow: L(this._config),
				onRender: () => this._positionButtons(),
				onRoomDoubleTap: (e) => {
					this._config?.room_focus !== !1 && this._focusRoom(e);
				},
				onContextLost: () => {
					this._contextLost = !0, this._message.querySelector("span").textContent = "The 3D view stopped. Your browser paused its graphics.", this._message.querySelector("button").textContent = "Reload 3D view", this._message.querySelector("button").hidden = !1, this._message.hidden = !1;
				},
				onContextRestored: () => {
					this._contextLost && (this._contextLost = !1, this._message.hidden = !0);
				},
				onCameraChange: ({ source: e }) => {
					e !== "orbit" || this._cameraMoved || (this._cameraMoved = !0, this._syncCameraButtons());
				}
			}), o.houseView) for (let e of this.shadowRoot.querySelectorAll("dialog")) e.remove();
			let h = this._view;
			try {
				await (d ? h.loadLayers(o, d) : h.load(o, u, p));
			} finally {
				f?.();
			}
			if (n !== this._generation) return;
			this._views = l || [], this._floors = c || [];
			let g = Et(this._views, s || o, this._floor);
			if (g !== o && !h.setHouseView(g) && (g = o), this._floor && g.id !== this._floor && (this._floor = null), this._model = g, this._earlyModel = null, this._focus = null, this._cameraMoved = !1, this._syncFloorSwitch(), this._syncCameraButtons(), this._previewStates = /* @__PURE__ */ new Map(), this._buildAccess(), this._syncRoomTags(), this._preview = a.preview, this._signature = null, this._states(), this._syncDaylightSwitch(), this._syncEditButton(), this._message.hidden = !0, this._hideLoadingPreview(), this._warmViews(), !this._preview && !this._config.addon && !this._unsubModels && this._hass.connection?.subscribeEvents) {
				let e = await $e(this._hass.connection, () => this._modelsEvent());
				!this.isConnected || this._unsubModels ? e() : this._unsubModels = e;
			}
			if (n !== this._generation) return;
			this._watchLightEffects(), a.session && (this._keepalive = setInterval(async () => {
				if (!document.hidden && this.isConnected) try {
					await this._hass.callWS({
						type: "supervisor/api",
						endpoint: "/ingress/validate_session",
						method: "post",
						data: { session: a.session }
					});
				} catch {
					this._load();
				}
			}, 6e4));
		} catch (e) {
			if (n !== this._generation) return;
			i && !t && !this._config.preview_url ? (console.warn("3D Rooms: reloading the room after an error", e), a = !0) : (r.hidden = !0, this._message.querySelector("span").textContent = e.message || "Could not display this model.", this._message.querySelector("button").hidden = !1, this._message.hidden = !1);
		} finally {
			n === this._generation && (this._loading = !1, this._refresh.disabled = !1, this._container.setAttribute("aria-busy", "false"), this._recheckAfterLoad());
		}
		a && await this._refreshModels();
	}
	_thumbnailKey() {
		return `three-d-rooms:thumbnail:${this._sourceConfig?.saved_view}`;
	}
	_cachedThumbnail() {
		if (this._sourceConfig?.saved_view) try {
			return localStorage.getItem(this._thumbnailKey()) || void 0;
		} catch {
			return;
		}
	}
	_cacheThumbnail(e) {
		try {
			e.length <= 15e4 && localStorage.getItem(this._thumbnailKey()) !== e && localStorage.setItem(this._thumbnailKey(), e);
		} catch {}
	}
	_showLoadingPreview(e) {
		if (!e?.startsWith("data:image/jpeg;base64,")) return;
		let t = this._container.querySelector(".loading-preview");
		t || (t = document.createElement("img"), t.className = "loading-preview", t.alt = "", t.setAttribute("aria-hidden", "true"), this._container.prepend(t)), t.classList.remove("fading"), t.getAttribute("src") !== e && (t.src = e), this._message.classList.add("over-preview");
	}
	_hideLoadingPreview() {
		this._message.classList.remove("over-preview");
		let e = this._container.querySelector(".loading-preview");
		e && (e.classList.add("fading"), setTimeout(() => e.remove(), 320));
	}
	async _watchLightEffects() {
		if (!(this._unsubEffects || this._effectsPending || this._preview || this._config?.addon || !this._hass?.connection?.subscribeEvents)) {
			this._effectsPending = !0;
			try {
				let e = await this._hass.connection.subscribeEvents((e) => {
					this._lightEffectCalled(e?.data), this._vacuumAreasCalled(e?.data);
				}, "call_service");
				!this.isConnected || this._unsubEffects ? e() : this._unsubEffects = e;
			} catch {} finally {
				this._effectsPending = !1;
			}
		}
	}
	_lightEffectCalled(e) {
		let t = e?.service_data?.effect;
		if (e?.domain !== "light" || e.service !== "turn_on" || typeof t != "string" || !this._model || !this._view) return;
		let n = [e.service_data.entity_id].flat().filter(Boolean);
		for (let e of this._model.controls) e.type === "light" && n.includes(this._model.bindings?.[e.id]) && this._view.triggerLightEffect(e.id, t);
	}
	_vacuumAreasCalled(e) {
		if (e?.domain !== "vacuum" || e.service !== "clean_area" || !this._model || !this._view) return;
		let t = e.service_data || {}, n = [t.entity_id].flat().filter(Boolean), r = [t.cleaning_area_id].flat().filter(Boolean), i = ae(this._model, r);
		for (let e of this._model.controls) e.type === "vacuum" && n.includes(this._model.bindings?.[e.id]) && this._view.setVacuumRooms(e.id, i);
	}
	_modelsEvent() {
		this._loading ? this._changedDuringLoad = !0 : this._modelsChanged();
	}
	_recheckAfterLoad() {
		this._changedDuringLoad && this.isConnected && (this._changedDuringLoad = !1, this._modelsChanged());
	}
	_roomFocusable(e) {
		return !![...this._roomTags?.children || []].some((t) => t.dataset.room === e);
	}
	_toolbarInset() {
		let e = this._controls, t = this._container?.clientHeight || 0;
		return !e || !t || !e.offsetHeight ? 0 : Math.max(0, t - e.offsetTop + 8);
	}
	_syncFloorSwitch() {
		let e = this._floorSwitch;
		if (!e || (e.hidden = (this._floors?.length || 0) < 2 || this._config?.floor_selector === !1, e.hidden)) return;
		let t = JSON.stringify(this._floors);
		e.dataset.options !== t && (e.replaceChildren(...this._floors.map((e) => {
			let t = document.createElement("button");
			return t.type = "button", t.dataset.floor = e.id, t.textContent = e.floorId === null ? "All" : e.label, t.title = e.floorId === null ? "Whole house" : `Show ${e.label}`, e.floorId === null && t.setAttribute("aria-label", "Whole house"), t.onclick = () => this._selectFloor(e.id), t;
		})), e.dataset.options = t);
		for (let t of e.children) t.setAttribute("aria-pressed", String(!this._focus && t.dataset.floor === this._model?.id));
	}
	_selectFloor(e) {
		if (this._loading || e === this._model?.id && !this._focus) return;
		let t = this._views.find((t) => t.id === e);
		t && this._floors.some((t) => t.id === e) && this._showView(t, t.title, () => {
			this._floor = e === this._config?.model ? null : e, this._view?.setHouseView(t, { render: !1 }) ? (this._cameraMoved = !1, this._model = t, this._focus = null, this._buildAccess(), this._signature = null, this._states(), this._syncFloorSwitch(), this._syncRoomTags(), this._syncCameraButtons()) : this._load();
		});
	}
	_showView(e, t, n) {
		let r = this._view;
		if (!r || this._switching) return;
		if (r.isHouseViewPrepared?.(e) ?? !0) {
			n();
			return;
		}
		this._switching = !0, this._switchLabel.textContent = `Opening ${t || "view"}…`, this._switchOverlay.hidden = !1, this._container.setAttribute("aria-busy", "true");
		let i = this._generation;
		new Promise((e) => {
			requestAnimationFrame(() => e()), setTimeout(e, 150);
		}).then(() => r.prepareHouseView(e)).catch(() => {}).then(() => {
			this._switching = !1, this._switchOverlay.hidden = !0, this._loading || this._container.setAttribute("aria-busy", "false"), i === this._generation && r === this._view && !this._loading && n();
		});
	}
	_warmViews() {
		clearTimeout(this._warmTimer);
		let e = this._view, t = this._generation;
		if (!e?.prepareHouseView || !this._model?.houseView) return;
		let n = [this._model, ...this._views.filter((e) => e !== this._model)], r = [];
		if (this._config?.room_focus !== !1) for (let e of n) for (let { room: t } of y(e)) {
			let n = this._roomTarget(e, t);
			n && r.push(n);
		}
		this._config?.floor_selector !== !1 && r.push(...n);
		let i = async () => {
			if (t !== this._generation || e !== this._view) return;
			if (this._loading || this._switching || document.hidden) {
				this._warmTimer = setTimeout(i, 1e3);
				return;
			}
			let n = r.shift();
			n && (e.isHouseViewPrepared(n) || await e.prepareHouseView(n), this._warmTimer = setTimeout(i, 100));
		};
		this._warmTimer = setTimeout(i, 800);
	}
	_roomTarget(e, t) {
		let n = m(e, t), r = this._config?.markers?._rooms?.[t];
		return n && (r?.heading !== void 0 || r?.tilt !== void 0) && (n.focusFrame = {
			heading: r.heading,
			tilt: r.tilt
		}), n;
	}
	_focusRoom(e) {
		if (this._loading || !this._view || this._focus) return;
		let t = this._model, n = this._roomTarget(t, e);
		n && this._showView(n, n.title, () => {
			this._view.setHouseView(n, { render: !1 }) && (this._focus = {
				base: t,
				room: e
			}, this._showModel(n), this._roomBack.focus());
		});
	}
	_exitRoom() {
		let e = this._focus;
		e && !this._loading && this._view && this._showView(e.base, e.base.title, () => {
			this._view.setHouseView(e.base, { render: !1 }) ? (this._focus = null, this._showModel(e.base), this._roomTags.querySelector(`[data-room="${CSS.escape(e.room)}"]`)?.focus()) : this._load();
		});
	}
	_stepRoom(e) {
		let t = this._focus, n = t?.base.members || [];
		if (!t || this._loading || !this._view || n.length < 2) return;
		let r = n[(n.findIndex((e) => e.model === t.room) + e + n.length) % n.length].model, i = this._roomTarget(t.base, r);
		i && this._showView(i, i.title, () => {
			this._view.setHouseView(i, { render: !1 }) && (t.room = r, this._showModel(i));
		});
	}
	_showModel(e) {
		this._openGroup = null, this._cameraMoved = !1, this._model = e, this._buildAccess(), this._signature = null, this._states(), this._syncRoomTags(), this._syncCameraButtons(), this._syncFloorSwitch();
	}
	_syncRoomTags() {
		let e = this._config?.room_focus === !1 || !this._view ? [] : y(this._model), n = JSON.stringify(e);
		this._roomTags.dataset.rooms !== n && (this._roomTags.dataset.rooms = n, this._roomTags.replaceChildren(...e.map(({ room: e, title: t }) => {
			let n = document.createElement("button");
			return n.type = "button", n.className = "room-tag", n.dataset.room = e, n.hidden = !0, n.title = `Show ${t} on its own`, n.setAttribute("aria-label", `Show ${t} on its own`), n.innerHTML = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5\"/></svg><span class=\"room-tag-name\"></span><span class=\"room-tag-count\" hidden></span>", n.querySelector(".room-tag-name").textContent = t, this._wireRoomTag(n, e), n;
		}))), this._syncRoomTagStates();
		let r = !!this._focus;
		if (this._syncSummary(), this._roomBack.hidden = !r, this._roomNav.hidden = !r, r) {
			let e = this._focus.base.members, n = e.findIndex((e) => e.model === this._focus.room);
			this._roomSteps.forEach((r, i) => {
				let a = e[(n + (i ? 1 : -1) + e.length) % e.length], o = t(d(this._focus.base, a.model));
				r.hidden = e.length < 2, r.title = `${i ? "Next" : "Previous"} room · ${o}`, r.setAttribute("aria-label", r.title);
			});
			let r = this._model.title || "";
			this._roomBack.querySelector(".room-back-name").textContent = r, this._roomBack.setAttribute("aria-label", `Back to the house view from ${r}`);
		}
		this._positionRoomTags();
	}
	_roomLightsOf(e) {
		return q(this._model).find((t) => t.id === e && t.lights.length);
	}
	_wireRoomTag(e, t) {
		e.onclick = () => this._focusRoom(t);
		let n = (e) => this._view?.highlightRoom?.(e ? t : null);
		e.addEventListener("pointerenter", (e) => {
			e.pointerType !== "touch" && n(!0);
		}), e.addEventListener("pointerleave", () => n(!1)), e.addEventListener("focus", () => n(!0)), e.addEventListener("blur", () => n(!1));
	}
	_syncRoomTagStates() {
		let e = [...this._roomTags?.children || []];
		if (!e.length) return;
		let t = new Map(q(this._model).map((e) => [e.id, e])), n = this._lightStates || /* @__PURE__ */ new Map();
		for (let r of e) {
			let e = t.get(r.dataset.room), i = e ? J(e, n).on : 0, a = r.querySelector(".room-tag-count");
			r.dataset.active = String(i > 0), a && (a.hidden = i === 0, a.textContent = i, a.title = `${i} on`);
		}
	}
	_positionRoomTags() {
		let e = [...this._roomTags?.children || []];
		if (!e.length) return;
		let t = this._config?.markers?._rooms || {}, n = Object.fromEntries(Object.entries(t).filter(([, e]) => e.position).map(([e, t]) => [e, t.position])), r = new Map((this._view?.roomFrontPoints?.(n) || []).map((e) => [e.room, e])), i = this._container?.clientWidth || 0, a = Math.max(40, (this._controls?.offsetTop || this._container?.clientHeight || 0) - 44), o = [];
		for (let n of e) {
			let e = r.get(n.dataset.room), s = !!e?.visible && v(t[n.dataset.room]?.mode || "auto", e.exposure ?? 1, n.dataset.shown === "true");
			n.dataset.shown = String(s), n.dataset.manual = String(!!e?.manual);
			let c = this._groupChips?.get(n.dataset.room);
			if (n.hidden = !s || !!c && !c.hidden, !s) continue;
			let l = t[n.dataset.room]?.size ?? 30;
			n.style.setProperty("--room-tag-size", l + "px");
			let u = n.offsetWidth || 80, d = u / 2 + 8;
			o.push({
				tag: n,
				w: u,
				h: l,
				fixed: e.manual,
				offset: e.manual ? -l / 2 : 6,
				x: i > 2 * d ? Math.max(d, Math.min(i - d, e.x)) : e.x,
				y: Math.max(8, Math.min(a, e.y)) + (e.manual ? -l / 2 : 6)
			});
		}
		let s = _(o), c = this._container?.getBoundingClientRect?.(), l = [...c ? this.shadowRoot.querySelectorAll(".fixture-access button") : []].filter((e) => !e.hidden && e.offsetWidth).map((e) => {
			let t = e.getBoundingClientRect();
			return {
				left: t.left - c.left - 4,
				right: t.right - c.left + 4,
				top: t.top - c.top - 4,
				bottom: t.bottom - c.top + 4
			};
		}), u = i < 600 || !!globalThis.matchMedia?.("(pointer: coarse)").matches;
		o.forEach((e, t) => {
			if (e.fixed && !u) return;
			let n = e.x - e.w / 2, r = e.x + e.w / 2;
			for (let i = 0; i < 6; i++) {
				let i = s[t], o = l.find((t) => n < t.right && t.left < r && i < t.bottom && t.top < i + e.h);
				if (!o || o.bottom + e.h > a) break;
				s[t] = o.bottom;
			}
			l.push({
				left: n,
				right: r,
				top: s[t],
				bottom: s[t] + e.h
			});
		}), o.forEach((e, t) => {
			e.tag.style.left = e.x + "px", e.tag.style.top = Math.min(a, s[t] - e.offset) + "px";
		});
	}
	_editorURL() {
		let e = this._config?.model, t = this._sourceConfig?.saved_view;
		if (!e) return null;
		let n = new URLSearchParams({ model: e });
		t && (n.set("tab", "views"), n.set("saved_view", t));
		let r = B(n);
		if (!r.has("model")) return null;
		let i = `/three_d_rooms?${r}`;
		return this._hass?.hassUrl?.(i) ?? i;
	}
	_openEditor() {
		let e = this._editorURL();
		e && window.open(e, "_blank", "noopener");
	}
	_syncEditButton() {
		this._editButton.hidden = !(this._view && this._hass?.user?.is_admin && !this._preview && !this._config?.addon && this._config?.edit_button !== !1 && this._editorURL());
	}
	_syncCameraButtons() {
		let e = !!this._view && this._config?.camera_controls !== !1;
		this._moveCamera.hidden = !e, this._moveCamera.setAttribute("aria-pressed", String(!!this._cameraFree)), this._moveCamera.title = this._cameraFree ? "Camera movement on — drag to orbit, pinch or scroll to zoom. Click to lock." : "Camera locked. Click to allow moving the camera.", this._resetCamera.hidden = !e || !this._cameraFree && !this._cameraMoved;
		let t = this._floorPlanButton;
		t && (t.hidden = !this._view || this._config?.floor_plan_button === !1 || this._config?.view === "floor", t.setAttribute("aria-pressed", String(!!this._floorPlan)), t.title = this._floorPlan ? "Floor plan on — click to go back to the 3D view" : "Show the floor plan from above");
	}
	_cameraOptions() {
		let e = this._config || {};
		return this._floorPlan && e.view !== "floor" ? {
			mode: "floor",
			view: "floor",
			tilt: 0,
			heading: this._floorPlanHeading ?? e.heading ?? 0,
			zoom: 1,
			camera: void 0
		} : {
			mode: e.view,
			view: e.view,
			tilt: e.tilt,
			heading: e.heading,
			zoom: e.zoom ?? 1,
			camera: e.camera
		};
	}
	_savesFloorPlanOnView() {
		return !!this._sourceConfig?.saved_view && !this._config?.addon;
	}
	_floorPlanKey() {
		let e = this._sourceConfig || {}, t = e.saved_view || e.model;
		return t ? `three-d-rooms:floor-plan:${t}` : null;
	}
	_restoreFloorPlan() {
		if (this._floorPlan = !1, this._floorPlanHeading = void 0, this._config?.floor_plan_button === !1) return;
		let e;
		if (this._savesFloorPlanOnView()) e = this._config?.floorPlan;
		else try {
			let t = this._floorPlanKey();
			e = t && JSON.parse(localStorage.getItem(t));
		} catch {}
		e && typeof e == "object" && (this._floorPlan = !0, Number.isFinite(e.heading) && (this._floorPlanHeading = e.heading));
	}
	async _rememberFloorPlan() {
		let e = this._floorPlan ? { heading: Math.round(this._floorPlanHeading * 100) / 100 % 360 } : null;
		if (!this._savesFloorPlanOnView()) {
			try {
				let t = this._floorPlanKey();
				if (!t) return;
				e ? localStorage.setItem(t, JSON.stringify(e)) : localStorage.removeItem(t);
			} catch {}
			return;
		}
		if (this._preview || !this._hass?.callWS) return;
		let t = this._config, n = t.floorPlan;
		e ? t.floorPlan = e : delete t.floorPlan;
		try {
			await this._hass.callWS({
				type: "three_d_rooms/request",
				operation: "view-floor-plan",
				data: {
					id: this._sourceConfig.saved_view,
					floorPlan: e
				}
			});
		} catch (e) {
			if (t !== this._config) return;
			n ? t.floorPlan = n : delete t.floorPlan, this._restoreFloorPlan(), this._showFloorPlan(), this.shadowRoot.querySelector(".fixture-feedback")?.remove();
			let r = document.createElement("div");
			r.className = "fixture-feedback", r.setAttribute("role", "alert"), r.textContent = e?.message || "Could not save the floor plan for this view.", this._container?.append(r), setTimeout(() => r.remove(), 5e3);
		}
	}
	_viewHeading() {
		let e = this._view?.camera?.position, t = this._view?.orbit?.target, n = e && t ? e.x - t.x : 0, r = e && t ? e.z - t.z : 0;
		return Math.hypot(n, r) < 1e-6 ? this._config?.heading ?? 0 : (Math.atan2(n, r) * 180 / Math.PI + 360) % 360;
	}
	_setFloorPlan(e) {
		this._view?.model && this._config?.view !== "floor" && (this._floorPlan = !!e, this._floorPlan && (this._floorPlanHeading = this._viewHeading()), this._showFloorPlan(), this._rememberFloorPlan());
	}
	_showFloorPlan() {
		if (this._view?.model) {
			let { mode: e, ...t } = this._cameraOptions();
			Object.assign(this._view.options, t), this._view.setView(e), this._cameraMoved = !1;
		}
		this._syncCameraButtons();
	}
	_deviceCameraKey(e = this._view?.model, t, n) {
		let r = this._sourceConfig || {}, i = this._container?.getBoundingClientRect?.();
		return pt({
			card: r.saved_view || r.model,
			view: e && `${e.id}${e.focusRoom ? `:${e.focusRoom}` : ""}`,
			plan: n ?? this._view?.options?.mode === "floor",
			aspect: t ?? (i?.width || 1) / Math.max(i?.height || 1, 1)
		});
	}
	_hasDeviceCamera() {
		return !!mt(globalThis.localStorage, this._deviceCameraKey());
	}
	_startAdjust() {
		if (!this._view?.model || this._adjusting) return;
		this._adjusting = { wasFree: !!this._cameraFree }, this._setReloadMenu(!1), this._setLightPanel?.(null), this._view.setInteractive(!0), this.toggleAttribute("adjusting", !0);
		let e = document.createElement("div");
		e.className = "adjust-bar", e.setAttribute("role", "toolbar"), e.setAttribute("aria-label", "Adjust view"), e.innerHTML = `<p><strong>Adjust view</strong><span>${globalThis.matchMedia?.("(pointer: coarse)").matches ? "Drag to turn · pinch to zoom · two fingers to move" : "Drag to turn · scroll to zoom · right-drag to move"}</span></p><div class="adjust-actions"><button type="button" data-adjust="cancel">Cancel</button><button type="button" data-adjust="forget">Use the view's framing</button><button type="button" data-adjust="save" class="primary">Save for this device</button></div>`, e.querySelector("[data-adjust=\"forget\"]").hidden = !this._hasDeviceCamera();
		for (let t of e.querySelectorAll("[data-adjust]")) t.onclick = () => this._endAdjust(t.dataset.adjust);
		this._container.append(e), this._adjustBar = e, e.querySelector(".primary").focus({ preventScroll: !0 });
	}
	_endAdjust(e = "cancel") {
		if (!this._adjusting) return;
		let { wasFree: t } = this._adjusting, n = this._deviceCameraKey(), r;
		if (e === "save") {
			let e = this._view?.captureView?.()?.camera;
			r = ht(globalThis.localStorage, n, e) ? "View saved on this device" : "Could not save the view on this device";
		} else e === "forget" && (ht(globalThis.localStorage, n, void 0), r = "Back to the view's framing");
		this._adjusting = null, this._adjustBar?.remove(), this._adjustBar = null, this.toggleAttribute("adjusting", !1), this._view?.setInteractive(t), e !== "save" && this._view?.reset(), this._cameraMoved = !1, this._syncCameraButtons(), this._positionButtons?.(), r && this._notice(r);
	}
	_notice(e) {
		if (!this._container) return;
		clearTimeout(this._noticeTimer), this._noticeToast?.remove();
		let t = document.createElement("div");
		t.className = "undo-toast notice-toast", t.setAttribute("role", "status"), t.innerHTML = "<span></span>", t.querySelector("span").textContent = e, this._container.append(t), this._noticeToast = t, this._noticeTimer = setTimeout(() => t.remove(), 3e3);
	}
	_setCameraMovement(e) {
		this._cameraFree = !!e, this._cameraTouched = !0, this._view?.setInteractive(this._cameraFree), this._syncCameraButtons();
	}
	_resetView() {
		this._view && (this._view.reset(), this._cameraMoved = !1, this._syncCameraButtons());
	}
	_background() {
		return this._config?.background || "spotlight";
	}
	_applyBackdrop(e) {
		let t = this.shadowRoot.querySelector(".backdrop");
		if (!t || !this._config) return;
		let n = ke(Ae(this._model?.daylight?.mode, e ?? this._hass?.states?.[this._model?.daylight?.entity || "sun.sun"]));
		Pe(t, this._config, n);
	}
	_syncDaylightSwitch() {
		let e = this._model?.daylight;
		this._daylightSwitch.hidden = !e || !!this._preview, e && this._showDaylightMode(e.mode);
	}
	_showDaylightMode(e) {
		let t = this._daylightSwitch, n = Q[e] ? e : "auto";
		t.value = n, t.dataset && (t.dataset.mode = n);
		for (let e of t.querySelectorAll?.("button") || []) {
			let t = e.dataset.mode === n;
			e.setAttribute("aria-checked", String(t)), e.tabIndex = t ? 0 : -1;
		}
	}
	_chooseDaylight(e) {
		e !== this._daylightSwitch.value && this._setDaylight(e);
	}
	async _setDaylight(e) {
		let t = this._model?.daylight;
		if (!t || this._preview) return;
		let n = t.mode, r = (e) => {
			t.mode = e, this._showDaylightMode(e), this._signature = null, this._states();
		};
		r(e);
		try {
			t.mode = (await this._hass.callWS({
				type: "three_d_rooms/request",
				operation: "daylight",
				data: {
					model: this._model.id,
					mode: e,
					entity: t.entity
				}
			})).daylight.mode;
		} catch (e) {
			r(n), this.shadowRoot.querySelector(".fixture-feedback")?.remove();
			let t = document.createElement("div");
			t.className = "fixture-feedback", t.setAttribute("role", "alert"), t.textContent = e.message || "Could not save the time of day for this room.", this._container.append(t), setTimeout(() => t.remove(), 5e3);
		}
	}
	async _modelsChanged() {
		let t = this._generation;
		try {
			if (this._sourceConfig?.saved_view) {
				let n = await this._hass.callWS({
					type: "three_d_rooms/request",
					operation: "components"
				});
				if (t !== this._generation) return;
				let r = z(this._sourceConfig, n);
				r.markers = e(r.markers);
				let i = ({ floorPlan: e, ...t }) => JSON.stringify(t);
				if (i(r) !== i(this._config)) {
					this._load();
					return;
				}
				JSON.stringify(r.floorPlan) !== JSON.stringify(this._config.floorPlan) && (r.floorPlan ? this._config.floorPlan = r.floorPlan : delete this._config.floorPlan, this._restoreFloorPlan(), this._showFloorPlan());
			}
			let n = await this._hass.callWS({
				type: "three_d_rooms/request",
				operation: "models"
			}), r = this._focus?.base ?? this._model, i = n.find((e) => e.id === (r?.id ?? this._config?.model)), a = ({ daylight: e, ...t }) => JSON.stringify(t), o = (this._views?.length ? this._views : [r]).every((e) => {
				let t = n.find((t) => t.id === e?.id);
				return t && a(t) === a(e);
			});
			if (t === this._generation && i && r && o && a(i) === a(r) && !!i.daylight == !!r.daylight) {
				i.daylight && (r.daylight = this._model.daylight = i.daylight), this._syncDaylightSwitch(), this._signature = null, this._states();
				return;
			}
		} catch {}
		t === this._generation && this._load();
	}
	_buildAccess() {
		this._covered = /* @__PURE__ */ new Set(), this.shadowRoot.querySelector(".fixture-access")?.remove(), this.shadowRoot.querySelector(".fixture-tray")?.remove();
		let e = document.createElement("div");
		e.className = "fixture-access";
		let t = document.createElement("div");
		t.className = "fixture-tray";
		for (let r of this._model.controls) {
			if (r.hidden) continue;
			let i = b(this._model, r.id);
			if (r.lightGroupPrimary === !1 || i && i.height !== r.id || !this._preview && !this._model.bindings?.[r.id]) continue;
			let a = document.createElement("button"), o = i?.label || c(r, "light");
			a.dataset.control = r.id;
			let s = n(this._config.markers, r.id);
			a.style.setProperty("--marker-size", s.size + "px"), a.setAttribute("aria-label", r.type === "light" ? `Toggle ${o}. Hold, or press Shift+Enter, for more info.` : `Control ${o}`), a.title = r.type === "light" ? `${o}: click to toggle, hold for more info` : `${o}: value controls`;
			let l = C(s, r, !1), u = l || C(s, r, !0), d = document.createElement(r.type === "climate" && !u ? "span" : "ha-state-icon");
			r.type === "climate" && !u && (d.className = "fixture-ac-icon"), l && (d.icon = l), d.setAttribute("aria-hidden", "true"), d.innerHTML = Ft(r, l), d.dataset.glyph = l || "";
			let f = document.createElement("span");
			if (f.className = "fixture-state", f.setAttribute("aria-hidden", "true"), f.hidden = !s.show_label, a.append(d), s.placement === "tray") {
				let e = document.createElement("span");
				e.className = "fixture-name", e.textContent = o, a.append(e);
			}
			a.append(f);
			let p, m, h = !1, g = () => {
				clearTimeout(p), m = null, U(a, !1);
			};
			a.onpointerdown = (e) => {
				e.button === 0 && (h = !1, m = [e.clientX, e.clientY], a.setPointerCapture(e.pointerId), U(a, !0), p = setTimeout(() => {
					h = !0, U(a, !1), this._pick(r.id);
				}, 500));
			}, a.onpointermove = (e) => {
				m && Math.hypot(e.clientX - m[0], e.clientY - m[1]) > 8 && (h = !0, g());
			}, a.onpointerup = g, a.onpointercancel = () => {
				h = !0, g();
			}, a.onlostpointercapture = g, a.oncontextmenu = (e) => e.preventDefault(), a.onclick = () => {
				h || this._toggle(r.id), h = !1;
			}, a.setAttribute("aria-keyshortcuts", "Shift+Enter F2"), a.onkeydown = (e) => {
				(e.key === "F2" || e.shiftKey && e.key === "Enter") && (e.preventDefault(), this._pick(r.id));
			}, s.visible && (s.placement === "tray" ? t : e).append(a);
		}
		this._buildCustomEntities(e), this._container.append(e), this.shadowRoot.querySelector("ha-card").append(t), this._groupChips = /* @__PURE__ */ new Map(), this._openGroup = null, this._positionButtons(), this._buildLightPanel();
	}
	_buildCustomEntities(e) {
		let t = Object.entries(this._config?.markers?._entities || {});
		for (let [n, r] of t) {
			let t = w(r, this._config?.markers?._defaults);
			if (!t.visible) continue;
			let i = document.createElement("button");
			i.type = "button", i.dataset.custom = n, i.hidden = !0, i.style.setProperty("--marker-size", t.size + "px");
			let a = document.createElement("ha-state-icon");
			a.setAttribute("aria-hidden", "true");
			let o = C(t, {}, !1);
			o && (a.icon = o), a.innerHTML = `<svg viewBox="0 0 24 24">${o && T(o) || "<path d=\"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm-2 5h3v6h1.5v2h-5v-2H11v-4h-1Z\"/>"}</svg>`;
			let s = document.createElement("span");
			s.className = "fixture-state", s.setAttribute("aria-hidden", "true"), s.hidden = !t.show_state, i.append(a, s);
			let c, l, u = !1, d = () => {
				clearTimeout(c), l = null, U(i, !1);
			};
			i.onpointerdown = (e) => {
				e.button === 0 && (u = !1, l = [e.clientX, e.clientY], i.setPointerCapture(e.pointerId), U(i, !0), c = setTimeout(() => {
					u = !0, U(i, !1), this._moreInfo(t.entity);
				}, 500));
			}, i.onpointermove = (e) => {
				l && Math.hypot(e.clientX - l[0], e.clientY - l[1]) > 8 && (u = !0, d());
			}, i.onpointerup = d, i.onpointercancel = () => {
				u = !0, d();
			}, i.onlostpointercapture = d, i.oncontextmenu = (e) => e.preventDefault(), i.onclick = () => {
				u || this._tapCustom(n), u = !1;
			}, i.setAttribute("aria-keyshortcuts", "Shift+Enter F2"), i.onkeydown = (e) => {
				(e.key === "F2" || e.shiftKey && e.key === "Enter") && (e.preventDefault(), this._moreInfo(t.entity));
			}, e.append(i);
		}
	}
	_moreInfo(e) {
		!this._preview && e && (this._layout?.fullscreen ? document.exitFullscreen().then(() => this._moreInfo(e)).catch(() => {}) : this.dispatchEvent(new CustomEvent("hass-more-info", {
			detail: { entityId: e },
			bubbles: !0,
			composed: !0
		})));
	}
	async _tapCustom(e) {
		let t = this._config?.markers?._entities?.[e];
		if (!t || this._preview) return;
		let n = S(t.entity), r = this._hass?.states?.[t.entity];
		if (!n || !r) {
			this._moreInfo(t.entity);
			return;
		}
		if (r.state === "unavailable" || (this._pendingCustom ||= /* @__PURE__ */ new Set(), this._pendingCustom.has(e))) return;
		this._pendingCustom.add(e);
		let i = this.shadowRoot.querySelector(`[data-custom="${e}"]`);
		i?.setAttribute("aria-busy", "true"), this.shadowRoot.querySelector(".fixture-feedback")?.remove();
		try {
			await this._hass.callService(n.domain, n.service, { entity_id: t.entity });
		} catch {
			let e = document.createElement("div");
			e.className = "fixture-feedback", e.setAttribute("role", "alert"), e.textContent = "Could not change it. Try again.", this._container.append(e);
		} finally {
			this._pendingCustom.delete(e), i?.removeAttribute("aria-busy");
		}
	}
	_positionCustomEntities(e, t) {
		let n = this._config?.markers?._entities || {}, i = this._model?.houseView ? this._view?.roomBoxes : null;
		for (let a of this.shadowRoot.querySelectorAll("[data-custom]")) {
			let o = n[a.dataset.custom];
			if (!o) continue;
			let s = w(o, this._config?.markers?._defaults), c = this._view?.screenPoint?.(s.position);
			if (a.hidden = !c?.visible || !oe(s, i), a.hidden) continue;
			let l = r(c, {
				size: s.size,
				show_label: s.show_state
			}, e, t);
			a.style.left = l.left + "px", a.style.top = l.top + "px";
		}
	}
	_customEntityStates() {
		let e = this._config?.markers?._entities || {}, t = this._hass?.formatEntityState?.bind(this._hass);
		for (let n of this.shadowRoot.querySelectorAll("[data-custom]")) {
			let r = e[n.dataset.custom];
			if (!r) continue;
			let i = this._preview ? void 0 : this._hass?.states?.[r.entity], a = this._preview ? {
				active: !1,
				unavailable: !1,
				badge: "",
				description: r.entity
			} : re(i, t), o = r.name || i?.attributes?.friendly_name || r.entity, s = S(r.entity);
			n.dataset.active = String(a.active), n.dataset.unavailable = String(a.unavailable), n.title = `${o}: ${a.description}${s ? " · hold for more info" : ""}`, n.setAttribute("aria-label", `${o}, ${a.description}${s ? ". Tap to switch, hold for more info." : ". Opens more info."}`);
			let c = n.querySelector("ha-state-icon");
			if (c && (c.dataset.defaultIcon = ne(r.entity, i)), c && i) {
				c.hass = this._hass, c.stateObj = i;
				let e = C(r, {}, a.active);
				c.icon !== e && (c.icon = e);
			}
			n.querySelector(".fixture-state").textContent = a.badge;
		}
	}
	_isShade(e) {
		if (this._view?.fixtures) return !!this._view.fixtures.get(e.id)?.coverNodes?.some((e) => e?.userData?.rollerShade);
		let t = this._knownShades();
		if (t) return t.includes(e.id);
		let n = this._hass?.states?.[this._panelModel?.bindings?.[e.id]];
		return It.has(n?.attributes?.device_class);
	}
	_shadeKey(e = this._panelModel) {
		return e?.id && `three-d-rooms:shades:${e.id}`;
	}
	_knownShades() {
		try {
			let e = JSON.parse(localStorage.getItem(this._shadeKey()));
			return Array.isArray(e) ? e : null;
		} catch {
			return null;
		}
	}
	_rememberShades(e) {
		try {
			let t = this._shadeKey();
			t && localStorage.setItem(t, JSON.stringify(e));
		} catch {}
	}
	get _panelModel() {
		return this._model || this._earlyModel;
	}
	_showEarlyPanels({ model: e, configured: t, views: n }) {
		this._view || this._preview || !e?.controls || (this._earlyModel = Et(n || [], t || e, this._floor), this._earlyStates(), this._buildLightPanel());
	}
	_earlyStates() {
		let e = this._earlyModel;
		if (!e || this._view || !this._hass) return;
		let t = /* @__PURE__ */ new Map();
		for (let n of e.controls) {
			let r = this._hass.states?.[e.bindings?.[n.id]];
			n.type === "cover" ? t.set(n.id, f(r)) : n.type === "light" && t.set(n.id, {
				on: r?.state === "on",
				unavailable: !r || ["unavailable", "unknown"].includes(r.state)
			});
		}
		this._lightStates = t, this._syncLightPanel(t);
	}
	_panelWords(e = this._panelKind || "light") {
		return e === "shade" ? {
			title: "Shades",
			noun: "shades",
			one: "shade",
			on: "open",
			turnOn: "Open",
			turnOff: "Close"
		} : {
			title: "Lights",
			noun: "lights",
			one: "light",
			on: "on",
			turnOn: "Turn on",
			turnOff: "Turn off"
		};
	}
	_buildLightPanel() {
		if (this._panelRooms = {
			light: this._config?.light_panel === !1 ? [] : q(this._panelModel),
			shade: this._config?.shade_panel === !1 ? [] : Mt(this._panelModel, "shade", (e) => this._isShade(e))
		}, this._view?.fixtures && this._model && !this._model.focusRoom && this._rememberShades(this._panelRooms.shade.flatMap((e) => e.lights.map((e) => e.id))), !this._preview) for (let e of Object.keys(this._panelRooms)) this._panelRooms[e] = this._panelRooms[e].map((e) => ({
			...e,
			lights: e.lights.filter((e) => e.entityId)
		})).filter((e) => e.lights.length);
		for (let [e, t] of Object.entries(this._panelButtons)) t.hidden = !this._panelRooms[e].length;
		this._panelKind && !this._panelRooms[this._panelKind].length && (this._panelKind = null);
		let e = this._panelKind;
		this._rooms = this._panelRooms[e || "light"];
		for (let [t, n] of Object.entries(this._panelButtons)) n.setAttribute("aria-expanded", String(t === e));
		if (this._lightPanel?.remove(), this._lightPanel = null, !e) return;
		let t = this._panelWords(e);
		for (let t of this._rooms) this._rooms.length === 1 && this._expandedRooms.add(e + t.id);
		let n = document.createElement("div");
		n.className = "light-panel", n.dataset.kind = e, n.setAttribute("role", "dialog"), n.setAttribute("aria-label", `Room ${t.noun}`), n.innerHTML = "<h2><span></span><span class=\"light-room-count\"></span><button type=\"button\" role=\"switch\" data-room-switch=\"\"></button><button type=\"button\" class=\"panel-close\">×</button></h2><div class=\"light-rooms\"></div>", n.querySelector("h2 span").textContent = t.title, n.querySelector("h2 [role=\"switch\"]").setAttribute("aria-label", `All ${t.noun}`), n.querySelector(".panel-close").setAttribute("aria-label", `Close ${t.noun}`), n.querySelector("h2 [role=\"switch\"]").onclick = async () => {
			await this._confirmAllLights() && this._toggleRoomLights("");
		}, n.querySelector(".panel-close").onclick = () => this._setLightPanel(null), n.onkeydown = (t) => {
			t.key === "Escape" && (t.stopPropagation(), this._setLightPanel(null), this._panelButtons[e].focus());
		};
		let r = n.querySelector(".light-rooms");
		for (let n of this._rooms) {
			let i = document.createElement("section");
			i.className = "light-room", i.dataset.room = n.id;
			let a = document.createElement("div");
			a.className = "light-room-head";
			let o = document.createElement("button");
			o.type = "button", o.innerHTML = "<svg class=\"light-chevron\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m9 5 7 7-7 7\"/></svg><span class=\"light-room-title\"></span><span class=\"light-room-count\"></span>", o.querySelector(".light-room-title").textContent = n.title;
			let s = e + n.id, c = this._expandedRooms.has(s);
			o.setAttribute("aria-expanded", String(c));
			let l = document.createElement("button");
			l.type = "button", l.setAttribute("role", "switch"), l.dataset.roomSwitch = n.id, l.setAttribute("aria-label", `All ${n.title} ${t.noun}`), l.onclick = () => this._toggleRoomLights(n.id), a.append(o, l);
			let u = document.createElement("ul");
			u.className = "light-list", u.hidden = !c, o.onclick = () => {
				let e = u.hidden;
				u.hidden = !e, o.setAttribute("aria-expanded", String(e)), e ? this._expandedRooms.add(s) : this._expandedRooms.delete(s);
			};
			for (let t of n.lights) {
				let n = document.createElement("li");
				n.className = "light-row", n.dataset.light = t.id;
				let r = document.createElement("button");
				r.type = "button", r.title = `${t.label}: details`;
				let i = document.createElement("ha-state-icon");
				i.setAttribute("aria-hidden", "true"), i.innerHTML = this._panelIcons[e];
				let a = document.createElement("span");
				a.className = "light-name", a.textContent = t.label, r.append(i, a), r.onclick = () => this._pick(t.id);
				let o = document.createElement("button");
				if (o.type = "button", o.setAttribute("role", "switch"), o.setAttribute("aria-label", t.label), o.onclick = () => e === "shade" ? this._toggleShade(t.id) : this._toggle(t.id), n.append(r, o), e === "shade") {
					let e = document.createElement("span");
					e.className = "light-position", a.after(e);
				} else if (t.entityId?.startsWith("light.")) {
					let e = document.createElement("input");
					e.type = "range", e.className = "light-dim", e.min = "1", e.max = "100", e.setAttribute("aria-label", `${t.label} brightness`), e.onchange = () => this._setBrightness(t, Number(e.value)), n.append(e);
				}
				let s = (e) => {
					for (let n of this.shadowRoot.querySelectorAll("[data-control]")) n.dataset.control === t.id && (n.dataset.highlight = String(e));
					let n = this._groupOf?.get(t.id);
					n && this._groupChips.get(n) && (this._groupChips.get(n).dataset.highlight = String(e));
				};
				n.onpointerenter = () => s(!0), n.onpointerleave = () => s(!1), n.addEventListener("focusin", () => s(!0)), n.addEventListener("focusout", () => s(!1)), u.append(n);
			}
			i.append(a, u), r.append(i);
		}
		this._lightPanel = n, this._container.append(n), this._syncLightPanel();
	}
	_confirmAllLights() {
		let { on: e, available: t } = J(Y(this._rooms || []), this._lightStates || /* @__PURE__ */ new Map()), n = e === 0, r = this._panelWords(), i = (e) => e === 1 ? r.one : r.noun;
		this._dialog?.remove();
		let a = document.createElement("dialog");
		return this._dialog = a, a.className = "confirm-all-lights", a.innerHTML = "<form method=\"dialog\"><h2></h2><p></p><div style=\"display:flex;gap:8px;justify-content:flex-end;margin-top:16px\"><button value=\"cancel\" autofocus>Cancel</button><button value=\"ok\" class=\"confirm\"></button></div></form>", a.querySelector("h2").textContent = `${n ? r.turnOn : r.turnOff} all ${r.noun}?`, a.querySelector("p").textContent = n ? `This will ${r.turnOn.toLowerCase()} ${t} ${i(t)} in ${this._rooms.length === 1 ? this._rooms[0].title : "every room shown"}. Hidden devices are not changed.` : `This will ${r.turnOff.toLowerCase()} the ${e} ${i(e)} that ${e === 1 ? "is" : "are"} ${r.on}. Hidden devices are not changed.`, a.querySelector(".confirm").textContent = n ? `${r.turnOn} all` : `${r.turnOff} all`, this.shadowRoot.append(a), new Promise((e) => {
			a.addEventListener("close", () => {
				e(a.returnValue === "ok"), a.remove();
			}), a.showModal();
		});
	}
	_setLightPanel(e) {
		this._panelKind = e === !0 ? "light" : e || null, this._buildLightPanel();
	}
	_syncLightPanel(e = this._lightStates) {
		let t = this._lightPanel;
		if (!t || !e) return;
		let n = this._panelWords(), r = K[this._panelKind || "light"].isOn, i = Y(this._rooms), a = J(i, e), o = t.querySelector("h2 [role=\"switch\"]");
		t.querySelector("h2 .light-room-count").textContent = a.available ? `${a.on} ${n.on}` : "", o.setAttribute("aria-checked", String(a.on > 0)), o.disabled = !a.available || !this._preview && !i.entities.length, o.title = `${a.on ? n.turnOff : n.turnOn} all ${n.noun}`;
		for (let i of this._rooms) {
			let a = [...t.querySelectorAll("[data-room]")].find((e) => e.dataset.room === i.id);
			if (!a) continue;
			let o = J(i, e);
			a.querySelector(".light-room-count").textContent = o.available ? `${o.on} of ${o.available} ${n.on}` : i.entities.length || this._preview ? "Unavailable" : "Not connected";
			let s = a.querySelector("[data-room-switch]");
			s.setAttribute("aria-checked", String(o.on > 0)), s.disabled = !o.available || !this._preview && !i.entities.length, s.title = `${o.on ? n.turnOff : n.turnOn} all ${i.title} ${n.noun}`;
			for (let t of a.querySelectorAll("[data-light]")) {
				let n = i.lights.find((e) => e.id === t.dataset.light), a = e.get(n.id) || {}, o = this._hass?.states?.[n.entityId], s = !!a.unavailable || !n.entityId, c = !s && r(a);
				t.dataset.on = String(c), t.dataset.unavailable = String(s);
				let l = t.querySelector("[role=\"switch\"]");
				l.setAttribute("aria-checked", String(c)), l.disabled = s && !this._preview;
				let u = t.querySelector(".light-dim");
				if (u) {
					let e = o?.attributes?.supported_color_modes || [];
					u.hidden = !c || !!o && e.length > 0 && e.every((e) => e === "onoff"), document.activeElement !== u && this.shadowRoot.activeElement !== u && (u.value = String(Math.max(1, Math.round((a.brightness ?? 255) / 255 * 100))));
				}
				let d = t.querySelector(".light-position");
				if (d) {
					let e = a.position ?? a.motionPosition;
					d.textContent = s || typeof e != "number" ? "" : e <= 0 ? "Closed" : e >= 100 ? "Open" : `${Math.round(e)}% open`;
				}
				let f = t.querySelector("ha-state-icon");
				f && o && (f.hass = this._hass, f.stateObj = o);
			}
		}
	}
	async _toggleShade(e) {
		let t = this._lightStates || /* @__PURE__ */ new Map(), n = K.shade.isOn(t.get(e) || {}), r = this._panelModel;
		if (this._preview) {
			this._previewStates.set(e, { position: n ? 0 : 100 }), this._states();
			return;
		}
		let i = r.bindings[e], a = this._hass.states?.[i];
		if (!i?.startsWith("cover.") || !a || ["unavailable", "unknown"].includes(a.state)) return;
		let o = X([i], this._hass.states);
		try {
			await this._hass.callService("cover", n ? "close_cover" : "open_cover", { entity_id: i }), this._offerUndo(() => `${c(r.controls.find((t) => t.id === e) || {}, "Shade")} ${n ? "closed" : "opened"}`, o);
		} catch {
			this._panelFeedback("Could not move the shade. Try again.");
		}
	}
	async _setBrightness(e, t) {
		if (this._preview) {
			let n = this._previewStates.get(e.id) || { on: !0 };
			this._previewStates.set(e.id, {
				...n,
				on: !0,
				brightness: Math.round(t / 100 * 255)
			}), this._states();
		} else try {
			await this._hass.callService("light", "turn_on", {
				entity_id: e.entityId,
				brightness_pct: t
			});
		} catch {
			this._panelFeedback(`Could not dim ${e.label}. Try again.`);
		}
	}
	_offerUndo(e, t, { holdTip: n = !1 } = {}) {
		if (t?.length && this._container) try {
			if (typeof e == "function" && (e = e()), clearTimeout(this._undoTimer), this._undoToast?.remove(), !t?.length) return;
			let r = document.createElement("div");
			if (r.className = "undo-toast", r.setAttribute("role", "status"), r.innerHTML = "<span></span><button type=\"button\">Undo</button>", r.querySelector("span").textContent = e, n && rt(globalThis.localStorage)) {
				let e = document.createElement("small");
				e.className = "undo-tip", e.textContent = "Tip: hold an icon for its details", r.querySelector("span").append(e), r.dataset.tip = "true";
			}
			let i = () => {
				clearTimeout(this._undoTimer), r.remove(), this._undoToast === r && (this._undoToast = null);
			};
			r.querySelector("button").onclick = async () => {
				i();
				try {
					await Promise.all(Pt(t).map((e) => this._hass.callService(...e)));
				} catch {
					this._panelFeedback("Could not undo. Try again.");
				}
			}, this._undoToast = r, this._container.append(r), this._undoTimer = setTimeout(i, 6e3);
		} catch {
			this._undoToast = null;
		}
	}
	_panelFeedback(e) {
		this.shadowRoot.querySelector(".fixture-feedback")?.remove();
		let t = document.createElement("div");
		t.className = "fixture-feedback", t.setAttribute("role", "alert"), t.textContent = e, this._container.append(t), setTimeout(() => t.remove(), 5e3);
	}
	async _toggleRoomLights(e, t) {
		let n = t || (e === "" ? this._rooms?.length && Y(this._rooms) : this._rooms?.find((t) => t.id === e));
		if (!n || this._pendingRooms.has(e)) return;
		let r = this._lightStates || /* @__PURE__ */ new Map(), i = this._panelWords(n.kind);
		if (this._preview) {
			let e = J(n, r).on === 0;
			for (let t of n.lights) {
				if (n.kind === "shade") {
					this._previewStates.set(t.id, { position: e ? 100 : 0 });
					continue;
				}
				let r = this._model.controls.find((e) => e.id === t.id), i = this._previewStates.get(t.id) || {
					on: !0,
					brightness: 255,
					rgb: E(r?.color || "#fff0d4")
				};
				this._previewStates.set(t.id, {
					...i,
					on: e
				});
			}
			this._states();
			return;
		}
		let { calls: a, turnOn: o } = Nt(n, r, this._hass.states);
		if (!a.length) return;
		let s = X(a.flatMap(([, , e]) => e.entity_id), this._hass.states);
		this._pendingRooms.add(e);
		let c = [...this._lightPanel?.querySelectorAll("[data-room-switch]") || []].find((t) => t.dataset.roomSwitch === e);
		c?.setAttribute("aria-busy", "true"), this.shadowRoot.querySelector(".fixture-feedback")?.remove();
		try {
			await Promise.all(a.map((e) => this._hass.callService(...e))), this._offerUndo(() => {
				let t = s.length;
				return `${t === 1 ? n.lights.find((e) => this._panelModel?.bindings?.[e.id] === s[0].entityId)?.label || `1 ${i.one}` : `${e ? `${n.title} ` : ""}${t} ${i.noun}`} ${o ? n.kind === "shade" ? "opened" : "turned on" : n.kind === "shade" ? "closed" : "turned off"}`;
			}, s);
		} catch {
			this._panelFeedback(e ? `Could not change the ${n.title} ${i.noun}. Try again.` : `Could not change the ${i.noun}. Try again.`);
		} finally {
			this._pendingRooms.delete(e), c?.removeAttribute("aria-busy");
		}
	}
	_scheduleCoverCheck() {
		clearTimeout(this._coverTimer), !this._model?.houseView || this._model.focusRoom ? this._covered?.size && (this._covered = /* @__PURE__ */ new Set()) : this._coverTimer = setTimeout(() => this._checkCovered(), 150);
	}
	_checkCovered() {
		if (!this._view?.coveredMarkers || !this._model) return;
		let e = [];
		for (let t of this.shadowRoot.querySelectorAll("[data-control]")) {
			let r = t.dataset.control, i = n(this._config?.markers, r);
			if (i.placement === "tray" || !i.visible) continue;
			let a = this._model.controls.find((e) => e.id === r)?.sourceModel;
			a && e.push({
				id: r,
				room: a,
				offset: i.offset
			});
		}
		let t;
		try {
			t = this._view.coveredMarkers(e);
		} catch {
			t = /* @__PURE__ */ new Set();
		}
		let r = (e) => [...e].sort().join("|");
		r(t) !== r(this._covered || /* @__PURE__ */ new Set()) && (this._covered = t, this._positionButtons(!0));
	}
	_positionButtons(e = !1) {
		let t = this._container.clientWidth, i = this._container.clientHeight, a = [];
		for (let e of this.shadowRoot.querySelectorAll("[data-control]")) {
			let o = n(this._config?.markers, e.dataset.control);
			if (o.placement === "tray") {
				e.hidden = !o.visible;
				continue;
			}
			let s = this._view?.fixtureScreenPosition(e.dataset.control, o.offset);
			if (e.hidden = !o.visible || !s?.visible || !!this._covered?.has(e.dataset.control), !s) continue;
			let c = r(s, o, t, i);
			e.style.left = c.left + "px", e.style.top = c.top + "px", e.hidden || a.push({
				id: e.dataset.control,
				room: this._model?.controls.find((t) => t.id === e.dataset.control)?.sourceModel,
				x: c.left + o.size / 2,
				y: c.top + o.size / 2,
				size: o.size,
				button: e
			});
		}
		this._groupIcons(a, t, i), this._positionCustomEntities(t, i), this._spreadIcons(), this._summaryWidth !== t && (this._summaryWidth = t, this._placeSummary()), this._positionRoomTags(), e || this._scheduleCoverCheck();
	}
	_spreadIcons() {
		let e = this.shadowRoot.querySelector(".fixture-access");
		if (!e) return;
		let t = [...e.querySelectorAll("button[data-control], button[data-custom]")];
		for (let e of t) e.style.translate = "";
		let n = this._config?.spread_icons === !1 ? [] : t.filter((e) => !e.hidden && e.style.left), r = n.map((e) => {
			let t = e.offsetWidth || 32;
			return {
				x: parseFloat(e.style.left) + t / 2,
				y: parseFloat(e.style.top) + t / 2,
				r: t / 2
			};
		}), i = it(r), a = e.querySelector(".icon-leaders"), o = [];
		i.forEach(({ dx: e, dy: t }, i) => {
			if (Math.hypot(e, t) < 2) return;
			n[i].style.translate = `${e}px ${t}px`;
			let { x: a, y: s } = r[i];
			o.push(`<line x1="${a}" y1="${s}" x2="${a + e}" y2="${s + t}"/><circle cx="${a}" cy="${s}" r="3.5"/>`);
		}), o.length ? (a || (a = document.createElementNS("http://www.w3.org/2000/svg", "svg"), a.setAttribute("class", "icon-leaders"), a.setAttribute("aria-hidden", "true"), e.prepend(a)), a.innerHTML = o.join("")) : a?.remove();
	}
	_placeSummary() {
		let e = this._summary;
		if (!e || e.hidden || !this._container) return;
		delete e.dataset.below, e.style.top = "", e.style.marginTop = "";
		let t = e.getBoundingClientRect(), n = this._container.getBoundingClientRect(), r = 0;
		for (let e of [this._panelToggles, this.shadowRoot.querySelector(".daylight-switch")]) if (e && !e.hidden && e.offsetParent) for (let i of e.matches(".panel-toggles") ? e.children : [e]) {
			if (i.hidden) continue;
			let e = i.getBoundingClientRect();
			e.left < t.right && e.right > t.left && e.top < t.bottom && e.bottom > t.top && (r = Math.max(r, e.bottom - n.top));
		}
		r && (e.dataset.below = "", e.style.marginTop = "0px", e.style.top = `${Math.round(r + 8)}px`);
	}
	_syncSummary() {
		let e = this._summary;
		if (!e) return;
		let t = this._config?.summary === !1 || this._preview || this._focus || !this._model || !this._hass ? [] : dt(this._model, this._hass.states);
		e.hidden = !t.length;
		let n = JSON.stringify(t);
		if (e.dataset.key === n) return this._placeSummary();
		e.dataset.key = n, e.replaceChildren(...t.map((e) => {
			let t = document.createElement("button");
			t.type = "button", t.dataset.kind = e.kind, e.tone && (t.dataset.tone = e.tone), t.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${Bt(e)}</svg><span></span>`, t.querySelector("span").textContent = e.text;
			let n = e.kind === "light";
			return t.title = n ? "Show the lights of each room" : e.ids.length === 1 ? "Open its details" : e.text, t.onclick = () => {
				n ? this._panelButtons?.light?.hidden || this._setLightPanel("light") : e.ids.length === 1 && this._pick(e.ids[0]);
			}, t;
		})), this._placeSummary();
	}
	_groupIcons(e, n, r) {
		this._groupChips ||= /* @__PURE__ */ new Map();
		let i = .9, a = new Set(this._model?.houseView && !this._model.focusRoom ? (this._model.members || []).filter((e) => e.groupIcons).map((e) => e.model) : []), o = a.size > 0;
		e = e.filter((e) => a.has(e.room));
		let s = this._openGroup, c = o ? Re(e, {
			open: new Set(s ? [s] : []),
			overlap: i
		}) : [];
		s && !(o && ze(e, s, i)) && (this._openGroup = null), this._groupOf = /* @__PURE__ */ new Map();
		let l = /* @__PURE__ */ new Set();
		for (let n of c) {
			l.add(n.room);
			for (let t of n.ids) {
				this._groupOf.set(t, n.room);
				let r = e.find((e) => e.id === t);
				r && (r.button.hidden = !0);
			}
			let r = this._groupChips.get(n.room);
			r || (r = document.createElement("button"), r.type = "button", r.className = "room-group", r.dataset.groupRoom = n.room, r.onclick = () => {
				this._roomFocusable(n.room) ? this._focusRoom(n.room) : (this._openGroup = this._openGroup === n.room ? null : n.room, this._positionButtons(), this._openGroup && [...this.shadowRoot.querySelectorAll(".fixture-access [data-control]")].find((e) => !e.hidden && this._model?.controls.find((t) => t.id === e.dataset.control)?.sourceModel === n.room)?.focus());
			}, this.shadowRoot.querySelector(".fixture-access")?.append(r), this._groupChips.set(n.room, r));
			let i = this._model.controls.filter((e) => n.ids.includes(e.id)).filter((e) => this.shadowRoot.querySelector(`.fixture-access [data-control="${CSS.escape(e.id)}"]`)?.dataset.active === "true").length, a = t(this._model.controls.find((e) => e.sourceModel === n.room)?.roomTitle || "Room");
			r.hidden = !1, r.style.left = n.x + "px", r.style.top = n.y + "px", r.dataset.active = String(i > 0), r.innerHTML = "<span class=\"group-name\"></span><span class=\"group-count\"></span>", r.querySelector(".group-name").textContent = a, r.querySelector(".group-count").textContent = n.ids.length, r.setAttribute("aria-label", `${a}: ${n.ids.length} devices${i ? `, ${i} on` : ""}. ${this._roomFocusable(n.room) ? "Open the room" : "Show them"}`), r.title = `${a} — ${n.ids.length} devices${i ? `, ${i} on` : ""}`;
		}
		for (let [e, t] of this._groupChips) l.has(e) || (t.hidden = !0);
	}
	async _toggle(e) {
		let t = this._panelModel, n = t?.controls.find((t) => t.id === e);
		if (!n || n.hidden) return;
		if (n.type === "button") {
			await this._pressPreset(n);
			return;
		}
		if ((n.type ?? "light") !== "light") {
			this._pick(e);
			return;
		}
		if (this._preview) {
			let t = this._previewStates.get(e) || {
				on: !0,
				brightness: 255,
				rgb: E(n.color || "#fff0d4")
			};
			this._previewStates.set(e, {
				...t,
				on: !t.on
			}), this._states();
			return;
		}
		let r = t.bindings[e], i = this._hass.states?.[r];
		if (!i || ["unavailable", "unknown"].includes(i.state) || (this._pendingToggles ||= /* @__PURE__ */ new Set(), this._pendingToggles.has(e))) return;
		this._pendingToggles.add(e);
		let a = [...this.shadowRoot.querySelectorAll("[data-control]")].find((t) => t.dataset.control === e);
		a?.setAttribute("aria-busy", "true"), this.shadowRoot.querySelector(".fixture-feedback")?.remove();
		let o = X([r], this._hass.states);
		try {
			let e = r.split(".")[0];
			await this._hass.callService([
				"light",
				"switch",
				"input_boolean",
				"fan"
			].includes(e) ? e : "homeassistant", "toggle", { entity_id: r }), this._offerUndo(() => `${c(n, "Light")} turned ${i.state === "on" ? "off" : "on"}`, o, { holdTip: !0 });
		} catch {
			let e = document.createElement("div");
			e.className = "fixture-feedback", e.setAttribute("role", "alert"), e.textContent = "Could not change the light. Try again.", this._container.append(e);
		} finally {
			this._pendingToggles.delete(e), a?.removeAttribute("aria-busy");
		}
	}
	async _pressPreset(e) {
		if (this._preview || !this._model.bindings[e.id]) {
			this._pick(e.id);
			return;
		}
		let t = this._hass.states?.[this._model.bindings[e.id]];
		if (!V(t).unavailable && (this._pendingPresets ||= /* @__PURE__ */ new Set(), !this._pendingPresets.has(e.id))) {
			this._pendingPresets.add(e.id);
			try {
				await this._hass.callWS({
					type: "three_d_rooms/request",
					operation: "command",
					data: {
						model: this._model.id,
						controlId: e.id,
						action: "press"
					}
				});
			} catch {
				let e = document.createElement("div");
				e.className = "fixture-feedback", e.setAttribute("role", "alert"), e.textContent = "Could not run the preset. Try again.", this._container.append(e);
			} finally {
				this._pendingPresets.delete(e.id);
			}
		}
	}
	_pick(e) {
		if (this._layout?.fullscreen) {
			document.exitFullscreen().then(() => this._pick(e)).catch(() => {});
			return;
		}
		let t = this._panelModel.controls.find((t) => t.id === e);
		if (!t || t.hidden) return;
		let n = b(this._panelModel, e);
		if (n) {
			this._deskDialog(n);
			return;
		}
		let r = this._panelModel.bindings[e];
		if (!this._preview && r && t.type === "vacuum") {
			this._vacuumDialog(t, r);
			return;
		}
		if (!this._preview && r) {
			this.dispatchEvent(new CustomEvent("hass-more-info", {
				detail: { entityId: r },
				bubbles: !0,
				composed: !0
			}));
			return;
		}
		if (t.type === "climate") {
			this._dialog?.remove();
			let e = document.createElement("dialog");
			this._dialog = e, e.innerHTML = "<form method=\"dialog\"><h2>Air conditioner</h2><p>Connect this AC to its climate entity in 3D Rooms → Devices. The mapped device opens Home Assistant controls for temperature, mode and fan features.</p><button>Close</button></form>", this.shadowRoot.append(e), e.showModal();
			return;
		}
		if (t.type === "button") {
			this._dialog?.remove();
			let e = document.createElement("dialog");
			this._dialog = e, e.innerHTML = "<form method=\"dialog\"><h2></h2><p>Connect this preset to its button, script or scene in 3D Rooms → Devices.</p><button>Close</button></form>", e.querySelector("h2").textContent = c(t), this.shadowRoot.append(e), e.showModal();
			return;
		}
		if (t.type === "number") {
			this._numberPreview(t);
			return;
		}
		if (t.type === "lock") {
			this._lockPreview(t);
			return;
		}
		if (t.type === "vacuum") {
			this._vacuumPreview(t);
			return;
		}
		if (t.type === "cover") {
			this._coverPreview(t);
			return;
		}
		this._dialog?.remove();
		let i = document.createElement("dialog");
		this._dialog = i, i.innerHTML = "<form method=\"dialog\"><h2></h2><p></p><div class=\"preview-controls\"><button type=\"button\" role=\"switch\">On</button><label>Brightness<input type=\"range\" min=\"1\" max=\"255\"></label><label>Color<input type=\"color\"></label><label>Temperature<input type=\"range\" min=\"2000\" max=\"6500\" step=\"100\"></label></div><button class=\"close\">Close</button></form>", i.querySelector("h2").textContent = c(t, "Room light"), i.querySelector("p").textContent = this._preview ? "Local preview · no real device commands" : "Connect this light to an entity in 3D Rooms → Model settings.", i.querySelector(".preview-controls").hidden = !this._preview;
		let a = { ...this._previewStates.get(e) || {
			on: !0,
			brightness: 255,
			rgb: E(t.color || "#fff0d4")
		} }, o = i.querySelector("[role=\"switch\"]"), s = i.querySelector("[type=\"range\"]"), l = i.querySelector("[type=\"color\"]"), u = i.querySelectorAll("[type=\"range\"]")[1], d = () => {
			o.textContent = a.on ? "On" : "Off", o.setAttribute("aria-checked", String(a.on)), o.setAttribute("aria-label", "Light power"), this._previewStates.set(e, { ...a }), this._states();
		};
		s.value = a.brightness, l.value = "#" + a.rgb.map((e) => Math.round(e).toString(16).padStart(2, "0")).join(""), u.value = a.colorTempKelvin || 3e3, o.onclick = () => {
			a.on = !a.on, d();
		}, s.oninput = () => {
			a.brightness = Number(s.value), d();
		}, l.oninput = () => {
			a.rgb = E(l.value), d();
		}, u.oninput = () => {
			a.colorTempKelvin = Number(u.value), a.rgb = ue(a.colorTempKelvin), l.value = "#" + a.rgb.map((e) => e.toString(16).padStart(2, "0")).join(""), d();
		}, this._preview && d(), i.addEventListener("close", () => i.remove()), this.shadowRoot.append(i), i.showModal();
	}
	_deskDialog(e) {
		this._dialog?.remove();
		let t = document.createElement("dialog");
		this._dialog = t, t.className = "dm", t.dataset.desk = e.id, t.innerHTML = We, t.querySelector("h2").textContent = e.label;
		let n = t.querySelector(".dm-macros");
		for (let [t, r] of e.macros.entries()) {
			let e = document.createElement("button");
			e.type = "button", e.className = "dm-round", e.dataset.macro = r, e.setAttribute("aria-label", "Macro " + (t + 1));
			let i = document.createElement("span"), a = document.createElement("ha-state-icon"), o = document.createElement("span");
			i.className = "dm-disc", a.setAttribute("aria-hidden", "true"), i.append(a), e.append(i, o), n.append(e), e.onclick = () => this._deskCommand(r, "press");
		}
		t.querySelector("[data-desk-macros-section]").hidden = !e.macros.length;
		for (let n of t.querySelectorAll("[data-action]")) n.onclick = () => this._deskCommand(e.motion, n.dataset.action);
		let r = t.querySelector(".dm-slider"), i, a = () => t._deskRange, o = (e) => this._showDeskHeight(e), s = (t) => this._deskCommand(e.height, "set_value", t);
		r.onpointerdown = (e) => {
			if (r.getAttribute("aria-disabled") === "true" || !a()) return;
			e.preventDefault(), r.setPointerCapture(e.pointerId), r.classList.add("dm-dragging"), t._deskDragging = !0;
			let n = (e) => Ke(e.clientY, r.getBoundingClientRect(), a());
			t._deskValue = n(e), o(t._deskValue), r.onpointermove = (e) => {
				t._deskValue = n(e), o(t._deskValue);
			}, r.onpointerup = r.onpointercancel = (e) => {
				r.onpointermove = r.onpointerup = r.onpointercancel = null, r.classList.remove("dm-dragging"), t._deskDragging = !1, e.type === "pointerup" ? s(t._deskValue) : this._updateDeskDialog();
			};
		}, r.onkeydown = (e) => {
			let n = a();
			if (!n || r.getAttribute("aria-disabled") === "true") return;
			let c = Math.max(n.step, (n.max - n.min) / 10), l = {
				ArrowUp: n.step,
				ArrowRight: n.step,
				ArrowDown: -n.step,
				ArrowLeft: -n.step,
				PageUp: c,
				PageDown: -c
			}[e.key], u = e.key === "Home" ? n.min : e.key === "End" ? n.max : l === void 0 ? void 0 : (t._deskValue ?? n.min) + l;
			u !== void 0 && (e.preventDefault(), t._deskDragging = !0, t._deskValue = Ge(u, n), o(t._deskValue), clearTimeout(i), i = setTimeout(() => {
				t._deskDragging = !1, s(t._deskValue);
			}, 500));
		}, t.addEventListener("click", (e) => {
			e.target === t && t.close();
		}), t.addEventListener("close", () => {
			clearTimeout(i), t.remove();
		}), le(t, { top: ".sheet-grab, .dm-head" }), this.shadowRoot.append(t), this._updateDeskDialog(), t.showModal(), de(t);
	}
	_showDeskHeight(e) {
		let t = this._dialog, n = t?._deskRange;
		if (!n) return;
		let r = Number.isFinite(e);
		t.querySelector(".dm-fill").style.height = qe(e, n) * 100 + "%", t.querySelector(".dm-big").textContent = r ? `${e} ${n.unit}` : "—";
		let i = t.querySelector(".dm-slider");
		i.setAttribute("aria-valuemin", n.min), i.setAttribute("aria-valuemax", n.max), r ? (i.setAttribute("aria-valuenow", e), i.setAttribute("aria-valuetext", `${e} ${n.unit}`)) : i.removeAttribute("aria-valuenow");
	}
	async _deskCommand(e, t, n) {
		let r = this._model.controls.find((t) => t.id === e);
		if (this._preview) r.type === "number" && this._previewStates.set(e, { value: n }), this._states();
		else {
			(this._dialog?.querySelectorAll("button[type=\"button\"]") || []).forEach((e) => e.disabled = !0);
			try {
				await this._hass.callWS({
					type: "three_d_rooms/request",
					operation: "command",
					data: {
						model: this._model.id,
						controlId: e,
						action: t,
						...n === void 0 ? {} : { value: n }
					}
				});
			} catch (e) {
				let t = this._dialog?.querySelector("[data-desk-error]");
				t && (t.textContent = e.message || "Could not change the desk. Try again.");
			} finally {
				this._updateDeskDialog();
			}
		}
	}
	_updateDeskDialog() {
		let e = this._dialog;
		if (!e?.dataset?.desk) return;
		let t = this._model.devices?.find((t) => t.id === e.dataset.desk);
		if (!t) return;
		let n = this._model.controls.find((e) => e.id === t.height), r = this._hass.states?.[this._model.bindings[n.id]], i = this._preview ? this._previewStates.get(n.id) || { value: n.defaultValue } : Be(r, n);
		e._deskRange = {
			min: Math.max(n.min, r?.attributes?.min ?? n.min),
			max: Math.min(n.max, r?.attributes?.max ?? n.max),
			step: Math.max(n.step, r?.attributes?.step || n.step),
			unit: n.unit
		}, e.querySelector(".dm-slider").setAttribute("aria-disabled", String(!!i.unavailable)), e.querySelector("[data-desk-status]").textContent = i.unavailable ? "Unavailable" : i.value === void 0 ? "Height unknown" : `Height ${i.value} ${n.unit}`, e._deskDragging || (e._deskValue = i.value, this._showDeskHeight(i.value));
		let a = this._hass.states?.[this._model.bindings[t.motion]], o = this._preview ? {
			open: !0,
			close: !0,
			stop: !0
		} : te(a), s = !this._preview && f(a).unavailable;
		for (let t of e.querySelectorAll("[data-action]")) t.disabled = s || !o[t.dataset.action];
		for (let n of e.querySelectorAll("[data-macro]")) {
			let e = n.dataset.macro, r = this._hass.states?.[this._model.bindings[e]], i = l(this._model, t, e);
			n.querySelector("span:last-child").textContent = i || "Name macro", n.setAttribute("aria-label", i || "Macro " + (t.macros.indexOf(e) + 1));
			let a = n.querySelector("ha-state-icon");
			a.hass = this._hass, a.stateObj = r || {
				entity_id: "button.preview",
				state: "unknown",
				attributes: { icon: "mdi:gesture-tap-button" }
			}, n.disabled = !this._preview && V(r).unavailable;
		}
	}
	_numberPreview(e) {
		this._dialog?.remove();
		let t = document.createElement("dialog");
		this._dialog = t, t.innerHTML = "<form method=\"dialog\"><h2></h2><p></p><label>Height <output></output><input type=\"range\" aria-label=\"Desk height\"></label><button>Close</button></form>", t.querySelector("h2").textContent = c(e), t.querySelector("p").textContent = this._preview ? "Local preview · no real device commands" : "Connect this height to a number or input number entity in 3D Rooms → Devices.";
		let n = t.querySelector("input");
		Object.assign(n, {
			min: e.min,
			max: e.max,
			step: e.step,
			value: this._previewStates?.get(e.id)?.value ?? e.defaultValue,
			disabled: !this._preview
		});
		let r = () => {
			t.querySelector("output").textContent = n.value + " " + e.unit, this._preview && (this._previewStates.set(e.id, { value: Number(n.value) }), this._states());
		};
		n.oninput = r, r(), t.addEventListener("close", () => t.remove()), this.shadowRoot.append(t), t.showModal();
	}
	_coverPreview(e) {
		this._dialog?.remove();
		let t = document.createElement("dialog");
		this._dialog = t, t.innerHTML = "<form method=\"dialog\"><h2></h2><p></p><label>Opening <output></output><input type=\"range\" min=\"0\" max=\"100\" step=\"1\" aria-label=\"Shade opening\"></label><button>Close</button></form>", t.querySelector("h2").textContent = c(e), t.querySelector("p").textContent = this._preview ? "Local preview · no real device commands" : "Connect this shade to a cover entity in 3D Rooms → Model settings.";
		let n = t.querySelector("input");
		n.disabled = !this._preview, n.value = this._previewStates.get(e.id)?.position ?? e.defaultPosition ?? 0;
		let r = () => {
			t.querySelector("output").textContent = n.value + "% open", this._preview && (this._previewStates.set(e.id, { position: Number(n.value) }), this._states());
		};
		n.oninput = r, r(), t.addEventListener("close", () => t.remove()), this.shadowRoot.append(t), t.showModal();
	}
	_vacuumActivity(e, t) {
		let n = this._hass, r = this._model.bindings?.[t.id];
		if (this._preview || !n || !t.entities?.length) {
			delete e.dataset.activity;
			return;
		}
		!n.entities && this._entityCategories === void 0 && (this._entityCategories = null, n.callWS?.({ type: "config/entity_registry/list_for_display" }).then((e) => {
			let t = e?.entity_categories || {};
			this._entityCategories = Object.fromEntries((e?.entities || []).filter((e) => e.ec !== void 0 && t[e.ec]).map((e) => [e.ei, t[e.ec]])), this._states();
		}).catch(() => {}));
		let i = ie(t.entities, n.states, (e) => n.entities?.[e]?.entity_category ?? this._entityCategories?.[e] ?? null, [r, t.map]);
		if (!i.length) {
			delete e.dataset.activity;
			return;
		}
		e.dataset.activity = "true";
		let a = e.querySelector(".marker-activity");
		if (!a) {
			a = document.createElement("span"), a.className = "marker-activity", a.setAttribute("aria-hidden", "true");
			let t = document.createElement("span");
			t.className = "marker-activity-tip", t.setAttribute("aria-hidden", "true"), e.append(a, t);
		}
		let o = [...a.querySelectorAll("ha-state-icon")];
		for (; o.length > i.length;) o.pop().remove();
		for (; o.length < i.length;) {
			let e = document.createElement("ha-state-icon");
			a.append(e), o.push(e);
		}
		i.forEach((e, t) => {
			let r = n.states[e];
			o[t].hass = n, o[t].dataset.defaultIcon = se(r), o[t].stateObj = r;
		});
		let s = n.states[r]?.attributes?.friendly_name || "", c = i.map((e) => {
			let t = n.states[e]?.attributes?.friendly_name || e;
			return s && t.startsWith(`${s} `) && (t = t.slice(s.length + 1)), t;
		});
		e.querySelector(".marker-activity-tip").replaceChildren(...c.map((e) => {
			let t = document.createElement("span");
			return t.textContent = e, t;
		})), e.removeAttribute("title"), e.setAttribute("aria-label", `${e.getAttribute("aria-label")}. ${c.join(", ")}`);
	}
	async _vacuumDialog(e, t) {
		let { openMoreInfo: n } = await import("./three-d-rooms-more-info-BjUJow3T.js");
		this._robotDialog?.close();
		let r = n({
			host: this.shadowRoot,
			getHass: () => this._hass,
			entityId: t,
			extras: (e.entities || []).filter((n) => n !== t && n !== e.map),
			map: e.map || "",
			openHaView: this.hasAttribute("fill-page") ? null : (e, t) => this.dispatchEvent(new CustomEvent("hass-more-info", {
				detail: {
					entityId: e,
					view: t
				},
				bubbles: !0,
				composed: !0
			})),
			onError: (e) => console.error(e)
		});
		this._robotDialog = r, r.dialog.addEventListener("close", () => {
			this._robotDialog === r && (this._robotDialog = null);
		});
	}
	_vacuumPreview(e) {
		this._dialog?.remove();
		let t = document.createElement("dialog");
		this._dialog = t, t.innerHTML = "<form method=\"dialog\"><h2></h2><p></p><div class=\"preview-controls\"><button type=\"button\" data-vacuum=\"cleaning\">Start</button><button type=\"button\" data-vacuum=\"paused\">Pause</button><button type=\"button\" data-vacuum=\"returning\">Dock</button></div><button>Close</button></form>", t.querySelector("h2").textContent = c(e), t.querySelector("p").textContent = this._preview ? "Local preview · no real device commands" : "Connect this robot to its vacuum entity in 3D Rooms → Devices. The mapped vacuum opens Home Assistant's own vacuum controls, including cleaning by area.";
		for (let n of t.querySelectorAll("[data-vacuum]")) n.disabled = !this._preview, n.onclick = () => {
			this._previewStates.set(e.id, x({
				entity_id: "vacuum.preview",
				state: n.dataset.vacuum
			})), this._states();
		};
		t.addEventListener("close", () => t.remove()), this.shadowRoot.append(t), t.showModal();
	}
	_lockPreview(e) {
		this._dialog?.remove();
		let t = document.createElement("dialog");
		this._dialog = t, t.innerHTML = "<form method=\"dialog\"><h2></h2><p></p><div class=\"preview-controls\"><button type=\"button\" data-lock=\"unlock\">Unlock</button><button type=\"button\" data-lock=\"lock\">Lock</button></div><button>Close</button></form>", t.querySelector("h2").textContent = c(e), t.querySelector("p").textContent = this._preview ? "Local preview · no real device commands" : "Connect this lock to its lock entity in 3D Rooms → Devices. The mapped lock opens Home Assistant's own lock controls.";
		for (let n of t.querySelectorAll("[data-lock]")) n.disabled = !this._preview, n.onclick = () => {
			let t = n.dataset.lock === "lock";
			this._previewStates.set(e.id, {
				locked: t,
				label: t ? "Locked" : "Unlocked",
				unavailable: !1
			}), this._states();
		};
		t.addEventListener("close", () => t.remove()), this.shadowRoot.append(t), t.showModal();
	}
	_states() {
		if (!this._model || !this._view) return;
		let e = /* @__PURE__ */ new Map();
		for (let t of this._model.controls) {
			let n = this._hass.states?.[this._model.bindings[t.id]];
			t.type === "climate" ? e.set(t.id, i(n)) : t.type === "vacuum" ? e.set(t.id, this._preview ? this._previewStates?.get(t.id) || x({
				entity_id: "vacuum.preview",
				state: "docked"
			}) : x(n)) : t.type === "lock" ? e.set(t.id, this._preview ? this._previewStates?.get(t.id) || {
				locked: !0,
				label: "Locked",
				unavailable: !1
			} : u(n)) : t.type === "button" ? e.set(t.id, this._preview ? { unavailable: !1 } : V(n)) : t.type === "number" ? e.set(t.id, this._preview ? this._previewStates?.get(t.id) || { value: t.defaultValue } : Be(n, t)) : t.type === "cover" ? e.set(t.id, this._preview ? this._previewStates?.get(t.id) || { position: t.defaultPosition ?? 0 } : f(n)) : e.set(t.id, this._preview ? this._previewStates?.get(t.id) || {
				on: !0,
				brightness: 255,
				rgb: E(t.color || "#fff0d4")
			} : {
				on: n?.state === "on",
				unavailable: !n || ["unavailable", "unknown"].includes(n.state),
				brightness: n?.attributes?.brightness ?? 255,
				...fe(n, t.color)
			});
		}
		this._updateDeskDialog(), this._lightStates = e, this._syncLightPanel(e), this._syncRoomTagStates(), this._customEntityStates(), this._syncSummary();
		for (let t of this.shadowRoot.querySelectorAll("[data-control]")) {
			let r = t.dataset.control, i = this._model.controls.find((e) => e.id === r), a = this._hass.states?.[this._model.bindings[r]], o = Je(i, a, e.get(r), this._preview);
			t.dataset.active = String(o.active), t.dataset.moving = String(o.moving), t.dataset.unavailable = String(o.unavailable), Xe(t, o);
			let s = b(this._model, r)?.label || c(i);
			t.title = `${s}: ${o.description}`, t.setAttribute("aria-label", `${i.type === "light" ? "Toggle" : "Control"} ${s}, ${o.description}${i.type === "light" ? ". Hold, or press Shift+Enter, for more info." : ""}`), t.setAttribute("aria-disabled", String(o.unavailable)), i.type === "light" ? t.setAttribute("aria-pressed", String(o.active)) : t.removeAttribute("aria-pressed");
			let l = t.querySelector("ha-state-icon");
			if (l) {
				l.hass = this._hass, l.stateObj = o.stateObj;
				let e = C(n(this._config.markers, r), i, o.active);
				l.icon !== e && (l.icon = e), (l.dataset.glyph ?? "") !== (e || "") && (l.innerHTML = Ft(i, e), l.dataset.glyph = e || "");
			}
			t.querySelector(".fixture-state").textContent = o.badge, i.type === "vacuum" && this._vacuumActivity(t, i);
		}
		let t = this._preview ? void 0 : this._hass.states?.[this._model.daylight?.entity || "sun.sun"], r = JSON.stringify([
			[...e],
			this._model.daylight?.mode,
			t?.state,
			t?.attributes?.elevation
		]);
		r !== this._signature && (this._signature = r, this._applyBackdrop(t), this._view.setStates(e), this._view.setDaylight?.(this._model.daylight?.mode ?? "night", t));
	}
};
customElements.get("three-d-rooms-card") ? customElements.get("three-d-rooms-card") !== $ && console.warn("3D Rooms: an older 3D Rooms card was loaded before this one, so dashboards use it. Remove the 3D Rooms entry from Settings → Dashboards → Resources (Home Assistant Repairs offers to), then reload.") : customElements.define("three-d-rooms-card", $), window.customCards = window.customCards || [], window.customCards.some((e) => e.type === "three-d-rooms-card") || window.customCards.push({
	type: "three-d-rooms-card",
	name: "3D Rooms",
	description: "Your room in perspective, with live lighting and controls on the modeled fixtures.",
	preview: !0
});
export { $ as ThreeDRoomsCard };
