// shared/light.mjs
var e = [
	"hs",
	"xy",
	"rgb",
	"rgbw",
	"rgbww"
];
function t(t) {
	let n = t?.attributes || {}, r = n.supported_color_modes || [], i = t?.entity_id?.startsWith("light."), a = Number.isFinite(n.min_color_temp_kelvin) ? n.min_color_temp_kelvin : 2e3, o = Number.isFinite(n.max_color_temp_kelvin) ? n.max_color_temp_kelvin : 6535;
	return {
		brightness: !!i && r.some((t) => [
			"brightness",
			"color_temp",
			"white",
			...e
		].includes(t)),
		color: !!i && r.some((t) => e.includes(t)),
		temperature: !!i && r.includes("color_temp") && a > 0 && o >= a,
		minKelvin: a,
		maxKelvin: o,
		effects: i && n.supported_features & 4 && Array.isArray(n.effect_list) ? n.effect_list.filter((e) => typeof e == "string") : [],
		transition: !!i && !!(n.supported_features & 32)
	};
}
var n = (e) => /^#[0-9a-f]{6}$/i.test(e) ? [
	1,
	3,
	5
].map((t) => parseInt(e.slice(t, t + 2), 16)) : [
	255,
	240,
	212
];
function r(e) {
	let t = Math.max(1e3, Math.min(4e4, e)) / 100;
	return [
		t <= 66 ? 255 : 329.698727446 * (t - 60) ** -.1332047592,
		t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -.0755148492,
		t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
	].map((e) => Math.round(Math.max(0, Math.min(255, e))));
}
function i(e, t = "#fff0d4") {
	let i = e?.attributes || {}, a = Number.isFinite(i.color_temp_kelvin) ? i.color_temp_kelvin : 3e3, o;
	if (i.color_mode === "color_temp") o = r(a);
	else if (Array.isArray(i.rgb_color) && i.rgb_color.length === 3) o = i.rgb_color;
	else if (Array.isArray(i.rgbw_color)) {
		let [e, t, n, r] = i.rgbw_color;
		o = [
			e + r,
			t + r,
			n + r
		].map((e) => Math.min(255, e));
	} else if (Array.isArray(i.rgbww_color)) {
		let [e, t, n, a, s] = i.rgbww_color, c = r(i.min_color_temp_kelvin || 2e3), l = r(i.max_color_temp_kelvin || 6535);
		o = [
			e,
			t,
			n
		].map((e, t) => Math.min(255, e + c[t] * s / 255 + l[t] * a / 255));
	} else o = n(t);
	return {
		rgb: o,
		colorMode: i.color_mode || "rgb",
		colorTempKelvin: a,
		effect: i.effect || ""
	};
}
export { t as i, n, r, i as t };
