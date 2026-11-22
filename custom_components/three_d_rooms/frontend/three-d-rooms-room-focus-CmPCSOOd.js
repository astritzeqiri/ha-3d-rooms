import { m as e, p as t } from "./three-d-rooms-vacuum-DvAkyrf8.js";
// shared/scene-sessions.mjs
var n = /* @__PURE__ */ new WeakMap();
function r(e) {
	n.delete(e);
}
function i(e, t = "original") {
	return `${e.id}:${e.sceneRevision || e.importedAt || "legacy"}:${t}`;
}
// shared/climate.mjs
function a(e) {
	let t = !e || ["unknown", "unavailable"].includes(e.state), n = e?.attributes || {}, r = t ? "unknown" : e.state, i = typeof n.hvac_action == "string" ? n.hvac_action : void 0;
	return {
		unavailable: t,
		on: !t && r !== "off",
		mode: r,
		action: i,
		fanMode: typeof n.fan_mode == "string" ? n.fan_mode : void 0,
		swingMode: typeof n.swing_mode == "string" ? n.swing_mode : void 0,
		temperature: Number.isFinite(n.temperature) ? n.temperature : void 0,
		currentTemperature: Number.isFinite(n.current_temperature) ? n.current_temperature : void 0
	};
}
function o(e = {}) {
	let t = {
		cool: "Cooling",
		heat: "Heating",
		dry: "Drying",
		fan_only: "Fan only",
		auto: "Auto",
		heat_cool: "Auto"
	};
	if (e.unavailable) return {
		color: "#89918e",
		label: "Unavailable",
		flow: !1,
		speed: 0,
		open: !1
	};
	if (!e.on || e.mode === "off") return {
		color: "#5f6b65",
		label: "Off",
		flow: !1,
		speed: 0,
		open: !1
	};
	let n = e.action, r = {
		heating: "heat",
		cooling: "cool",
		drying: "dry",
		fan: "fan_only"
	}[n] || e.mode, i = [
		"idle",
		"off",
		"defrosting"
	].includes(n), a = Object.hasOwn(t, r), o = a && !i && (n ? [
		"heating",
		"cooling",
		"drying",
		"fan"
	].includes(n) : !["auto", "heat_cool"].includes(e.mode)), s = {
		cool: "#74caff",
		heat: "#ffa06a",
		dry: "#d7b97d",
		fan_only: "#c0e4da",
		auto: "#99cfc1",
		heat_cool: "#99cfc1"
	}, c = (e.fanMode || "auto").toLowerCase(), l = /high|turbo|powerful|5/.test(c) ? 1.5 : /low|quiet|silent|1/.test(c) ? .65 : 1;
	return {
		color: s[r] || "#99b5ad",
		tone: a ? r === "heat_cool" ? "auto" : r : void 0,
		label: i ? `${t[e.mode] || "On"} · ${n === "defrosting" ? "Defrosting" : "Idle"}` : t[r] || "On",
		flow: o,
		speed: l,
		open: o || i
	};
}
// shared/marker-settings.mjs
var s = [
	"_defaults",
	"_rooms",
	"_entities"
];
function c(n) {
	if (n === void 0) return;
	if (!n || typeof n != "object" || Array.isArray(n) || Object.keys(n).filter((e) => !s.includes(e)).length > 128) throw Error("Use a device-marker settings object with at most 128 controls.");
	let r = {};
	for (let [i, a] of Object.entries(n)) if (i === "_rooms") {
		let e = d(a);
		Object.keys(e).length && (r._rooms = e);
	} else if (i === "_entities") {
		let e = t(a);
		Object.keys(e).length && (r._entities = e);
	} else {
		if (i !== "_defaults" && !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(i) || ["constructor", "prototype"].includes(i) || !a || typeof a != "object" || Array.isArray(a) || Object.keys(a).some((e) => ![
			"visible",
			"show_label",
			"size",
			"placement",
			"offset",
			"icon",
			"icon_off"
		].includes(e))) throw Error("Invalid device-marker settings.");
		if (i === "_defaults" && a.offset !== void 0) throw Error("View defaults cannot contain a position offset.");
		if (i === "_defaults" && (a.icon !== void 0 || a.icon_off !== void 0)) throw Error("Choose icons per device, not as a view default.");
		for (let t of ["icon", "icon_off"]) if (a[t] !== void 0 && !e(a[t])) throw Error("Choose a Home Assistant icon such as mdi:door or local:front-door.");
		for (let e of ["visible", "show_label"]) if (a[e] !== void 0 && typeof a[e] != "boolean") throw Error("Marker visibility and labels must be true or false.");
		if (a.size !== void 0 && (!Number.isInteger(a.size) || a.size < 24 || a.size > 64)) throw Error("Marker size must be 24–64 pixels.");
		if (a.placement !== void 0 && !["room", "tray"].includes(a.placement)) throw Error("Choose room or tray for a device control.");
		if (a.offset !== void 0 && (!Array.isArray(a.offset) || a.offset.length !== 3 || a.offset.some((e) => !Number.isFinite(e) || Math.abs(e) > 1e3))) throw Error("Marker offsets must be three finite values within 1000 metres.");
		r[i] = structuredClone(a);
	}
	return r;
}
var l = [
	"auto",
	"always",
	"never"
], u = {
	min: 20,
	max: 64,
	standard: 30
};
function d(e) {
	if (!e || typeof e != "object" || Array.isArray(e) || Object.keys(e).length > 64) throw Error("Use a room-button settings object with at most 64 rooms.");
	let t = {};
	for (let [n, r] of Object.entries(e)) {
		if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(n) || ["constructor", "prototype"].includes(n) || !r || typeof r != "object" || Array.isArray(r) || Object.keys(r).some((e) => ![
			"mode",
			"position",
			"heading",
			"tilt",
			"size"
		].includes(e))) throw Error("Invalid room-button settings.");
		if (r.mode !== void 0 && !l.includes(r.mode)) throw Error("Choose when the room button shows.");
		if (r.position !== void 0 && (!Array.isArray(r.position) || r.position.length !== 3 || r.position.some((e) => !Number.isFinite(e) || Math.abs(e) > 1e3))) throw Error("A room button position must be three numbers.");
		if (r.heading !== void 0 && (!Number.isFinite(r.heading) || r.heading < 0 || r.heading >= 360)) throw Error("A room view heading must be 0 to under 360 degrees.");
		if (r.tilt !== void 0 && (!Number.isFinite(r.tilt) || r.tilt < 0 || r.tilt > 180)) throw Error("A room view tilt must be 0 to 180 degrees.");
		if (r.size !== void 0 && (!Number.isInteger(r.size) || r.size < u.min || r.size > u.max)) throw Error(`A room button size must be ${u.min}–${u.max} pixels.`);
		let e = {
			...r.mode && r.mode !== "auto" ? { mode: r.mode } : {},
			...r.position ? { position: [...r.position] } : {},
			...r.heading === void 0 ? {} : { heading: r.heading },
			...r.tilt === void 0 ? {} : { tilt: r.tilt },
			...r.size !== void 0 && r.size !== u.standard ? { size: r.size } : {}
		};
		Object.keys(e).length && (t[n] = e);
	}
	return t;
}
function f(e, t) {
	return {
		visible: !0,
		show_label: !0,
		size: 32,
		placement: "room",
		...e?._defaults || {},
		...e?.[t] || {}
	};
}
function p(e, t = [
	0,
	0,
	0
]) {
	return e.map((e, n) => e + t[n]);
}
function m(e, t, n, r) {
	let i = t.size;
	return {
		left: Math.max(0, Math.min(n - i, e.x - i / 2)),
		top: Math.max(0, Math.min(r - i - (t.show_label ? 16 : 0), e.y - i / 2))
	};
}
function h(e, t) {
	let n = (t ? t.filter((e) => !e.hidden && e.lightGroupPrimary !== !1).map((e) => e.id) : Object.keys(e || {}).filter((e) => !s.includes(e))).filter((t) => {
		let n = f(e, t);
		return n.visible && n.placement === "tray";
	}).length;
	return n ? n * 76 + 24 : 0;
}
// shared/device.mjs
var g = (e, t) => (e.devices || []).find((e) => [
	e.height,
	e.motion,
	...e.macros
].includes(t)), _ = (e, t, n) => e.deviceSettings?.[t.id]?.macroNames?.[n] || "";
// shared/workspace.mjs
function v(e) {
	let t = String(e ?? "");
	return t.replace(/\s*·\s*(?:(?:[\p{L}\p{N}]+\s+)?scan|edited)(?=\s*(?:·|$))/giu, "").trim() || t;
}
function y(e, t = "Device") {
	let n = e?.label || e?.name || t, r = e?.roomTitle ? `${e.roomTitle} · ` : "";
	return r && n.startsWith(r) ? `${v(e.roomTitle)} · ${n.slice(r.length)}` : n;
}
// shared/cover.mjs
function b(e) {
	let t = e?.entity_id?.startsWith("cover.") && e.attributes?.supported_features || 0;
	return {
		open: !!(t & 1),
		close: !!(t & 2),
		position: !!(t & 4),
		stop: !!(t & 8)
	};
}
function x(e) {
	let t = !e || ["unknown", "unavailable"].includes(e.state);
	if (e?.entity_id?.startsWith("binary_sensor.")) {
		let n = t ? void 0 : e.state === "on" ? 100 : 0;
		return {
			position: n,
			motionPosition: n,
			unavailable: t,
			label: t ? "Unavailable" : n ? "Open" : "Closed"
		};
	}
	let n = e?.attributes?.current_position, r = t ? void 0 : Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : e.state === "closed" ? 0 : void 0;
	return {
		position: r,
		motionPosition: r ?? (!t && e.state === "open" && !b(e).position ? 100 : void 0),
		unavailable: t,
		label: t ? "Unavailable" : r === void 0 ? e.state : `${Math.round(r)}% open`
	};
}
function S(e, t) {
	let n = e.userData.hingedDoor;
	if (n) {
		if (!Number.isFinite(t) || n.axis !== "y" || !Number.isFinite(n.closedAngle) || !Number.isFinite(n.openAngle)) return;
		e.rotation.y = n.closedAngle + (n.openAngle - n.closedAngle) * Math.max(0, Math.min(100, t)) / 100;
		return;
	}
	let r = e.userData.slidingDoor;
	if (r) {
		if (!Number.isFinite(t) || r.axis !== "x" || !Number.isFinite(r.closedOffset) || !Number.isFinite(r.openOffset)) return;
		e.position.x = r.closedOffset + (r.openOffset - r.closedOffset) * Math.max(0, Math.min(100, t)) / 100;
		return;
	}
	let i = e.userData.rollerShade;
	if (!i || !Number.isFinite(t) || !Number.isFinite(i.top) || !Number.isFinite(i.height) || i.height <= 0) return;
	let a = i.top - i.height, o = i.height * Math.max(0, Math.min(100, t)) / 100;
	e.traverse((e) => {
		let t = e.userData.rollerShadePart;
		if (!t || !Number.isFinite(t.center) || !Number.isFinite(t.height) || t.height <= 0) return;
		let n = t.center + o;
		if (t.rail) {
			e.position.y = Math.min(i.top - t.height / 2, n);
			return;
		}
		let r = Math.max(a, n - t.height / 2), s = Math.min(i.top, n + t.height / 2);
		e.visible = s - r > 1e-7, e.position.y = (r + s) / 2, e.scale.y = Math.max(0, s - r) / t.height;
	});
}
// shared/lock.mjs
var C = {
	locked: "Locked",
	unlocked: "Unlocked",
	locking: "Locking",
	unlocking: "Unlocking",
	jammed: "Jammed",
	open: "Open",
	opening: "Opening"
};
function w(e) {
	let t = e?.state, n = !e || !/^lock\./.test(e.entity_id || "") || !(t in C);
	return {
		state: n ? void 0 : t,
		locked: n ? void 0 : t === "locked" || t === "locking",
		moving: t === "locking" || t === "unlocking" || t === "opening",
		jammed: t === "jammed",
		needsCode: !!e?.attributes?.code_format,
		label: n ? "Unavailable" : C[t],
		unavailable: n
	};
}
function T(e, t) {
	e?.traverse?.((e) => {
		let n = e.userData?.lockTurn;
		if (!n) return;
		e.userData.lockRest ||= e.quaternion.clone();
		let [r, i, a] = n.axis, o = (t ? n.lockedAngle : 0) / 2, s = Math.sin(o), c = e.userData.lockRest;
		e.quaternion.copy(c), e.quaternion.multiply(new c.constructor(r * s, i * s, a * s, Math.cos(o))), e.updateMatrix?.();
	});
}
// shared/floor-view.mjs
function E(e, t, n, r = 0, i = 0) {
	if (![
		...e,
		...t,
		n,
		r,
		i
	].every(Number.isFinite) || n <= 0 || e.some((e, n) => e > t[n])) throw Error("Invalid floor camera bounds.");
	let a = Math.max(0, Math.min(180, r)) * Math.PI / 180, o = i * Math.PI / 180, s = [
		Math.sin(a) * Math.sin(o),
		Math.cos(a),
		Math.sin(a) * Math.cos(o)
	], c = [
		Math.cos(o),
		0,
		-Math.sin(o)
	], l = [
		-Math.cos(a) * Math.sin(o),
		Math.sin(a),
		-Math.cos(a) * Math.cos(o)
	], u = e.map((e, n) => (e + t[n]) / 2), d = e.map((e, n) => t[n] - e), f = (e) => d.reduce((t, n, r) => t + n * Math.abs(e[r]), 0), p = Math.max(f(l) / 2, f(c) / (2 * n), .1) * 1.12, m = Math.hypot(...d), h = m * 2 + 10;
	return {
		target: u,
		position: u.map((e, t) => e + s[t] * h),
		up: l,
		left: -p * n,
		right: p * n,
		top: p,
		bottom: -p,
		near: .05,
		far: h + m * 4 + 100
	};
}
function D(e, t, n, r = 28, i = 0) {
	let a = E(e, t, n, r, i), o = Math.max(0, Math.min(180, r)) * Math.PI / 180, s = i * Math.PI / 180, c = [
		Math.sin(o) * Math.sin(s),
		Math.cos(o),
		Math.sin(o) * Math.cos(s)
	], l = [
		Math.cos(s),
		0,
		-Math.sin(s)
	], u = (e, t) => e.reduce((e, n, r) => e + n * t[r], 0), d = Math.tan(35 * Math.PI / 360), f = 1;
	for (let r = 0; r < 8; r++) {
		let i = e.map((e, n) => (r >> n & 1 ? t[n] : e) - a.target[n]);
		f = Math.max(f, u(i, c) + 1.12 * Math.max(Math.abs(u(i, l)) / (d * n), Math.abs(u(i, a.up)) / d));
	}
	return {
		...a,
		fov: 35,
		aspect: n,
		position: a.target.map((e, t) => e + c[t] * f)
	};
}
// shared/camera-view.mjs
var O = (e, t) => Math.hypot(...e.map((e, n) => e - t[n])), k = (e) => Number(e.toFixed(2)), A = (e) => e * 180 / Math.PI;
function j(e) {
	let t = (e) => Array.isArray(e) && e.length === 3 && e.every((e) => Number.isFinite(e) && Math.abs(e) < 1e4), n = (e) => Number.isFinite(e) && e > 0 && e <= 1e4;
	if (!e || !t(e.position) || !t(e.target) || !t(e.up) || Math.hypot(...e.up) < 1e-8 || O(e.position, e.target) < 1e-8 || !n(e.aspect) || !n(e.zoom) || !n(e.referenceZoom) || !Number.isFinite(e.heading) || e.heading < 0 || e.heading >= 360 || !Number.isFinite(e.tilt) || e.tilt < 0 || e.tilt > 180 || !["perspective", "orthographic"].includes(e.projection)) throw Error("Invalid saved camera view.");
	if (e.projection === "perspective" && (!Number.isFinite(e.fov) || e.fov < 1 || e.fov > 179)) throw Error("Invalid saved camera field of view.");
	if (e.projection === "orthographic" && !n(e.halfHeight)) throw Error("Invalid saved floor view.");
	return {
		projection: e.projection,
		position: [...e.position],
		target: [...e.target],
		up: [...e.up],
		aspect: e.aspect,
		zoom: e.zoom,
		referenceZoom: e.referenceZoom,
		heading: e.heading,
		tilt: e.tilt,
		...e.projection === "perspective" ? { fov: e.fov } : { halfHeight: e.halfHeight }
	};
}
function M({ position: e, target: t, up: n, aspect: r, zoom: i = 1, fov: a, halfHeight: o, min: s, max: c }) {
	let l = e.map((e, n) => e - t[n]), u = Math.hypot(...l), d = Math.hypot(l[0], l[2]) / u < 1e-8 && Math.hypot(n[0], n[2]) > 1e-8, f = l[1] >= 0 ? -1 : 1, p = k((A(d ? Math.atan2(f * n[0], f * n[2]) : Math.atan2(l[0], l[2])) + 360) % 360) % 360, m = k(A(Math.acos(Math.max(-1, Math.min(1, l[1] / u))))), h = o === void 0 ? "front" : "floor", g = (h === "floor" ? E : D)(s, c, r, m, p), _;
	_ = h === "floor" ? i * g.top / o : i * O(g.position, g.target) / u * Math.tan(g.fov * Math.PI / 360) / Math.tan(a * Math.PI / 360);
	let v = Number(Math.max(.01, Math.min(100, _)).toFixed(4));
	return {
		view: h,
		heading: p,
		tilt: m,
		zoom: v,
		camera: j({
			projection: h === "floor" ? "orthographic" : "perspective",
			position: [...e],
			target: [...t],
			up: [...n],
			aspect: r,
			zoom: i,
			referenceZoom: v,
			heading: p,
			tilt: m,
			...h === "floor" ? { halfHeight: o } : { fov: a }
		})
	};
}
function N(e, t, n, r, i, a) {
	if (!Number.isFinite(r) || r <= 0) throw Error("Invalid camera aspect ratio.");
	let o = Math.min(1, r / e.aspect);
	if (!i || !a) return o;
	let s = (e, t) => e.reduce((e, n, r) => e + n * t[r], 0), c = (e, t) => [
		e[1] * t[2] - e[2] * t[1],
		e[2] * t[0] - e[0] * t[2],
		e[0] * t[1] - e[1] * t[0]
	], l = (e) => {
		let t = Math.hypot(...e);
		return e.map((e) => e / t);
	}, u = l(e.target.map((e, n) => e - t[n])), d = l(c(u, n)), f = l(c(d, u)), p = 0, m = 0;
	for (let n = 0; n < 8; n++) {
		let r = i.map((e, r) => (n >> r & 1 ? a[r] : e) - t[r]), c = e.projection === "perspective" ? s(r, u) : 1;
		if (c <= 0) return o;
		p = Math.max(p, Math.abs(s(r, d) / c)), m = Math.max(m, Math.abs(s(r, f) / c));
	}
	let h = Math.max(m, p / e.aspect), g = Math.max(m, p / r);
	return g > 0 ? h / g : o;
}
function P(e, { aspect: t, min: n, max: r, heading: i = e.heading, tilt: a = e.tilt, zoom: o = e.referenceZoom }) {
	let s = j(e), c = [...s.position], l = [...s.up];
	if (Math.abs(i - s.heading) > 1e-6 || Math.abs(a - s.tilt) > 1e-6) {
		let e = i * Math.PI / 180, t = a * Math.PI / 180, n = O(s.position, s.target), r = [
			Math.sin(t) * Math.sin(e),
			Math.cos(t),
			Math.sin(t) * Math.cos(e)
		];
		c = s.target.map((e, t) => e + r[t] * n), l = [
			-Math.cos(t) * Math.sin(e),
			Math.sin(t),
			-Math.cos(t) * Math.cos(e)
		];
	}
	return {
		position: c,
		target: [...s.target],
		up: l,
		aspect: t,
		zoom: s.zoom * o / s.referenceZoom * N(s, c, l, t, n, r),
		...s.projection === "perspective" ? { fov: s.fov } : {
			left: -s.halfHeight * t,
			right: s.halfHeight * t,
			top: s.halfHeight,
			bottom: -s.halfHeight
		},
		near: .05,
		far: O(c, s.target) + 1e3
	};
}
// shared/render-profile.mjs
var F = [
	"auto",
	"high",
	"low"
];
function I(e = globalThis) {
	if (e.navigator?.userAgentData?.mobile) return !0;
	let t = (t) => !!e.matchMedia?.(t)?.matches;
	return t("(pointer: coarse)") && !t("(any-pointer: fine)");
}
function L({ quality: e = "auto", mobile: t = !1, devicePixelRatio: n = 1 } = {}) {
	let r = Number.isFinite(n) && n > 0 ? n : 1, i = e === "low" || e !== "high" && t;
	return i ? {
		low: i,
		pixelRatio: Math.min(r, 1.5),
		antialias: r < 1.5,
		shadowPasses: 8,
		shadowMapSize: 512
	} : {
		low: i,
		pixelRatio: Math.min(r, 2),
		antialias: !0,
		shadowPasses: Infinity,
		shadowMapSize: Infinity
	};
}
function R(e = "auto", t = globalThis) {
	return L({
		quality: e,
		mobile: I(t),
		devicePixelRatio: t.devicePixelRatio
	}).low ? "phone" : "full";
}
function z(e, t) {
	Number.isFinite(t) && e.traverse((e) => {
		let n = e.isLight && e.shadow;
		if (!n?.mapSize) return;
		let r = Math.min(n.mapSize.x, t), i = Math.min(n.mapSize.y, t);
		(r !== n.mapSize.x || i !== n.mapSize.y) && (n.mapSize.set(r, i), n.map?.dispose(), n.map = null);
	});
}
// shared/room-focus.mjs
function B(e, t) {
	return e?.roomTitles?.[t] || e?.controls?.find((e) => e.sourceModel === t)?.roomTitle || "Room";
}
function V(e) {
	return !e?.houseView || e.focusRoom || (e.members?.length || 0) < 2 ? [] : e.members.map((t) => ({
		room: t.model,
		title: v(B(e, t.model))
	}));
}
function H(e, t) {
	let n = e?.members?.find((e) => e.model === t);
	return !n || !V(e).length ? null : {
		...e,
		title: B(e, t),
		members: [n],
		controls: e.controls.filter((e) => e.sourceModel === t),
		houseFloor: null,
		focusRoom: t
	};
}
function U(e) {
	let t = null;
	for (let n of e) (!t || n.y > t.y) && (t = n);
	return t;
}
var W = .6, G = .7;
function K(e, t, n = !1) {
	return e === "always" || e !== "never" && t < (n ? G : W);
}
function q(e, t = 4) {
	let n = [], r = e.map((e) => e.y), i = e.map((e, t) => t).sort((t, n) => Number(!!e[n].fixed) - Number(!!e[t].fixed) || e[t].y - e[n].y);
	for (let a of i) {
		let i = e[a], o = i.y;
		if (!i.fixed) for (let e = 0; e < 12; e++) {
			let e = n.find((e) => Math.abs(e.x - i.x) < (e.w + i.w) / 2 + t && o < e.y + e.h + t && e.y < o + i.h + t);
			if (!e) break;
			o = e.y + e.h + t;
		}
		r[a] = o, n.push({
			x: i.x,
			y: o,
			w: i.w,
			h: i.h
		});
	}
	return r;
}
export { c as A, v as C, f as D, m as E, n as F, a as M, r as N, h as O, i as P, y as S, _ as T, w as _, B as a, x as b, z as c, R as d, M as f, D as g, E as h, H as i, o as j, p as k, I as l, j as m, U as n, q as o, P as p, K as r, F as s, V as t, L as u, T as v, g as w, S as x, b as y };
