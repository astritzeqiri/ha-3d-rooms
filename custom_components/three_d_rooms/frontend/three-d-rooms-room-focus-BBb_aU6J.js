// shared/scene-sessions.mjs
var e = /* @__PURE__ */ new WeakMap();
function t(t) {
	e.delete(t);
}
function n(e, t = "original") {
	return `${e.id}:${e.sceneRevision || e.importedAt || "legacy"}:${t}`;
}
// shared/climate.mjs
function r(e) {
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
function i(e = {}) {
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
// shared/marker-icon-paths.mjs
var a = {
	"mdi:lightbulb": "M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z",
	"mdi:lightbulb-outline": "M12,2A7,7 0 0,1 19,9C19,11.38 17.81,13.47 16,14.74V17A1,1 0 0,1 15,18H9A1,1 0 0,1 8,17V14.74C6.19,13.47 5,11.38 5,9A7,7 0 0,1 12,2M9,21V20H15V21A1,1 0 0,1 14,22H10A1,1 0 0,1 9,21M12,4A5,5 0 0,0 7,9C7,11.05 8.23,12.81 10,13.58V16H14V13.58C15.77,12.81 17,11.05 17,9A5,5 0 0,0 12,4Z",
	"mdi:ceiling-light": "M8,9H11V4H13V9H16L20,17H4L8,9M14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18H14Z",
	"mdi:lamp": "M8,2H16L20,14H4L8,2M11,15H13V20H18V22H6V20H11V15Z",
	"mdi:floor-lamp": "M15,2L17,9H7L9,2M11,10H13V20H16V22H8V20H11V10Z",
	"mdi:desk-lamp": "M10.85,2L9.18,4.5L10.32,5.25L7.14,10C7.1,10 7.05,10 7,10A2,2 0 0,0 5,12C5,12.94 5.66,13.75 6.58,13.95L10.62,20H7V22H17V20H13L8.53,13.28C8.83,12.92 9,12.47 9,12C9,11.7 8.93,11.4 8.8,11.13L12,6.37C11.78,8.05 12.75,9.89 14.45,11L18.89,4.37C17.2,3.24 15.12,3.04 13.65,3.87L10.85,2M18.33,7L16.67,9.5C17.35,9.95 18.29,9.77 18.75,9.08C19.21,8.39 19,7.46 18.33,7Z",
	"mdi:wall-sconce": "M11,4L7,13H19L15,4H11M4,14V22H6V19H14V14H12V17H6V14H4Z",
	"mdi:outdoor-lamp": "M15 22H13C11.9 22 11 21.1 11 20V15H17V20C17 21.1 16.1 22 15 22M7 14H21L15 9.71V6C15 4.39 13.94 2 11 2S7 4.39 7 6C7 6.45 6.81 7 6 7H5V3H3V12H5V9H6C8.2 9 9 7.21 9 6C9 5.67 9.1 4 11 4C12.83 4 13 5.54 13 6V9.71L7 14Z",
	"mdi:led-strip": "M2.81,8.46L14.83,20.5L15.54,19.78L16.95,21.19L18.36,19.78L16.95,18.36L18.36,16.95L19.78,18.36L21.19,16.95L19.78,15.54L20.5,14.83L8.46,2.81L2.81,8.46M5.64,8.46L8.46,5.64L17.66,14.83L14.83,17.66L5.64,8.46M7.05,8.46L8.46,9.88L9.88,8.46L8.46,7.05L7.05,8.46M9.17,10.59L10.59,12L12,10.59L10.59,9.17L9.17,10.59M11.29,12.71L12.71,14.12L14.12,12.71L12.71,11.29L11.29,12.71M13.41,14.83L14.83,16.24L16.24,14.83L14.83,13.41L13.41,14.83Z",
	"mdi:string-lights": "M22.56 11.39C22.36 10.59 21.82 9.85 21.05 9.44L20.63 7.74C21.11 7.58 21.57 7.41 22 7.23V5C20 6.07 16.53 7.03 12 7.03S4 6.07 2 5V7.23C2.43 7.41 2.89 7.58 3.37 7.74L2.95 9.44C2.18 9.85 1.64 10.59 1.44 11.39C.905 13.57 .385 17.31 2.92 17.93C4 18.2 6 17.89 7.27 12.82C7.46 12 7.33 11.12 6.84 10.39L7.26 8.67C8.14 8.81 9.05 8.9 10 8.96V10.74C9.35 11.33 9 12.17 9 13C9 15.24 9.39 19 12 19C13.12 19 15 18.22 15 13C15 12.17 14.65 11.33 14 10.74V8.96C14.95 8.9 15.86 8.81 16.74 8.67L17.16 10.39C16.67 11.12 16.54 12 16.73 12.82C18 17.89 20 18.2 21.08 17.93C23.61 17.31 23.09 13.57 22.56 11.39M5.81 12.47C5.81 12.47 4.74 16.84 3.28 16.5C1.82 16.12 2.9 11.75 2.9 11.75S3.26 10.29 4.71 10.65 5.81 12.47 5.81 12.47M12 17.5C10.5 17.5 10.5 13 10.5 13S10.5 11.5 12 11.5 13.5 13 13.5 13 13.5 17.5 12 17.5M20.72 16.5C19.27 16.84 18.19 12.47 18.19 12.47S17.83 11 19.29 10.65 21.1 11.75 21.1 11.75 22.18 16.12 20.72 16.5Z",
	"mdi:door": "M8,3C6.89,3 6,3.89 6,5V21H18V5C18,3.89 17.11,3 16,3H8M8,5H16V19H8V5M13,11V13H15V11H13Z",
	"mdi:door-open": "M12,3C10.89,3 10,3.89 10,5H3V19H2V21H22V19H21V5C21,3.89 20.11,3 19,3H12M12,5H19V19H12V5M5,11H7V13H5V11Z",
	"mdi:door-sliding": "M10 13H8V11H10V13M16 11H14V13H16V11M21 19V21H3V19H4V5C4 3.9 4.9 3 6 3H18C19.1 3 20 3.9 20 5V19H21M11 5H6V19H11V5M18 5H13V19H18V5Z",
	"mdi:garage": "M19,20H17V11H7V20H5V9L12,5L19,9V20M8,12H16V14H8V12M8,15H16V17H8V15M16,18V20H8V18H16Z",
	"mdi:window-closed-variant": "M21 20V2H3V20H1V23H23V20M19 4V11H13V4M5 4H11V11H5M5 20V13H11V20M13 20V13H19V20Z",
	"mdi:window-open-variant": "M21 20V2H3V20H1V23H23V20M19 4V11H17V4M5 4H7V11H5M5 20V13H7V20M9 20V4H15V20M17 20V13H19V20Z",
	"mdi:blinds-horizontal": "M20 19V3H4V19H2V21H22V19H20M16 9H18V11H16V9M14 11H6V9H14V11M18 7H16V5H18V7M14 5V7H6V5H14M6 19V13H14V14.82C13.55 15.14 13.25 15.66 13.25 16.25C13.25 17.22 14.03 18 15 18S16.75 17.22 16.75 16.25C16.75 15.66 16.45 15.13 16 14.82V13H18V19H6Z",
	"mdi:roller-shade": "M20 19V3H4V19H2V21H22V19H20M6 19V13H11V14.8C10.6 15.1 10.2 15.6 10.2 16.2C10.2 17.2 11 18 12 18S13.8 17.2 13.8 16.2C13.8 15.6 13.5 15.1 13 14.8V13H18V19H6Z",
	"mdi:curtains": "M23 3H1V1H23V3M2 22H6C6 19 4 17 4 17C10 13 11 4 11 4H2V22M22 4H13C13 4 14 13 20 17C20 17 18 19 18 22H22V4Z",
	"mdi:lock": "M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z",
	"mdi:lock-open-variant": "M18 1C15.24 1 13 3.24 13 6V8H4C2.9 8 2 8.89 2 10V20C2 21.11 2.9 22 4 22H16C17.11 22 18 21.11 18 20V10C18 8.9 17.11 8 16 8H15V6C15 4.34 16.34 3 18 3C19.66 3 21 4.34 21 6V8H23V6C23 3.24 20.76 1 18 1M10 13C11.1 13 12 13.89 12 15C12 16.11 11.11 17 10 17C8.9 17 8 16.11 8 15C8 13.9 8.9 13 10 13Z",
	"mdi:air-conditioner": "M6.59,0.66C8.93,-1.15 11.47,1.06 12.04,4.5C12.47,4.5 12.89,4.62 13.27,4.84C13.79,4.24 14.25,3.42 14.07,2.5C13.65,0.35 16.06,-1.39 18.35,1.58C20.16,3.92 17.95,6.46 14.5,7.03C14.5,7.46 14.39,7.89 14.16,8.27C14.76,8.78 15.58,9.24 16.5,9.06C18.63,8.64 20.38,11.04 17.41,13.34C15.07,15.15 12.53,12.94 11.96,9.5C11.53,9.5 11.11,9.37 10.74,9.15C10.22,9.75 9.75,10.58 9.93,11.5C10.35,13.64 7.94,15.39 5.65,12.42C3.83,10.07 6.05,7.53 9.5,6.97C9.5,6.54 9.63,6.12 9.85,5.74C9.25,5.23 8.43,4.76 7.5,4.94C5.37,5.36 3.62,2.96 6.59,0.66M5,16H7A2,2 0 0,1 9,18V24H7V22H5V24H3V18A2,2 0 0,1 5,16M5,18V20H7V18H5M12.93,16H15L12.07,24H10L12.93,16M18,16H21V18H18V22H21V24H18A2,2 0 0,1 16,22V18A2,2 0 0,1 18,16Z",
	"mdi:fan": "M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12.5,2C17,2 17.11,5.57 14.75,6.75C13.76,7.24 13.32,8.29 13.13,9.22C13.61,9.42 14.03,9.73 14.35,10.13C18.05,8.13 22.03,8.92 22.03,12.5C22.03,17 18.46,17.1 17.28,14.73C16.78,13.74 15.72,13.3 14.79,13.11C14.59,13.59 14.28,14 13.88,14.34C15.87,18.03 15.08,22 11.5,22C7,22 6.91,18.42 9.27,17.24C10.25,16.75 10.69,15.71 10.89,14.79C10.4,14.59 9.97,14.27 9.65,13.87C5.96,15.85 2,15.07 2,11.5C2,7 5.56,6.89 6.74,9.26C7.24,10.25 8.29,10.68 9.22,10.87C9.41,10.39 9.73,9.97 10.14,9.65C8.15,5.96 8.94,2 12.5,2Z",
	"mdi:thermometer": "M15 13V5A3 3 0 0 0 9 5V13A5 5 0 1 0 15 13M12 4A1 1 0 0 1 13 5V8H11V5A1 1 0 0 1 12 4Z",
	"mdi:radiator": "M7.95,3L6.53,5.19L7.95,7.4H7.94L5.95,10.5L4.22,9.6L5.64,7.39L4.22,5.19L6.22,2.09L7.95,3M13.95,2.89L12.53,5.1L13.95,7.3L13.94,7.31L11.95,10.4L10.22,9.5L11.64,7.3L10.22,5.1L12.22,2L13.95,2.89M20,2.89L18.56,5.1L20,7.3V7.31L18,10.4L16.25,9.5L17.67,7.3L16.25,5.1L18.25,2L20,2.89M2,22V14A2,2 0 0,1 4,12H20A2,2 0 0,1 22,14V22H20V20H4V22H2M6,14A1,1 0 0,0 5,15V17A1,1 0 0,0 6,18A1,1 0 0,0 7,17V15A1,1 0 0,0 6,14M10,14A1,1 0 0,0 9,15V17A1,1 0 0,0 10,18A1,1 0 0,0 11,17V15A1,1 0 0,0 10,14M14,14A1,1 0 0,0 13,15V17A1,1 0 0,0 14,18A1,1 0 0,0 15,17V15A1,1 0 0,0 14,14M18,14A1,1 0 0,0 17,15V17A1,1 0 0,0 18,18A1,1 0 0,0 19,17V15A1,1 0 0,0 18,14Z",
	"mdi:television": "M21,17H3V5H21M21,3H3A2,2 0 0,0 1,5V17A2,2 0 0,0 3,19H8V21H16V19H21A2,2 0 0,0 23,17V5A2,2 0 0,0 21,3Z",
	"mdi:speaker": "M12,12A3,3 0 0,0 9,15A3,3 0 0,0 12,18A3,3 0 0,0 15,15A3,3 0 0,0 12,12M12,20A5,5 0 0,1 7,15A5,5 0 0,1 12,10A5,5 0 0,1 17,15A5,5 0 0,1 12,20M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8C10.89,8 10,7.1 10,6C10,4.89 10.89,4 12,4M17,2H7C5.89,2 5,2.89 5,4V20A2,2 0 0,0 7,22H17A2,2 0 0,0 19,20V4C19,2.89 18.1,2 17,2Z",
	"mdi:power-plug": "M16,7V3H14V7H10V3H8V7H8C7,7 6,8 6,9V14.5L9.5,18V21H14.5V18L18,14.5V9C18,8 17,7 16,7Z",
	"mdi:power": "M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13",
	"mdi:flash": "M7,2V13H10V22L17,10H13L17,2H7Z",
	"mdi:play": "M8,5.14V19.14L19,12.14L8,5.14Z",
	"mdi:desk": "M3 6H21C21.55 6 22 6.45 22 7C22 7.55 21.55 8 21 8V19H19V17H15V19H13V8H5V19H3V8C2.45 8 2 7.55 2 7C2 6.45 2.45 6 3 6M16 10.5V11H18V10.5C18 10.22 17.78 10 17.5 10H16.5C16.22 10 16 10.22 16 10.5M16 14.5V15H18V14.5C18 14.22 17.78 14 17.5 14H16.5C16.22 14 16 14.22 16 14.5Z",
	"mdi:bed": "M19,7H11V14H3V5H1V20H3V17H21V20H23V11A4,4 0 0,0 19,7M7,13A3,3 0 0,0 10,10A3,3 0 0,0 7,7A3,3 0 0,0 4,10A3,3 0 0,0 7,13Z",
	"mdi:sofa": "M12.5 7C12.5 5.89 13.39 5 14.5 5H18C19.1 5 20 5.9 20 7V9.16C18.84 9.57 18 10.67 18 11.97V14H12.5V7M6 11.96V14H11.5V7C11.5 5.89 10.61 5 9.5 5H6C4.9 5 4 5.9 4 7V9.15C5.16 9.56 6 10.67 6 11.96M20.66 10.03C19.68 10.19 19 11.12 19 12.12V15H5V12C5 10.9 4.11 10 3 10S1 10.9 1 12V17C1 18.1 1.9 19 3 19V21H5V19H19V21H21V19C22.1 19 23 18.1 23 17V12C23 10.79 21.91 9.82 20.66 10.03Z",
	"mdi:home": "M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z",
	"mdi:star": "M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"
}, o = [
	["Lights", [
		[
			"mdi:lightbulb",
			"Bulb",
			a["mdi:lightbulb"]
		],
		[
			"mdi:lightbulb-outline",
			"Bulb outline",
			a["mdi:lightbulb-outline"]
		],
		[
			"mdi:ceiling-light",
			"Ceiling light",
			a["mdi:ceiling-light"]
		],
		[
			"mdi:lamp",
			"Table lamp",
			a["mdi:lamp"]
		],
		[
			"mdi:floor-lamp",
			"Floor lamp",
			a["mdi:floor-lamp"]
		],
		[
			"mdi:desk-lamp",
			"Desk lamp",
			a["mdi:desk-lamp"]
		],
		[
			"mdi:wall-sconce",
			"Wall light",
			a["mdi:wall-sconce"]
		],
		[
			"mdi:outdoor-lamp",
			"Outdoor light",
			a["mdi:outdoor-lamp"]
		],
		[
			"mdi:led-strip",
			"LED strip",
			a["mdi:led-strip"]
		],
		[
			"mdi:string-lights",
			"String lights",
			a["mdi:string-lights"]
		]
	]],
	["Doors & windows", [
		[
			"mdi:door",
			"Door",
			a["mdi:door"]
		],
		[
			"mdi:door-open",
			"Open door",
			a["mdi:door-open"]
		],
		[
			"mdi:door-sliding",
			"Sliding door",
			a["mdi:door-sliding"]
		],
		[
			"mdi:garage",
			"Garage",
			a["mdi:garage"]
		],
		[
			"mdi:window-closed-variant",
			"Window",
			a["mdi:window-closed-variant"]
		],
		[
			"mdi:window-open-variant",
			"Open window",
			a["mdi:window-open-variant"]
		],
		[
			"mdi:blinds-horizontal",
			"Blinds",
			a["mdi:blinds-horizontal"]
		],
		[
			"mdi:roller-shade",
			"Roller shade",
			a["mdi:roller-shade"]
		],
		[
			"mdi:curtains",
			"Curtains",
			a["mdi:curtains"]
		],
		[
			"mdi:lock",
			"Lock",
			a["mdi:lock"]
		],
		[
			"mdi:lock-open-variant",
			"Unlocked",
			a["mdi:lock-open-variant"]
		]
	]],
	["Other", [
		[
			"mdi:air-conditioner",
			"Air conditioner",
			a["mdi:air-conditioner"]
		],
		[
			"mdi:fan",
			"Fan",
			a["mdi:fan"]
		],
		[
			"mdi:thermometer",
			"Thermometer",
			a["mdi:thermometer"]
		],
		[
			"mdi:radiator",
			"Radiator",
			a["mdi:radiator"]
		],
		[
			"mdi:television",
			"TV",
			a["mdi:television"]
		],
		[
			"mdi:speaker",
			"Speaker",
			a["mdi:speaker"]
		],
		[
			"mdi:power-plug",
			"Plug",
			a["mdi:power-plug"]
		],
		[
			"mdi:power",
			"Power",
			a["mdi:power"]
		],
		[
			"mdi:flash",
			"Flash",
			a["mdi:flash"]
		],
		[
			"mdi:play",
			"Play",
			a["mdi:play"]
		],
		[
			"mdi:desk",
			"Desk",
			a["mdi:desk"]
		],
		[
			"mdi:bed",
			"Bed",
			a["mdi:bed"]
		],
		[
			"mdi:sofa",
			"Sofa",
			a["mdi:sofa"]
		],
		[
			"mdi:home",
			"Home",
			a["mdi:home"]
		],
		[
			"mdi:star",
			"Star",
			a["mdi:star"]
		]
	]]
], s = new Map(o.flatMap(([, e]) => e.map(([e, t, n]) => [e, {
	label: t,
	path: n
}]))), c = /^[a-z0-9][a-z0-9_-]{0,31}:[A-Za-z0-9][A-Za-z0-9_.-]{0,95}$/;
function l(e) {
	return typeof e == "string" && c.test(e);
}
function u(e) {
	let t = s.get(e);
	return t ? `<path d="${t.path}"/>` : void 0;
}
function d(e = {}, t = {}, n = !1) {
	return n ? e.icon ?? t.icon : e.icon_off ?? e.icon ?? t.iconOff ?? t.icon;
}
var f = {
	min: 24,
	max: 64,
	standard: 32
}, p = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/, m = /^[a-z0-9][a-z0-9_-]{0,79}$/;
function h(e) {
	if (!e || typeof e != "object" || Array.isArray(e) || Object.keys(e).length > 48) throw Error("Use at most 48 extra entities in one view.");
	let t = {};
	for (let [n, r] of Object.entries(e)) {
		if (!m.test(n) || ["constructor", "prototype"].includes(n) || !r || typeof r != "object" || Array.isArray(r) || Object.keys(r).some((e) => ![
			"entity",
			"position",
			"room",
			"name",
			"icon",
			"icon_off",
			"size",
			"show_state",
			"visible"
		].includes(e))) throw Error("Invalid extra entity settings.");
		if (typeof r.entity != "string" || r.entity.length > 255 || !p.test(r.entity)) throw Error("Choose a Home Assistant entity such as sensor.hallway.");
		if (!Array.isArray(r.position) || r.position.length !== 3 || r.position.some((e) => !Number.isFinite(e) || Math.abs(e) > 1e3)) throw Error("An extra entity position must be three numbers.");
		if (r.room !== void 0 && !m.test(r.room)) throw Error("Invalid room for an extra entity.");
		if (r.name !== void 0 && (typeof r.name != "string" || r.name.length > 80)) throw Error("An extra entity name must be at most 80 characters.");
		if (r.icon_off !== void 0 && !l(r.icon_off) || r.icon !== void 0 && !l(r.icon)) throw Error("Choose a Home Assistant icon such as mdi:thermometer or local:front-door.");
		if (r.size !== void 0 && (!Number.isInteger(r.size) || r.size < f.min || r.size > f.max)) throw Error(`An extra entity size must be ${f.min}–${f.max} pixels.`);
		if (r.show_state !== void 0 && typeof r.show_state != "boolean") throw Error("Showing the state must be true or false.");
		if (r.visible !== void 0 && typeof r.visible != "boolean") throw Error("Visibility must be true or false.");
		let e = r.name?.trim();
		t[n] = {
			entity: r.entity,
			position: [...r.position],
			...r.room ? { room: r.room } : {},
			...e ? { name: e } : {},
			...r.icon ? { icon: r.icon } : {},
			...r.icon_off ? { icon_off: r.icon_off } : {},
			...r.size === void 0 ? {} : { size: r.size },
			...r.show_state === void 0 ? {} : { show_state: r.show_state },
			...r.visible === void 0 ? {} : { visible: r.visible }
		};
	}
	return t;
}
function g(e = {}, t = {}) {
	return {
		...e,
		size: e.size ?? t?.size ?? f.standard,
		show_state: e.show_state ?? t?.show_label ?? !0,
		visible: e.visible ?? t?.visible ?? !0
	};
}
var _ = /* @__PURE__ */ new Set([
	"light",
	"switch",
	"input_boolean",
	"fan",
	"automation",
	"script",
	"siren",
	"humidifier"
]), v = {
	button: "press",
	input_button: "press",
	scene: "turn_on"
};
function y(e) {
	let t = String(e || "").split(".")[0];
	return _.has(t) ? {
		domain: t,
		service: t === "script" ? "turn_on" : "toggle"
	} : v[t] ? {
		domain: t,
		service: v[t]
	} : null;
}
var b = /* @__PURE__ */ new Set([
	"on",
	"open",
	"opening",
	"closing",
	"home",
	"playing",
	"heat",
	"cool",
	"heat_cool",
	"auto",
	"dry",
	"fan_only",
	"cleaning",
	"detected"
]);
function x(e) {
	let { state: t, attributes: n = {} } = e;
	if (n.device_class === "timestamp") {
		let e = new Date(t);
		if (!Number.isNaN(e.getTime())) {
			let t = e.toDateString() === (/* @__PURE__ */ new Date()).toDateString();
			return e.toLocaleString(void 0, {
				...t ? {} : { weekday: "short" },
				hour: "2-digit",
				minute: "2-digit"
			});
		}
	}
	let r = n.unit_of_measurement;
	return r ? `${t} ${r}` : String(t).replace(/_/g, " ");
}
function S(e, t) {
	if (!e) return {
		active: !1,
		unavailable: !0,
		badge: "?",
		description: "not found"
	};
	let n = ["unavailable", "unknown"].includes(e.state), r;
	try {
		r = t?.(e);
	} catch {
		r = void 0;
	}
	r ||= x(e);
	let i = e.entity_id.split(".")[0];
	return {
		active: !n && (i === "lock" ? e.state === "locked" : b.has(e.state) && i !== "sensor"),
		unavailable: n,
		badge: r.length > 14 ? r.slice(0, 13) + "…" : r,
		description: r
	};
}
function C(e, t) {
	return e.visible === !1 ? !1 : !e.room || !t || t.has(e.room);
}
var ee = {
	temperature: "mdi:thermometer",
	humidity: "mdi:water-percent",
	timestamp: "mdi:clock-outline",
	power: "mdi:flash",
	energy: "mdi:lightning-bolt",
	battery: "mdi:battery",
	illuminance: "mdi:brightness-5",
	pressure: "mdi:gauge",
	carbon_dioxide: "mdi:molecule-co2",
	door: "mdi:door",
	garage_door: "mdi:garage",
	garage: "mdi:garage",
	window: "mdi:window-closed",
	motion: "mdi:motion-sensor",
	occupancy: "mdi:home-account",
	moisture: "mdi:water",
	smoke: "mdi:smoke-detector"
}, te = {
	sensor: "mdi:eye",
	binary_sensor: "mdi:checkbox-blank-circle-outline",
	switch: "mdi:toggle-switch-variant",
	input_boolean: "mdi:toggle-switch-variant",
	light: "mdi:lightbulb",
	cover: "mdi:window-shutter",
	lock: "mdi:lock",
	climate: "mdi:thermostat",
	fan: "mdi:fan",
	media_player: "mdi:cast",
	scene: "mdi:palette",
	script: "mdi:script-text",
	automation: "mdi:robot",
	button: "mdi:gesture-tap-button",
	input_button: "mdi:gesture-tap-button",
	person: "mdi:account",
	device_tracker: "mdi:account",
	camera: "mdi:video",
	vacuum: "mdi:robot-vacuum",
	weather: "mdi:weather-partly-cloudy",
	sun: "mdi:white-balance-sunny",
	number: "mdi:ray-vertex",
	input_number: "mdi:ray-vertex",
	select: "mdi:format-list-bulleted",
	input_select: "mdi:format-list-bulleted",
	alarm_control_panel: "mdi:shield-home",
	water_heater: "mdi:water-boiler",
	humidifier: "mdi:air-humidifier",
	siren: "mdi:bullhorn",
	update: "mdi:package-up"
};
function w(e, t) {
	let n = String(e || "").split(".")[0];
	return ee[t?.attributes?.device_class] || te[n] || "mdi:information-outline";
}
// shared/marker-settings.mjs
var T = [
	"_defaults",
	"_rooms",
	"_entities"
];
function E(e) {
	if (e === void 0) return;
	if (!e || typeof e != "object" || Array.isArray(e) || Object.keys(e).filter((e) => !T.includes(e)).length > 128) throw Error("Use a device-marker settings object with at most 128 controls.");
	let t = {};
	for (let [n, r] of Object.entries(e)) if (n === "_rooms") {
		let e = k(r);
		Object.keys(e).length && (t._rooms = e);
	} else if (n === "_entities") {
		let e = h(r);
		Object.keys(e).length && (t._entities = e);
	} else {
		if (n !== "_defaults" && !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(n) || ["constructor", "prototype"].includes(n) || !r || typeof r != "object" || Array.isArray(r) || Object.keys(r).some((e) => ![
			"visible",
			"show_label",
			"size",
			"placement",
			"offset",
			"icon",
			"icon_off"
		].includes(e))) throw Error("Invalid device-marker settings.");
		if (n === "_defaults" && r.offset !== void 0) throw Error("View defaults cannot contain a position offset.");
		if (n === "_defaults" && (r.icon !== void 0 || r.icon_off !== void 0)) throw Error("Choose icons per device, not as a view default.");
		for (let e of ["icon", "icon_off"]) if (r[e] !== void 0 && !l(r[e])) throw Error("Choose a Home Assistant icon such as mdi:door or local:front-door.");
		for (let e of ["visible", "show_label"]) if (r[e] !== void 0 && typeof r[e] != "boolean") throw Error("Marker visibility and labels must be true or false.");
		if (r.size !== void 0 && (!Number.isInteger(r.size) || r.size < 24 || r.size > 64)) throw Error("Marker size must be 24–64 pixels.");
		if (r.placement !== void 0 && !["room", "tray"].includes(r.placement)) throw Error("Choose room or tray for a device control.");
		if (r.offset !== void 0 && (!Array.isArray(r.offset) || r.offset.length !== 3 || r.offset.some((e) => !Number.isFinite(e) || Math.abs(e) > 1e3))) throw Error("Marker offsets must be three finite values within 1000 metres.");
		t[n] = structuredClone(r);
	}
	return t;
}
var D = [
	"auto",
	"always",
	"never"
], O = {
	min: 20,
	max: 64,
	standard: 30
};
function k(e) {
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
		if (r.mode !== void 0 && !D.includes(r.mode)) throw Error("Choose when the room button shows.");
		if (r.position !== void 0 && (!Array.isArray(r.position) || r.position.length !== 3 || r.position.some((e) => !Number.isFinite(e) || Math.abs(e) > 1e3))) throw Error("A room button position must be three numbers.");
		if (r.heading !== void 0 && (!Number.isFinite(r.heading) || r.heading < 0 || r.heading >= 360)) throw Error("A room view heading must be 0 to under 360 degrees.");
		if (r.tilt !== void 0 && (!Number.isFinite(r.tilt) || r.tilt < 0 || r.tilt > 180)) throw Error("A room view tilt must be 0 to 180 degrees.");
		if (r.size !== void 0 && (!Number.isInteger(r.size) || r.size < O.min || r.size > O.max)) throw Error(`A room button size must be ${O.min}–${O.max} pixels.`);
		let e = {
			...r.mode && r.mode !== "auto" ? { mode: r.mode } : {},
			...r.position ? { position: [...r.position] } : {},
			...r.heading === void 0 ? {} : { heading: r.heading },
			...r.tilt === void 0 ? {} : { tilt: r.tilt },
			...r.size !== void 0 && r.size !== O.standard ? { size: r.size } : {}
		};
		Object.keys(e).length && (t[n] = e);
	}
	return t;
}
function A(e, t) {
	return {
		visible: !0,
		show_label: !0,
		size: 32,
		placement: "room",
		...e?._defaults || {},
		...e?.[t] || {}
	};
}
function j(e, t = [
	0,
	0,
	0
]) {
	return e.map((e, n) => e + t[n]);
}
function ne(e, t, n, r) {
	let i = t.size;
	return {
		left: Math.max(0, Math.min(n - i, e.x - i / 2)),
		top: Math.max(0, Math.min(r - i - (t.show_label ? 16 : 0), e.y - i / 2))
	};
}
function re(e, t) {
	let n = (t ? t.filter((e) => !e.hidden && e.lightGroupPrimary !== !1).map((e) => e.id) : Object.keys(e || {}).filter((e) => !T.includes(e))).filter((t) => {
		let n = A(e, t);
		return n.visible && n.placement === "tray";
	}).length;
	return n ? n * 76 + 24 : 0;
}
// shared/device.mjs
var M = (e, t) => (e.devices || []).find((e) => [
	e.height,
	e.motion,
	...e.macros
].includes(t)), N = (e, t, n) => e.deviceSettings?.[t.id]?.macroNames?.[n] || "";
// shared/workspace.mjs
function P(e) {
	let t = String(e ?? "");
	return t.replace(/\s*·\s*(?:(?:[\p{L}\p{N}]+\s+)?scan|edited)(?=\s*(?:·|$))/giu, "").trim() || t;
}
function F(e, t = "Device") {
	let n = e?.label || e?.name || t, r = e?.roomTitle ? `${e.roomTitle} · ` : "";
	return r && n.startsWith(r) ? `${P(e.roomTitle)} · ${n.slice(r.length)}` : n;
}
// shared/cover.mjs
function I(e) {
	let t = e?.entity_id?.startsWith("cover.") && e.attributes?.supported_features || 0;
	return {
		open: !!(t & 1),
		close: !!(t & 2),
		position: !!(t & 4),
		stop: !!(t & 8)
	};
}
function L(e) {
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
		motionPosition: r ?? (!t && e.state === "open" && !I(e).position ? 100 : void 0),
		unavailable: t,
		label: t ? "Unavailable" : r === void 0 ? e.state : `${Math.round(r)}% open`
	};
}
function R(e, t) {
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
var z = {
	locked: "Locked",
	unlocked: "Unlocked",
	locking: "Locking",
	unlocking: "Unlocking",
	jammed: "Jammed",
	open: "Open",
	opening: "Opening"
};
function B(e) {
	let t = e?.state, n = !e || !/^lock\./.test(e.entity_id || "") || !(t in z);
	return {
		state: n ? void 0 : t,
		locked: n ? void 0 : t === "locked" || t === "locking",
		moving: t === "locking" || t === "unlocking" || t === "opening",
		jammed: t === "jammed",
		needsCode: !!e?.attributes?.code_format,
		label: n ? "Unavailable" : z[t],
		unavailable: n
	};
}
function V(e, t) {
	e?.traverse?.((e) => {
		let n = e.userData?.lockTurn;
		if (!n) return;
		e.userData.lockRest ||= e.quaternion.clone();
		let [r, i, a] = n.axis, o = (t ? n.lockedAngle : 0) / 2, s = Math.sin(o), c = e.userData.lockRest;
		e.quaternion.copy(c), e.quaternion.multiply(new c.constructor(r * s, i * s, a * s, Math.cos(o))), e.updateMatrix?.();
	});
}
// shared/floor-view.mjs
function H(e, t, n, r = 0, i = 0) {
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
function U(e, t, n, r = 28, i = 0) {
	let a = H(e, t, n, r, i), o = Math.max(0, Math.min(180, r)) * Math.PI / 180, s = i * Math.PI / 180, c = [
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
var W = (e, t) => Math.hypot(...e.map((e, n) => e - t[n])), G = (e) => Number(e.toFixed(2)), K = (e) => e * 180 / Math.PI;
function q(e) {
	let t = (e) => Array.isArray(e) && e.length === 3 && e.every((e) => Number.isFinite(e) && Math.abs(e) < 1e4), n = (e) => Number.isFinite(e) && e > 0 && e <= 1e4;
	if (!e || !t(e.position) || !t(e.target) || !t(e.up) || Math.hypot(...e.up) < 1e-8 || W(e.position, e.target) < 1e-8 || !n(e.aspect) || !n(e.zoom) || !n(e.referenceZoom) || !Number.isFinite(e.heading) || e.heading < 0 || e.heading >= 360 || !Number.isFinite(e.tilt) || e.tilt < 0 || e.tilt > 180 || !["perspective", "orthographic"].includes(e.projection)) throw Error("Invalid saved camera view.");
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
function J({ position: e, target: t, up: n, aspect: r, zoom: i = 1, fov: a, halfHeight: o, min: s, max: c }) {
	let l = e.map((e, n) => e - t[n]), u = Math.hypot(...l), d = Math.hypot(l[0], l[2]) / u < 1e-8 && Math.hypot(n[0], n[2]) > 1e-8, f = l[1] >= 0 ? -1 : 1, p = G((K(d ? Math.atan2(f * n[0], f * n[2]) : Math.atan2(l[0], l[2])) + 360) % 360) % 360, m = G(K(Math.acos(Math.max(-1, Math.min(1, l[1] / u))))), h = o === void 0 ? "front" : "floor", g = (h === "floor" ? H : U)(s, c, r, m, p), _;
	_ = h === "floor" ? i * g.top / o : i * W(g.position, g.target) / u * Math.tan(g.fov * Math.PI / 360) / Math.tan(a * Math.PI / 360);
	let v = Number(Math.max(.01, Math.min(100, _)).toFixed(4));
	return {
		view: h,
		heading: p,
		tilt: m,
		zoom: v,
		camera: q({
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
function Y(e, t, n, r, i, a) {
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
function ie(e, { aspect: t, min: n, max: r, heading: i = e.heading, tilt: a = e.tilt, zoom: o = e.referenceZoom }) {
	let s = q(e), c = [...s.position], l = [...s.up];
	if (Math.abs(i - s.heading) > 1e-6 || Math.abs(a - s.tilt) > 1e-6) {
		let e = i * Math.PI / 180, t = a * Math.PI / 180, n = W(s.position, s.target), r = [
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
		zoom: s.zoom * o / s.referenceZoom * Y(s, c, l, t, n, r),
		...s.projection === "perspective" ? { fov: s.fov } : {
			left: -s.halfHeight * t,
			right: s.halfHeight * t,
			top: s.halfHeight,
			bottom: -s.halfHeight
		},
		near: .05,
		far: W(c, s.target) + 1e3
	};
}
// shared/render-profile.mjs
var ae = [
	"auto",
	"high",
	"low"
];
function X(e = globalThis) {
	if (e.navigator?.userAgentData?.mobile) return !0;
	let t = (t) => !!e.matchMedia?.(t)?.matches;
	return t("(pointer: coarse)") && !t("(any-pointer: fine)");
}
function Z({ quality: e = "auto", mobile: t = !1, devicePixelRatio: n = 1 } = {}) {
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
function oe(e = "auto", t = globalThis) {
	return Z({
		quality: e,
		mobile: X(t),
		devicePixelRatio: t.devicePixelRatio
	}).low ? "phone" : "full";
}
function se(e, t) {
	Number.isFinite(t) && e.traverse((e) => {
		let n = e.isLight && e.shadow;
		if (!n?.mapSize) return;
		let r = Math.min(n.mapSize.x, t), i = Math.min(n.mapSize.y, t);
		(r !== n.mapSize.x || i !== n.mapSize.y) && (n.mapSize.set(r, i), n.map?.dispose(), n.map = null);
	});
}
// shared/room-focus.mjs
function Q(e, t) {
	return e?.roomTitles?.[t] || e?.controls?.find((e) => e.sourceModel === t)?.roomTitle || "Room";
}
function $(e) {
	return !e?.houseView || e.focusRoom || (e.members?.length || 0) < 2 ? [] : e.members.map((t) => ({
		room: t.model,
		title: P(Q(e, t.model))
	}));
}
function ce(e, t) {
	let n = e?.members?.find((e) => e.model === t);
	return !n || !$(e).length ? null : {
		...e,
		title: Q(e, t),
		members: [n],
		controls: e.controls.filter((e) => e.sourceModel === t),
		houseFloor: null,
		focusRoom: t
	};
}
function le(e) {
	let t = null;
	for (let n of e) (!t || n.y > t.y) && (t = n);
	return t;
}
var ue = .6, de = .7;
function fe(e, t, n = !1) {
	return e === "always" || e !== "never" && t < (n ? de : ue);
}
function pe(e, t = 4) {
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
export { E as A, t as B, P as C, A as D, ne as E, y as F, e as H, u as I, d as L, g as M, C as N, re as O, S as P, i as R, F as S, N as T, n as V, B as _, Q as a, L as b, se as c, oe as d, J as f, U as g, H as h, ce as i, w as j, j as k, X as l, q as m, le as n, pe as o, ie as p, fe as r, ae as s, $ as t, Z as u, V as v, M as w, R as x, I as y, r as z };
