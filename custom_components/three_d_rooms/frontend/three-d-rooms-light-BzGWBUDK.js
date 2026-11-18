// dashboard/sheet-drag.mjs
var e = ".sheet-grab{display:none}@media (max-width:600px){.sheet-grab{display:block;flex-shrink:0;width:36px;height:4px;margin:8px auto 0;border-radius:2px;background:currentColor;opacity:.3}}dialog.sheet-dragging{transition:none!important}dialog.sheet-settling{transition:transform .22s cubic-bezier(.2,.8,.2,1)}", t = "input, select, textarea, [role=slider]";
function n(e) {
	let t = e.createElement("div");
	return t.className = "sheet-grab", t.setAttribute("aria-hidden", "true"), t;
}
function r(e, { close: n = () => e.close(), top: r = ".sheet-grab", ownDrag: i = "" } = {}) {
	let a = e.ownerDocument.defaultView, o = () => a?.matchMedia?.("(max-width:600px)").matches, s = i ? `${t}, ${i}` : t, c = (t) => {
		for (let n = t; n && n !== e; n = n.parentElement) if (n.scrollTop > 0) return !0;
		return !1;
	}, l = null, u = (t) => e.style.setProperty("transform", t ? `translateY(${t}px)` : "");
	e.addEventListener("touchstart", (t) => {
		if (!o() || t.touches.length !== 1) return l = null;
		let n = t.target.closest?.("dialog");
		if (n && n !== e || t.target.closest?.(s)) return l = null;
		l = {
			y: t.touches[0].clientY,
			t: performance.now(),
			dy: 0,
			active: !1,
			fromTop: !!t.target.closest?.(r),
			scrolled: c(t.target)
		};
	}, { passive: !0 }), e.addEventListener("touchmove", (t) => {
		if (!l) return;
		let n = t.touches[0].clientY - l.y;
		if (l.active) t.preventDefault(), l.dy = Math.max(0, n), u(l.dy);
		else {
			if (n < -6) return l = null;
			if (n < 8 || !l.fromTop && l.scrolled) return;
			l.active = !0, l.y += n, l.t = performance.now(), e.classList.add("sheet-dragging");
		}
	}, { passive: !1 });
	let d = () => {
		let t = l;
		if (l = null, !t?.active) return;
		e.classList.remove("sheet-dragging");
		let r = t.dy / Math.max(1, performance.now() - t.t), i = a?.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
		if (t.dy > Math.min(140, e.offsetHeight * .25) || r > .8) {
			if (i) return n();
			e.classList.add("sheet-settling"), u(e.offsetHeight), setTimeout(n, 220);
		} else e.classList.add("sheet-settling"), u(0), setTimeout(() => e.classList.remove("sheet-settling"), 240);
	};
	e.addEventListener("touchend", d), e.addEventListener("touchcancel", d);
}
function i(e) {
	e.tabIndex = -1, e.focus({ preventScroll: !0 });
}
// shared/light.mjs
var a = [
	"hs",
	"xy",
	"rgb",
	"rgbw",
	"rgbww"
];
function o(e) {
	let t = e?.attributes || {}, n = t.supported_color_modes || [], r = e?.entity_id?.startsWith("light."), i = Number.isFinite(t.min_color_temp_kelvin) ? t.min_color_temp_kelvin : 2e3, o = Number.isFinite(t.max_color_temp_kelvin) ? t.max_color_temp_kelvin : 6535;
	return {
		brightness: !!r && n.some((e) => [
			"brightness",
			"color_temp",
			"white",
			...a
		].includes(e)),
		color: !!r && n.some((e) => a.includes(e)),
		temperature: !!r && n.includes("color_temp") && i > 0 && o >= i,
		minKelvin: i,
		maxKelvin: o,
		effects: r && t.supported_features & 4 && Array.isArray(t.effect_list) ? t.effect_list.filter((e) => typeof e == "string") : [],
		transition: !!r && !!(t.supported_features & 32)
	};
}
var s = (e) => /^#[0-9a-f]{6}$/i.test(e) ? [
	1,
	3,
	5
].map((t) => parseInt(e.slice(t, t + 2), 16)) : [
	255,
	240,
	212
];
function c(e) {
	let t = Math.max(1e3, Math.min(4e4, e)) / 100;
	return [
		t <= 66 ? 255 : 329.698727446 * (t - 60) ** -.1332047592,
		t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -.0755148492,
		t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
	].map((e) => Math.round(Math.max(0, Math.min(255, e))));
}
function l(e, t = "#fff0d4") {
	let n = e?.attributes || {}, r = Number.isFinite(n.color_temp_kelvin) ? n.color_temp_kelvin : 3e3, i;
	if (n.color_mode === "color_temp") i = c(r);
	else if (Array.isArray(n.rgb_color) && n.rgb_color.length === 3) i = n.rgb_color;
	else if (Array.isArray(n.rgbw_color)) {
		let [e, t, r, a] = n.rgbw_color;
		i = [
			e + a,
			t + a,
			r + a
		].map((e) => Math.min(255, e));
	} else if (Array.isArray(n.rgbww_color)) {
		let [e, t, r, a, o] = n.rgbww_color, s = c(n.min_color_temp_kelvin || 2e3), l = c(n.max_color_temp_kelvin || 6535);
		i = [
			e,
			t,
			r
		].map((e, t) => Math.min(255, e + s[t] * o / 255 + l[t] * a / 255));
	} else i = s(t);
	return {
		rgb: i,
		colorMode: n.color_mode || "rgb",
		colorTempKelvin: r,
		effect: n.effect || ""
	};
}
export { e as a, n as c, o as i, s as n, r as o, c as r, i as s, l as t };
