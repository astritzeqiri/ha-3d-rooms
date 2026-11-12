import { clearSceneAssets } from "../shared/scene-assets.mjs";
import { clearSceneDownloads, sceneOwner } from "../shared/scene-download.mjs";
import { CardLayout } from "./layout.js";
import { climateState } from "../shared/climate.mjs";
import {
  validateMarkers,
  markerSettings,
  markerLayout,
  markerTrayHeight,
} from "../shared/marker-settings.mjs";
import { resolveSavedView } from "../shared/saved-view.mjs";
import { deviceForControl, macroName } from "../shared/device.mjs";
import { deviceLabel } from "../shared/workspace.mjs";
import { loadProgress } from "../shared/load-progress.mjs";
import { roomRoute } from "../shared/room-route.mjs";
import { shortRoomTitle } from "../shared/workspace.mjs";
import { groupMarkers, roomCrowded } from "../shared/marker-groups.mjs";
import { coverFeatures } from "../shared/cover.mjs";
import { actionState } from "../shared/action.mjs";
import { numberState } from "../shared/number.mjs";
import {
  DESK_HTML,
  heightAt,
  heightRatio,
  snapHeight,
} from "./desk-dialog.mjs";
import {
  markerAppearance,
  applyMarkerTone,
  AC_ICON_PATH,
  LOCK_ICON_PATH,
} from "../shared/marker.mjs";
import { lockState } from "../shared/lock.mjs";
import { markerIconPath, stateIconName } from "../shared/marker-icons.mjs";
import { coverState } from "../shared/cover.mjs";
import { validateCameraSnapshot } from "../shared/camera-view.mjs";
import "./panel.js";
import "./editor.js";
import { SceneView } from "../web/scene.js";
import { entityAppearance, hexToRgb, kelvinToRgb } from "../shared/light.mjs";
import { connectModel } from "./transport.mjs";
import { selectHouseView } from "../shared/house-floors.mjs";
import {
  focusableRooms,
  roomTitleOf,
  roomButtonShows,
  roomFocusView,
  spreadButtons,
} from "../shared/room-focus.mjs";
import { QUALITIES } from "../shared/render-profile.mjs";
import {
  BACKDROP_CSS,
  DEFAULT_BACKGROUND,
  effectiveElevation,
  groundShadowEnabled,
  needsTransparentCanvas,
  paintBackdrop,
  tone,
  validateBackground,
} from "../shared/backdrop.mjs";
import {
  roomLights,
  roomLightSummary,
  roomLightCommands,
  roomDevices,
  allLights,
  PANEL_KINDS,
} from "../shared/room-lights.mjs";
// Time of day, in the order the card shows the options.
const DAYLIGHT_MODES = {
  auto: {
    label: "Auto",
    hint: "follow the sun",
    icon: '<path d="M12 3a9 9 0 1 0 0 18Z" fill="currentColor"/><circle cx="12" cy="12" r="9"/>',
  },
  day: {
    label: "Day",
    hint: "always daylight",
    icon: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  },
  night: {
    label: "Night",
    hint: "always night",
    icon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
  },
};
const nextDaylightMode = (mode, step = 1) => {
  const order = Object.keys(DAYLIGHT_MODES);
  return order[(order.indexOf(mode) + step + order.length) % order.length];
};
export class ThreeDRoomsCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("three-d-rooms-editor");
  }
  static getStubConfig() {
    return { height: 500, view: "front", tilt: 28 };
  }
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `<style>:host{display:block;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}input,textarea{-webkit-user-select:text;user-select:text}.switching{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;cursor:progress;background:color-mix(in srgb,var(--card-background-color,#101715) 40%,transparent);-webkit-backdrop-filter:blur(1.5px);backdrop-filter:blur(1.5px)}.switching-pill{display:inline-flex;align-items:center;gap:10px;max-width:calc(100% - 32px);padding:10px 18px 10px 14px;border-radius:999px;color:var(--primary-text-color,#edf2eb);background:color-mix(in srgb,var(--card-background-color,#101715) 90%,transparent);box-shadow:0 2px 8px #0006;font:500 14px/1.3 system-ui}.switching-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.spinner{flex-shrink:0;width:18px;height:18px;box-sizing:border-box;border:2px solid color-mix(in srgb,var(--primary-text-color,#edf2eb) 25%,transparent);border-top-color:var(--primary-color,#aacaab);border-radius:50%;will-change:transform;animation:switch-spin .8s linear infinite}@keyframes switch-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.spinner{animation-duration:2.4s}}ha-card{container:card-root/inline-size;display:block;position:relative;overflow:hidden;background:var(--ha-card-background,var(--card-background-color,#101715));border-radius:var(--ha-card-border-radius,12px)}header{padding:16px 20px 0;font:500 18px system-ui;color:var(--primary-text-color,#edf2eb)}.scene{position:relative;isolation:isolate;width:100%;height:500px;container:card-scene/inline-size}.scene canvas{display:block;width:100%;height:100%}${BACKDROP_CSS}.message{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;gap:16px;color:var(--primary-text-color,#edf2eb);font:14px/1.5 system-ui;background:var(--card-background-color,#101715);z-index:1}.loading-preview{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;transition:opacity .3s ease-out}.loading-preview.fading{opacity:0}.message.over-preview{background:color-mix(in srgb,var(--card-background-color,#101715) 45%,transparent);backdrop-filter:blur(1.5px);-webkit-backdrop-filter:blur(1.5px)}.message.over-preview>span{padding:6px 12px;border-radius:999px;background:color-mix(in srgb,var(--card-background-color,#101715) 80%,transparent)}@media(prefers-reduced-motion:reduce){.loading-preview{transition:none}}.message progress{appearance:none;-webkit-appearance:none;width:min(220px,70%);height:4px;border:0;border-radius:2px;overflow:hidden;background:color-mix(in srgb,var(--primary-text-color,#edf2eb) 18%,transparent);color:var(--primary-color,#aacaab)}.message progress::-webkit-progress-bar{background:transparent}.message progress::-webkit-progress-value{background:var(--primary-color,#aacaab);border-radius:2px;transition:width .2s}.message progress::-moz-progress-bar{background:var(--primary-color,#aacaab);border-radius:2px}button{font:inherit;min-height:44px;padding:10px 18px;border:1px solid var(--divider-color,#536258);border-radius:8px;background:transparent;color:inherit;cursor:pointer}button:focus-visible{outline:2px solid var(--primary-color,#aacaab)}.fixture-access{position:absolute;inset:0;pointer-events:none}.fixture-access button{position:absolute;box-sizing:border-box;width:var(--marker-size,32px);height:var(--marker-size,32px);min-height:var(--marker-size,32px);padding:6px;border-radius:50%;background:var(--card-background-color,#202923);color:var(--primary-text-color,#edf2eb);pointer-events:auto;touch-action:none;box-shadow:0 2px 8px #0006}.fixture-access button::before{content:"";position:absolute;inset:-6px;border-radius:50%}.fixture-access button[aria-pressed="true"]{color:#ffd66b;border-color:#ffd66b}.fixture-access button[aria-disabled="true"]{opacity:.55}.fixture-access button svg{width:18px;height:18px;fill:currentColor}.fixture-feedback{position:absolute;bottom:12px;left:12px;right:12px;color:var(--primary-text-color,#edf2eb);background:var(--card-background-color,#202923);padding:8px;border-radius:8px;pointer-events:none}.fixture-access ha-state-icon{display:block;width:18px;height:18px;--mdc-icon-size:18px;color:inherit}.fixture-access button[data-active="true"]{color:var(--primary-text-color,#edf2eb);border-color:var(--state-active-color,#ffd66b);background:color-mix(in srgb,var(--state-active-color,#ffd66b) 18%,var(--card-background-color,#202923))}.fixture-access button[data-unavailable="true"]{opacity:.65;color:var(--disabled-text-color,#9aa29e);border-style:dashed}.fixture-state{position:absolute;top:calc(var(--marker-size,32px) - 6px);left:50%;transform:translateX(-50%);padding:1px 4px;min-width:20px;white-space:nowrap;border:1px solid var(--divider-color,#536258);border-radius:6px;background:var(--card-background-color,#202923);color:var(--primary-text-color,#edf2eb);font:600 10px/14px system-ui;pointer-events:none}.fixture-access button[data-moving="true"] .fixture-state{color:var(--primary-color,#aacaab)}dialog{box-sizing:border-box;width:min(360px,calc(100vw - 32px));border:1px solid #536258;border-radius:16px;padding:24px;background:#202923;color:#edf2eb;font:14px system-ui}dialog::backdrop{background:#0008}dialog h2{font-size:20px;margin:0 0 8px}dialog p{color:#aebbb2;line-height:1.5}dialog label{display:grid;gap:8px;margin:18px 0}dialog .confirm{background:var(--primary-color,#aacaab);color:var(--text-primary-color,#101715);border-color:var(--primary-color,#aacaab)}dialog input{width:100%;min-height:32px;box-sizing:border-box}dialog .close{margin-top:12px}.daylight-switch{position:absolute;top:12px;right:12px;z-index:1;box-sizing:border-box;display:inline-flex;height:44px;padding:3px;color:var(--primary-text-color,#edf2eb);background-color:var(--card-background-color,#202923);border:1px solid var(--divider-color,#536258);border-radius:8px;box-shadow:0 2px 8px #0006}.daylight-switch button{position:relative;z-index:1;display:grid;place-items:center;width:40px;height:36px;min-height:0;padding:0;border:0;border-radius:6px;color:inherit;transition:color .2s}.daylight-switch button[aria-checked="true"]{color:var(--text-primary-color,#101715)}.daylight-switch button:focus-visible{outline:2px solid var(--primary-color,#aacaab);outline-offset:1px}.daylight-switch svg{width:20px;height:20px}.daylight-thumb{position:absolute;top:3px;left:3px;width:40px;height:36px;border-radius:6px;background:var(--primary-color,#aacaab);transition:transform .22s cubic-bezier(.3,.7,.3,1)}.daylight-switch[data-mode="day"] .daylight-thumb{transform:translateX(40px)}.daylight-switch[data-mode="night"] .daylight-thumb{transform:translateX(80px)}@media(prefers-reduced-motion:reduce){.daylight-thumb,.daylight-switch button{transition:none}}[hidden]{display:none!important}.card-top{display:none;align-items:center;gap:12px;min-width:0;box-sizing:border-box}.card-top:has(header:not([hidden])),.card-top:has(.daylight-switch:not([hidden])){display:flex;padding:12px 16px}.card-top header{padding:0;flex:1;min-width:0;overflow-wrap:anywhere;font-size:16px;line-height:1.4}.card-top .daylight-switch{position:relative;top:auto;right:auto;flex-shrink:0;margin-left:auto;box-shadow:none}.card-top.card-top:has(header[hidden]){position:absolute;top:12px;right:12px;z-index:1;padding:0}.fixture-access button{min-width:var(--marker-size,32px);min-height:var(--marker-size,32px);width:var(--marker-size,32px);height:var(--marker-size,32px)}.fixture-access button::before{inset:min(-4px,calc((var(--marker-size,32px) - 46px)/2))}.fixture-state{top:calc(var(--marker-size,32px) - 6px);font-size:11px;line-height:16px}.fixture-tray{display:flex;flex-direction:column;gap:8px;padding:12px}.fixture-tray:empty{display:none}.fixture-tray button{display:flex;align-items:center;gap:12px;min-height:44px;text-align:left;color:var(--primary-text-color,#edf2eb);background:var(--card-background-color,#202923)}.fixture-tray ha-state-icon{width:var(--marker-size,32px);height:var(--marker-size,32px);--mdc-icon-size:var(--marker-size,32px)}.fixture-tray ha-state-icon svg{width:100%;height:100%;fill:currentColor}.fixture-tray .fixture-state{position:static;transform:none;margin-left:auto;font:inherit;white-space:nowrap}.fixture-name{flex:1}.fixture-tray button[data-unavailable="true"]{opacity:.65}.fixture-tray button[data-active="true"] ha-state-icon{color:var(--state-active-color,#ffd66b)}.fixture-access button{display:grid;place-items:center;padding:0;--marker-glyph-size:clamp(12px,calc(var(--marker-size,32px) - 14px),24px)}.fixture-access ha-state-icon{width:var(--marker-glyph-size);height:var(--marker-glyph-size);--mdc-icon-size:var(--marker-glyph-size)}.fixture-access button svg{display:block;width:var(--marker-glyph-size);height:var(--marker-glyph-size)}.fixture-access .fixture-state{top:calc(var(--marker-size,32px) - 2px);font-size:clamp(9px,calc(var(--marker-size,32px) - 15px),11px);line-height:14px}.fixture-access ha-state-icon,.fixture-tray ha-state-icon{display:flex;align-items:center;justify-content:center;line-height:0;font-size:0;flex-shrink:0}.fixture-ac-icon{display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:0}.fixture-access .fixture-ac-icon{width:var(--marker-glyph-size);height:var(--marker-glyph-size)}.fixture-tray .fixture-ac-icon{width:var(--marker-size,32px);height:var(--marker-size,32px)}.fixture-ac-icon svg{display:block;width:100%;height:100%;fill:currentColor}.fixture-tray button[data-active="true"] .fixture-ac-icon{color:var(--state-active-color,#ffd66b)}.card-controls{position:absolute;right:12px;bottom:max(12px,env(safe-area-inset-bottom));left:12px;z-index:2;display:flex;flex-direction:row-reverse;flex-wrap:wrap-reverse;align-items:center;gap:8px;pointer-events:none}.card-controls>*{pointer-events:auto;flex-shrink:0}.card-controls>button{display:grid;place-items:center;box-sizing:border-box;width:44px;height:44px;min-height:44px;padding:10px;color:var(--primary-text-color,#edf2eb);background:var(--card-background-color,#202923);box-shadow:0 2px 8px #0006}.card-controls>button svg{width:22px;height:22px}.model-refresh:disabled{opacity:.5;cursor:wait}.camera-move[aria-pressed="true"]{color:var(--text-primary-color,#101715);background:var(--primary-color,#aacaab);border-color:var(--primary-color,#aacaab)}.floor-switch{display:flex;gap:2px;box-sizing:border-box;height:44px;max-width:100%;padding:3px;overflow-x:auto;scrollbar-width:none;background:var(--card-background-color,#202923);border:1px solid var(--divider-color,#536258);border-radius:8px;box-shadow:0 2px 8px #0006}.floor-switch button{flex-shrink:0;height:36px;min-height:0;min-width:44px;padding:0 12px;border:0;border-radius:6px;font:500 14px system-ui;white-space:nowrap;color:var(--primary-text-color,#edf2eb)}.floor-switch button:hover{background:color-mix(in srgb,var(--primary-text-color,#edf2eb) 10%,transparent)}.floor-switch button[aria-pressed="true"]{background:var(--primary-color,#aacaab);color:var(--text-primary-color,#101715)}.floor-switch button:focus-visible{outline:2px solid var(--primary-color,#aacaab);outline-offset:-2px}.panel-toggles{position:absolute;top:12px;left:12px;z-index:3;display:flex;gap:8px}[data-tone="locked"]{--tone:var(--state-lock-locked-color,#43a047)}[data-tone="unlocked"]{--tone:var(--state-lock-unlocked-color,#e5533d)}[data-tone="jammed"]{--tone:var(--state-lock-jammed-color,#e5533d)}[data-tone="moving"]{--tone:var(--state-lock-locking-color,#ff9800)}[data-tone="light"]{--tone:var(--state-light-active-color,#ffc107);--tone-ink:#1c1c1c}[data-tone="open"]{--tone:var(--state-cover-active-color,#9c27b0)}[data-tone="cool"]{--tone:var(--state-climate-cool-color,#2196f3)}[data-tone="heat"]{--tone:var(--state-climate-heat-color,#ff5722)}[data-tone="dry"]{--tone:var(--state-climate-dry-color,#ff9800)}[data-tone="fan_only"]{--tone:var(--state-climate-fan_only-color,#00bcd4)}[data-tone="auto"]{--tone:var(--state-climate-auto-color,#4caf50)}.fixture-access button[data-tone]{color:var(--tone-ink,#fff);border-color:var(--tone);background:var(--tone)}.fixture-tray button[data-tone] ha-state-icon,.fixture-tray button[data-tone] .fixture-ac-icon{color:var(--tone)}.fixture-tray button[data-tone] .fixture-state{color:var(--tone);border-color:var(--tone)}.light-panel-toggle{display:grid;place-items:center;box-sizing:border-box;width:44px;height:44px;min-height:44px;padding:10px;color:var(--primary-text-color,#edf2eb);background:var(--card-background-color,#202923);box-shadow:0 2px 8px #0006}.light-panel-toggle svg{width:22px;height:22px}.light-panel-toggle[aria-expanded="true"]{color:var(--text-primary-color,#101715);background:var(--primary-color,#aacaab);border-color:var(--primary-color,#aacaab)}.light-panel{position:absolute;top:64px;left:12px;bottom:68px;z-index:3;display:flex;flex-direction:column;box-sizing:border-box;width:min(300px,calc(100% - 24px));max-height:calc(100% - 132px);height:fit-content;overflow:hidden;color:var(--primary-text-color,#edf2eb);background:var(--ha-card-background,var(--card-background-color,#202923));-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:1px solid var(--divider-color,#536258);border-radius:12px;box-shadow:0 4px 16px #0008;font:14px/1.4 system-ui}.light-panel>h2{display:flex;align-items:center;gap:8px;margin:0;padding:10px 8px 10px 14px;font:600 15px system-ui;border-bottom:1px solid var(--divider-color,#536258)}.light-panel>h2>span:first-child{flex:1}.light-panel>h2 .light-room-count{font-weight:400}.light-panel>h2 [role="switch"]{margin-right:2px}.light-panel .panel-close{min-height:36px;width:36px;padding:0;border:0;font-size:20px;line-height:1}.light-rooms{overflow-y:auto;overscroll-behavior:contain;padding:4px 0}.light-room+.light-room{border-top:1px solid color-mix(in srgb,var(--divider-color,#536258) 60%,transparent)}.light-room-head,.light-row{display:flex;align-items:center;gap:6px;padding:0 10px 0 4px}.light-room-head>button:first-child,.light-row>button:first-child{display:flex;flex:1;align-items:center;gap:8px;min-width:0;min-height:44px;padding:4px 6px;border:0;border-radius:8px;text-align:left}.light-room-head>button:first-child:hover,.light-row>button:first-child:hover{background:color-mix(in srgb,var(--primary-text-color,#edf2eb) 8%,transparent)}.light-room-title{flex:1;min-width:0;font-weight:600;overflow:hidden;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-height:1.3}.light-room-count{flex-shrink:0;color:var(--secondary-text-color,#aebbb2);font-size:12px}.light-chevron{flex-shrink:0;width:16px;transition:transform .15s}.light-room-head>button[aria-expanded="true"] .light-chevron{transform:rotate(90deg)}.light-list{margin:0 0 6px;padding:0;list-style:none}.light-row{padding-left:22px}.light-row>button:first-child{min-height:40px}.light-row ha-state-icon,.light-row .light-glyph{display:flex;flex-shrink:0;width:20px;height:20px;--mdc-icon-size:20px;color:var(--secondary-text-color,#aebbb2)}.light-row .light-glyph svg{width:100%;height:100%;fill:currentColor}.light-row[data-on="true"] ha-state-icon,.light-row[data-on="true"] .light-glyph{color:var(--state-active-color,#ffd66b)}.light-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.light-row[data-unavailable="true"] .light-name{color:var(--disabled-text-color,#9aa29e)}.light-panel button[role="switch"]{position:relative;flex-shrink:0;width:40px;min-height:24px;height:24px;padding:0;border-radius:12px;background:color-mix(in srgb,var(--primary-text-color,#edf2eb) 35%,transparent);border:0}.light-panel button[role="switch"]::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px #0006;transition:left .15s}.light-panel button[role="switch"][aria-checked="true"]{background:var(--state-active-color,#ffd66b)}.light-panel button[role="switch"][aria-checked="true"]::after{left:19px}.light-panel button[role="switch"]:disabled{opacity:.4;cursor:default}.light-panel button[role="switch"][aria-busy="true"]{opacity:.7;cursor:progress}.fixture-access button[data-highlight="true"]{outline:3px solid var(--primary-color,#aacaab);outline-offset:2px;z-index:1}.fixture-access .room-group{position:absolute;display:inline-flex;align-items:center;gap:6px;box-sizing:border-box;width:auto;min-width:0;height:34px;min-height:34px;padding:0 6px 0 10px;border-radius:17px;background:var(--card-background-color,#202923);color:var(--primary-text-color,#edf2eb);border:1px solid var(--divider-color,#536258);font:600 13px/1 system-ui;white-space:nowrap;transform:translate(-50%,-50%);box-shadow:0 2px 8px #0006;z-index:2}.fixture-access .room-group::before{content:"";position:absolute;inset:-5px;border-radius:22px}.fixture-access .room-group .group-count{display:grid;place-items:center;min-width:22px;height:22px;padding:0 6px;box-sizing:border-box;border-radius:11px;background:color-mix(in srgb,var(--primary-text-color,#edf2eb) 14%,transparent);font-size:12px}.fixture-access .room-group[data-active="true"] .group-count{background:var(--state-light-active-color,#ffc107);color:#1c1c1c}.fixture-access .room-group[data-highlight="true"]{outline:3px solid var(--primary-color,#aacaab);outline-offset:2px}.room-tags{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden}.room-tags .room-tag{position:absolute;display:inline-flex;align-items:center;gap:calc(var(--room-tag-size,30px)*.2);box-sizing:border-box;height:var(--room-tag-size,30px);min-height:var(--room-tag-size,30px);padding:0 calc(var(--room-tag-size,30px)*.37) 0 calc(var(--room-tag-size,30px)*.27);border-radius:calc(var(--room-tag-size,30px)/2);transform:translate(-50%,6px);white-space:nowrap;pointer-events:auto;color:var(--primary-text-color,#edf2eb);background:color-mix(in srgb,var(--card-background-color,#202923) 82%,transparent);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);border:1px solid var(--divider-color,#536258);box-shadow:0 2px 8px #0006;font:500 calc(var(--room-tag-size,30px)*.4)/1 system-ui}.room-tags .room-tag::before{content:"";position:absolute;inset:-8px -4px}.room-tags .room-tag svg{width:calc(var(--room-tag-size,30px)*.47);height:calc(var(--room-tag-size,30px)*.47);flex-shrink:0;opacity:.8}.room-tags .room-tag[data-manual="true"]{transform:translate(-50%,-50%)}.room-tags .room-tag .room-tag-count{display:grid;place-items:center;min-width:calc(var(--room-tag-size,30px)*.6);height:calc(var(--room-tag-size,30px)*.6);padding:0 calc(var(--room-tag-size,30px)*.17);box-sizing:border-box;border-radius:calc(var(--room-tag-size,30px)*.3);background:var(--state-light-active-color,#ffc107);color:#1c1c1c;font-size:calc(var(--room-tag-size,30px)*.37);font-weight:600}.room-tags .room-tag[data-pressing="true"]{animation:room-tag-hold .55s linear forwards}@keyframes room-tag-hold{from{box-shadow:0 2px 8px #0006,inset 0 0 0 0 var(--state-light-active-color,#ffc107)}to{box-shadow:0 2px 8px #0006,inset 0 0 0 20px var(--state-light-active-color,#ffc107)}}@media(prefers-reduced-motion:reduce){.room-tags .room-tag[data-pressing="true"]{animation:none;border-color:var(--state-light-active-color,#ffc107)}}.room-tags .room-tag:hover{background:var(--card-background-color,#202923);border-color:var(--primary-color,#aacaab)}.room-nav{position:absolute;top:12px;left:50%;z-index:3;transform:translateX(-50%);display:flex;align-items:center;justify-content:center;gap:8px}.room-nav .room-step{display:grid;place-items:center;flex-shrink:0;box-sizing:border-box;width:44px;height:44px;min-height:44px;padding:0;color:var(--primary-text-color,#edf2eb);background:var(--card-background-color,#202923);box-shadow:0 2px 8px #0006}.room-nav .room-step svg{width:22px;height:22px}.room-back{display:inline-flex;align-items:center;gap:6px;box-sizing:border-box;height:44px;min-height:44px;flex:0 0 auto;width:clamp(150px,calc(100cqw - 404px),260px);justify-content:center;padding:0 16px 0 10px;white-space:nowrap;color:var(--text-primary-color,#101715);background:var(--primary-color,#aacaab);border-color:var(--primary-color,#aacaab);box-shadow:0 2px 8px #0006;font:600 14px/1 system-ui}.room-back svg{width:20px;height:20px;flex-shrink:0}.room-back>span:not(.room-back-name){flex-shrink:0}.room-back .room-back-name{min-width:0;overflow:hidden;text-overflow:ellipsis;font-weight:400;opacity:.85;padding-left:8px;border-left:1px solid color-mix(in srgb,currentColor 35%,transparent)}.room-back .room-back-name:empty{display:none}@container card-root (max-width:520px){.card-controls{right:8px;left:8px;bottom:max(8px,env(safe-area-inset-bottom));gap:6px}.card-controls>button,.light-panel-toggle{width:44px;height:44px;min-height:44px;padding:10px;position:relative;background:color-mix(in srgb,var(--card-background-color,#202923) 70%,transparent);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:0 1px 4px #0004;border-color:color-mix(in srgb,var(--divider-color,#536258) 60%,transparent)}.card-controls>button::before,.light-panel-toggle::before{content:"";position:absolute;inset:-5px}.card-controls>button svg,.light-panel-toggle svg{width:22px;height:22px;opacity:.85}.panel-toggles{top:8px;left:8px;gap:6px}.floor-switch{height:44px;padding:3px;background:color-mix(in srgb,var(--card-background-color,#202923) 70%,transparent);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:0 1px 4px #0004;border-color:color-mix(in srgb,var(--divider-color,#536258) 60%,transparent)}.floor-switch button{height:36px;min-width:44px;padding:0 12px;font:500 14px system-ui}.card-top.card-top:has(header[hidden]){top:8px;right:8px}.daylight-switch{height:44px;padding:3px;background:color-mix(in srgb,var(--card-background-color,#202923) 70%,transparent);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:0 1px 4px #0004;border-color:color-mix(in srgb,var(--divider-color,#536258) 60%,transparent)}.daylight-switch button{width:40px;height:36px}.daylight-switch svg{width:20px;height:20px}.daylight-thumb{top:3px;left:3px;width:40px;height:36px}.daylight-switch[data-mode="day"] .daylight-thumb{transform:translateX(40px)}.daylight-switch[data-mode="night"] .daylight-thumb{transform:translateX(80px)}.light-panel{top:60px;left:8px;bottom:62px;width:min(300px,calc(100% - 16px));max-height:calc(100% - 122px)}.room-nav{top:60px;gap:6px}.room-nav .room-step{width:44px;height:44px;min-height:44px;position:relative;background:color-mix(in srgb,var(--card-background-color,#202923) 70%,transparent);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:0 1px 4px #0004;border-color:color-mix(in srgb,var(--divider-color,#536258) 60%,transparent)}.room-nav .room-step::before{content:"";position:absolute;inset:-5px}.room-nav .room-step svg{width:22px;height:22px}.room-back{height:44px;min-height:44px;width:clamp(130px,calc(100cqw - 132px),200px);padding:0 12px 0 8px;font:600 12px/1 system-ui;box-shadow:0 1px 4px #0004}.room-back svg{width:16px;height:16px}}</style><ha-card><div class="card-top"><header hidden></header><div class="daylight-switch" role="radiogroup" aria-label="Time of day" hidden></div></div><div class="scene"><div class="backdrop" aria-hidden="true"></div><div class="message" role="status"><span>Connecting to 3D Rooms…</span><progress max="1" aria-label="Download progress" hidden></progress><button hidden>Retry</button></div></div></ha-card>`;
    this._container = this.shadowRoot.querySelector(".scene");
    this._message = this.shadowRoot.querySelector(".message");
    this._daylightSwitch = this.shadowRoot.querySelector(".daylight-switch");
    // Auto, Day and Night side by side; a highlight slides onto the chosen one.
    const thumb = document.createElement("span");
    thumb.className = "daylight-thumb";
    this._daylightSwitch.append(thumb);
    for (const [mode, { label, hint, icon }] of Object.entries(
      DAYLIGHT_MODES,
    )) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.mode = mode;
      button.setAttribute("role", "radio");
      button.setAttribute("aria-label", label);
      button.title = `${label} — ${hint}`;
      button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>`;
      button.onclick = () => this._chooseDaylight(mode);
      this._daylightSwitch.append(button);
    }
    // Arrow keys move the choice, as in any radio group.
    this._daylightSwitch.onkeydown = (event) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
        event.key
      ];
      if (!step) return;
      event.preventDefault();
      const mode = nextDaylightMode(this._daylightSwitch.value, step);
      this._chooseDaylight(mode);
      this._daylightSwitch.querySelector(`[data-mode="${mode}"]`)?.focus();
    };
    this._showDaylightMode("auto");
    this.shadowRoot.querySelector(".message button").onclick = () =>
      this._load();
    // Bottom-right toolbar, right to left: fullscreen (added by CardLayout),
    // reload, reset view, camera movement, floors. Floors wrap above on phones.
    this._controls = document.createElement("div");
    this._controls.className = "card-controls";
    this._container.append(this._controls);
    this._refresh = document.createElement("button");
    this._refresh.type = "button";
    this._refresh.className = "model-refresh";
    this._refresh.setAttribute("aria-label", "Reload models");
    this._refresh.title = "Reload models — clear cached models and load again";
    this._refresh.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 17.9 17"/></svg>';
    this._refresh.onclick = () => this._refreshModels();
    this._resetCamera = document.createElement("button");
    this._resetCamera.type = "button";
    this._resetCamera.className = "camera-reset";
    this._resetCamera.setAttribute("aria-label", "Reset view");
    this._resetCamera.title = "Reset view to the card framing";
    this._resetCamera.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h4.5v-6h4v6h4.5V9.5"/></svg>';
    this._resetCamera.hidden = true;
    this._resetCamera.onclick = () => this._resetView();
    this._moveCamera = document.createElement("button");
    this._moveCamera.type = "button";
    this._moveCamera.className = "camera-move";
    this._moveCamera.setAttribute("aria-label", "Move camera");
    this._moveCamera.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18M3 12h18M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5"/></svg>';
    this._moveCamera.hidden = true;
    this._moveCamera.onclick = () => this._setCameraMovement(!this._cameraFree);
    // Administrators can open this card's room or saved view in the manager.
    this._editButton = document.createElement("button");
    this._editButton.type = "button";
    this._editButton.className = "card-edit";
    this._editButton.hidden = true;
    this._editButton.setAttribute("aria-label", "Edit in 3D Rooms");
    this._editButton.title =
      "Edit in 3D Rooms — opens this view in the editor in a new tab";
    this._editButton.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    this._editButton.onclick = () => this._openEditor();
    this._controls.append(
      this._refresh,
      this._editButton,
      this._resetCamera,
      this._moveCamera,
    );
    // Top-left Lights and Shades buttons; the panel opens just below them.
    this._panelToggles = document.createElement("div");
    this._panelToggles.className = "panel-toggles";
    this._panelButtons = {};
    for (const [kind, label, title, icon] of [
      [
        "light",
        "Room lights",
        "Room lights — switch each room's lights",
        '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 21h6v-1H9v1Zm3-19a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2Zm2.85 11.1-.85.6V16h-4v-2.3l-.85-.6a5 5 0 1 1 5.7 0Z"/></svg>',
      ],
      [
        "shade",
        "Room shades",
        "Room shades — open or close each room's shades",
        '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 3h18v2H3zm1 4h16v2H4zm0 4h16v2H4zm0 4h16v2H4zm7 4h2v3h-2z"/></svg>',
      ],
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "light-panel-toggle";
      button.dataset.panel = kind;
      button.setAttribute("aria-label", label);
      button.setAttribute("aria-expanded", "false");
      button.title = title;
      button.innerHTML = icon;
      button.hidden = true;
      button.onclick = () =>
        this._setLightPanel(this._panelKind === kind ? null : kind);
      this._panelButtons[kind] = button;
      this._panelToggles.append(button);
    }
    this._lightsButton = this._panelButtons.light;
    this._container.append(this._panelToggles);
    // Room focus: a button in front of each room of a house or floor view,
    // and a way back from the room on its own.
    this._roomTags = document.createElement("div");
    this._roomTags.className = "room-tags";
    this._container.append(this._roomTags);
    this._roomBack = document.createElement("button");
    this._roomBack.type = "button";
    this._roomBack.className = "room-back";
    this._roomBack.hidden = true;
    this._roomBack.title = "Back to the house view";
    this._roomBack.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg><span>House</span><span class="room-back-name"></span>';
    this._roomBack.onclick = () => this._exitRoom();
    // Previous and next room, either side of the back button.
    this._roomNav = document.createElement("div");
    this._roomNav.className = "room-nav";
    this._roomNav.hidden = true;
    this._roomSteps = [-1, 1].map((delta) => {
      const step = document.createElement("button");
      step.type = "button";
      step.className = "room-step";
      step.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${delta < 0 ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7"}"/></svg>`;
      step.onclick = () => this._stepRoom(delta);
      return step;
    });
    this._roomNav.append(
      this._roomSteps[0],
      this._roomBack,
      this._roomSteps[1],
    );
    this._container.append(this._roomNav);
    // Shown while a room or floor that is not ready is prepared (`_showView`).
    this._switchOverlay = document.createElement("div");
    this._switchOverlay.className = "switching";
    this._switchOverlay.hidden = true;
    this._switchOverlay.setAttribute("role", "status");
    this._switchOverlay.innerHTML =
      '<span class="switching-pill"><span class="spinner" aria-hidden="true"></span><span class="switching-label"></span></span>';
    this._switchLabel = this._switchOverlay.querySelector(".switching-label");
    this._container.append(this._switchOverlay);
    this._switching = false;
    this._focus = null;
    this._panelKind = null;
    this._panelRooms = { light: [], shade: [] };
    this._expandedRooms = new Set();
    this._pendingRooms = new Set();
    this._floorSwitch = document.createElement("div");
    this._floorSwitch.className = "floor-switch";
    this._floorSwitch.setAttribute("role", "group");
    this._floorSwitch.setAttribute("aria-label", "Floor");
    this._floorSwitch.hidden = true;
    this._controls.append(this._floorSwitch);
    this._floors = [];
    this._views = [];
    this._floor = null;
    this._generation = 0;
    // Crowded house views: room chips, and the room opened to its real icons.
    this._groupChips = new Map();
    this._openGroup = null;
    this._groupOf = new Map();
    this.shadowRoot.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        this._focus &&
        !this._openGroup &&
        !event
          .composedPath()
          .some(
            (el) =>
              el?.tagName === "DIALOG" ||
              el?.classList?.contains("light-panel"),
          )
      ) {
        this._exitRoom();
        return;
      }
      if (
        this._focus &&
        (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
        !event
          .composedPath()
          .some(
            (el) =>
              el?.tagName === "DIALOG" ||
              el?.tagName === "INPUT" ||
              el?.tagName === "SELECT" ||
              el?.classList?.contains("light-panel"),
          )
      ) {
        event.preventDefault();
        this._stepRoom(event.key === "ArrowLeft" ? -1 : 1);
        return;
      }
      if (event.key === "Escape" && this._openGroup) {
        const room = this._openGroup;
        this._openGroup = null;
        this._positionButtons();
        this._groupChips.get(room)?.focus();
      }
    });
    this._container.addEventListener("pointerdown", (event) => {
      if (
        this._openGroup &&
        !event
          .composedPath()
          .some((el) => el?.dataset?.control || el?.dataset?.groupRoom)
      ) {
        this._openGroup = null;
        this._positionButtons();
      }
    });
  }
  setConfig(config) {
    if (
      config.saved_view !== undefined &&
      (typeof config.saved_view !== "string" ||
        !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(config.saved_view))
    )
      throw new Error("Choose a valid saved view ID.");
    if (
      this._sourceConfig?.model !== config.model ||
      this._sourceConfig?.saved_view !== config.saved_view
    )
      this._floor = null;
    this._sourceConfig = { ...config };
    if (
      config.model !== undefined &&
      (typeof config.model !== "string" ||
        !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(config.model))
    )
      throw new Error("Choose a model ID, for example kitchen.");
    if (
      config.height !== undefined &&
      config.height !== "auto" &&
      (!Number.isFinite(config.height) ||
        config.height < 180 ||
        config.height > 1600)
    )
      throw new Error(
        "Card height must be auto or between 180 and 1600 pixels.",
      );
    if (
      config.zoom !== undefined &&
      (!Number.isFinite(config.zoom) || config.zoom < 0.01 || config.zoom > 100)
    )
      throw new Error("Zoom must be between 0.01 and 100.");
    for (const key of ["tilt", "heading"])
      if (config[key] !== undefined && !Number.isFinite(config[key]))
        throw new Error(`${key} must be a number.`);
    if (config.tilt !== undefined && (config.tilt < 0 || config.tilt > 180))
      throw new Error("Tilt must be between 0 and 180 degrees.");
    if (config.view !== undefined && !["front", "floor"].includes(config.view))
      throw new Error("Choose front or floor view.");
    validateBackground(config);
    if (config.quality !== undefined && !QUALITIES.includes(config.quality))
      throw new Error("Quality must be auto, high or low.");
    for (const key of [
      "floor_selector",
      "camera_controls",
      "light_panel",
      "shade_panel",
      "room_focus",
      "edit_button",
    ])
      if (config[key] !== undefined && typeof config[key] !== "boolean")
        throw new Error(`${key} must be true or false.`);
    const camera =
      config.camera === undefined
        ? undefined
        : validateCameraSnapshot(config.camera);
    if (
      camera &&
      ((config.view || "front") === "floor") !==
        (camera.projection === "orthographic")
    )
      throw new Error("Saved camera projection must match the selected view.");
    this._config = {
      height: 500,
      view: "front",
      tilt: camera?.tilt ?? (config.view === "floor" ? 0 : 28),
      heading: camera?.heading ?? 0,
      zoom: camera?.referenceZoom ?? 1,
      interactive: false,
      ...config,
      markers: validateMarkers(config.markers),
      camera,
    };
    // Card setting is the starting point; the toolbar toggle overrides it this session.
    this._cameraFree = !!this._config.interactive;
    this._cameraTouched = false;
    this._applyHeight();
    this._applyBackdrop();
    const title = this.shadowRoot.querySelector("header");
    title.textContent = config.title || "";
    title.hidden = !config.title || config.show_title === false;
    this._reload = true;
    if (this._hass && this.isConnected) this._load();
  }
  set hass(hass) {
    this._hass = hass;
    if (!this._config || !this.isConnected) return;
    if (this._reload || !this._view) {
      if (!this._loading) this._load();
    } else this._states();
  }
  getCardSize() {
    return Math.ceil(
      ((typeof this._config?.height === "number" ? this._config.height : 500) +
        markerTrayHeight(this._config?.markers, this._model?.controls)) /
        50,
    );
  }
  getGridOptions() {
    return {
      columns: 12,
      rows: Math.ceil(
        ((typeof this._config?.height === "number"
          ? this._config.height
          : 500) +
          markerTrayHeight(this._config?.markers, this._model?.controls)) /
          56,
      ),
      min_columns: 6,
      min_rows: 4,
    };
  }
  _applyHeight() {
    if (this._layout) this._layout.update();
    else
      this._container.style.height =
        this._config?.height === "auto"
          ? "500px"
          : `${this._config?.height || 500}px`;
  }
  connectedCallback() {
    // A tap outside the open lights or shades panel closes it.
    this._outsidePanel ??= (event) => {
      if (!this._lightPanel) return;
      const path = event.composedPath();
      if (
        path.includes(this._lightPanel) ||
        path.includes(this._panelToggles) ||
        path.some((node) => node instanceof HTMLDialogElement)
      )
        return;
      this._setLightPanel(null);
    };
    document.addEventListener("pointerdown", this._outsidePanel, true);
    this._layout = new CardLayout(this);
    this._applyHeight();
    if (this._hass && this._config) this._load();
  }
  disconnectedCallback() {
    document.removeEventListener("pointerdown", this._outsidePanel, true);
    this._layout?.dispose();
    this._layout = null;
    ++this._generation;
    clearInterval(this._keepalive);
    this._unsubModels?.();
    this._unsubModels = null;
    this._unsubEffects?.();
    this._unsubEffects = null;
    this._dialog?.remove();
    clearTimeout(this._coverTimer);
    clearTimeout(this._warmTimer);
    this._switching = false;
    this._switchOverlay.hidden = true;
    this._view?.dispose();
    this._view = null;
    this._loading = false;
  }
  async _refreshModels() {
    if (this._loading || !this._hass) return;
    clearSceneDownloads(this._hass);
    clearSceneAssets(sceneOwner(this._hass));
    await this._load();
  }
  async _load() {
    if (!this._config || !this._hass) return;
    const generation = ++this._generation;
    this._loading = true;
    this._contextLost = false;
    this._refresh.disabled = true;
    this._container.setAttribute("aria-busy", "true");
    this._reload = false;
    clearInterval(this._keepalive);
    // The update subscription outlives loads: changes made while a room is
    // loading must not be missed. Previews and the add-on have no events.
    if (this._config.preview_url || this._config.addon) {
      this._unsubModels?.();
      this._unsubModels = null;
    }
    this._changedDuringLoad = false;
    this._message.hidden = false;
    this._message.querySelector("span").textContent = "Downloading your room…";
    this._message.querySelector("button").hidden = true;
    this._message.querySelector("button").textContent = "Retry";
    const bar = this._message.querySelector("progress");
    bar.hidden = true;
    // A saved view's thumbnail stands in for the room while it downloads.
    if (!this._view) this._showLoadingPreview(this._cachedThumbnail());
    try {
      if (this._sourceConfig?.saved_view) {
        const components = await this._hass.callWS({
          type: "three_d_rooms/request",
          operation: "components",
          data: { id: this._sourceConfig.saved_view, include_thumbnails: true },
        });
        if (generation !== this._generation) return;
        const thumbnail = components.find(
          (c) => c.id === this._sourceConfig.saved_view,
        )?.thumbnail;
        if (thumbnail) {
          this._cacheThumbnail(thumbnail);
          if (!this._view) this._showLoadingPreview(thumbnail);
        }
        this._config = resolveSavedView(this._sourceConfig, components);
        this._config.markers = validateMarkers(this._config.markers);
        if (!this._cameraTouched) this._cameraFree = !!this._config.interactive;
        this._applyHeight();
        const title = this.shadowRoot.querySelector("header");
        title.textContent = this._config.title || "";
        title.hidden = !this._config.title || this._config.show_title === false;
      }
      if (!this._config.model) {
        this._message.querySelector("span").textContent =
          "Choose a room in the visual editor.";
        return;
      }
      const connection = await connectModel(
        this._hass,
        this._config,
        location.origin,
      );
      if (generation !== this._generation) return;
      if (connection.session)
        document.cookie = `ingress_session=${connection.session};path=/api/hassio_ingress/;SameSite=Strict${location.protocol === "https:" ? ";Secure" : ""}`;
      const {
        model,
        configured,
        floors,
        views,
        sceneURL,
        layers,
        release,
        assetCache,
      } = await connection.load({
        onProgress: (progress) => {
          if (generation !== this._generation) return;
          const { value, text } = loadProgress(progress);
          this._message.querySelector("span").textContent = text;
          bar.hidden = value === undefined;
          if (value !== undefined) bar.value = value;
        },
      });
      if (generation !== this._generation) {
        release?.();
        return;
      }
      bar.hidden = true;
      this._message.querySelector("span").textContent =
        "Preparing the 3D view…";
      await new Promise(requestAnimationFrame);
      if (generation !== this._generation) {
        release?.();
        return;
      }
      this._view?.dispose();
      this._view = new SceneView(this._container, (id) => this._pick(id), {
        mode: this._config.view,
        markers: false,
        interactive: this._cameraFree,
        tilt: this._config.tilt,
        heading: this._config.heading,
        zoom: this._config.zoom ?? 1,
        camera: this._config.camera,
        quality: this._config.quality,
        transparent: needsTransparentCanvas(this._background()),
        groundShadow: groundShadowEnabled(this._config),
        onRender: () => this._positionButtons(),
        // Double-tapping a room of a house or floor opens that room.
        onRoomDoubleTap: (room) => {
          if (this._config?.room_focus !== false) this._focusRoom(room);
        },
        // The browser dropped the 3D context: say so and offer a reload.
        onContextLost: () => {
          this._contextLost = true;
          this._message.querySelector("span").textContent =
            "The 3D view stopped. Your browser paused its graphics.";
          this._message.querySelector("button").textContent = "Reload 3D view";
          this._message.querySelector("button").hidden = false;
          this._message.hidden = false;
        },
        onContextRestored: () => {
          if (!this._contextLost) return;
          this._contextLost = false;
          this._message.hidden = true;
        },
        onCameraChange: ({ source }) => {
          if (source !== "orbit" || this._cameraMoved) return;
          this._cameraMoved = true;
          this._syncCameraButtons();
        },
      });
      if (model.houseView) {
        for (const dialog of this.shadowRoot.querySelectorAll("dialog"))
          dialog.remove();
      }
      const view = this._view;
      try {
        await (layers
          ? view.loadLayers(model, layers)
          : view.load(model, sceneURL, assetCache));
      } finally {
        release?.();
      }
      if (generation !== this._generation) return;
      // The whole house is loaded once; show the chosen or configured view of it.
      this._views = views || [];
      this._floors = floors || [];
      let shown = selectHouseView(
        this._views,
        configured || model,
        this._floor,
      );
      if (shown !== model && !view.setHouseView(shown)) shown = model;
      if (this._floor && shown.id !== this._floor) this._floor = null;
      this._model = shown;
      this._focus = null;
      this._cameraMoved = false;
      this._syncFloorSwitch();
      this._syncCameraButtons();
      this._previewStates = new Map();
      this._buildAccess();
      this._syncRoomTags();
      this._preview = connection.preview;
      this._signature = null;
      this._states();
      this._syncDaylightSwitch();
      this._syncEditButton();
      this._message.hidden = true;
      this._hideLoadingPreview();
      this._warmViews();
      if (
        !this._preview &&
        !this._config.addon &&
        !this._unsubModels &&
        this._hass.connection?.subscribeEvents
      ) {
        const unsubscribe = await this._hass.connection.subscribeEvents(
          () => this._modelsEvent(),
          "three_d_rooms_updated",
        );
        // Keep one subscription: drop this one if the card left the page or
        // another load subscribed meanwhile.
        if (!this.isConnected || this._unsubModels) unsubscribe();
        else this._unsubModels = unsubscribe;
      }
      if (generation !== this._generation) return;
      this._watchLightEffects();
      if (connection.session)
        this._keepalive = setInterval(async () => {
          if (document.hidden || !this.isConnected) return;
          try {
            await this._hass.callWS({
              type: "supervisor/api",
              endpoint: "/ingress/validate_session",
              method: "post",
              data: { session: connection.session },
            });
          } catch {
            this._load();
          }
        }, 60000);
    } catch (error) {
      if (generation !== this._generation) return;
      bar.hidden = true;
      this._message.querySelector("span").textContent =
        error.message || "Could not display this model.";
      this._message.querySelector("button").hidden = false;
      this._message.hidden = false;
    } finally {
      if (generation === this._generation) {
        this._loading = false;
        this._refresh.disabled = false;
        this._container.setAttribute("aria-busy", "false");
        this._recheckAfterLoad();
      }
    }
  }
  _thumbnailKey() {
    return `three-d-rooms:thumbnail:${this._sourceConfig?.saved_view}`;
  }
  /** Per-browser copy, so a revisit shows the picture before any request. */
  _cachedThumbnail() {
    if (!this._sourceConfig?.saved_view) return undefined;
    try {
      return localStorage.getItem(this._thumbnailKey()) || undefined;
    } catch {
      return undefined;
    }
  }
  _cacheThumbnail(value) {
    try {
      if (
        value.length <= 150000 &&
        localStorage.getItem(this._thumbnailKey()) !== value
      )
        localStorage.setItem(this._thumbnailKey(), value);
    } catch {}
  }
  _showLoadingPreview(src) {
    if (!src?.startsWith("data:image/jpeg;base64,")) return;
    let image = this._container.querySelector(".loading-preview");
    if (!image) {
      image = document.createElement("img");
      image.className = "loading-preview";
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      this._container.prepend(image);
    }
    image.classList.remove("fading");
    if (image.getAttribute("src") !== src) image.src = src;
    this._message.classList.add("over-preview");
  }
  _hideLoadingPreview() {
    this._message.classList.remove("over-preview");
    const image = this._container.querySelector(".loading-preview");
    if (!image) return;
    image.classList.add("fading");
    setTimeout(() => image.remove(), 320);
  }
  /**
   * One-shot light effects (blink, breathe, …) leave no lasting state, so
   * they are picked up from the service call itself and played in the room.
   */
  async _watchLightEffects() {
    if (
      this._unsubEffects ||
      this._effectsPending ||
      this._preview ||
      this._config?.addon ||
      !this._hass?.connection?.subscribeEvents
    )
      return;
    this._effectsPending = true;
    try {
      const unsubscribe = await this._hass.connection.subscribeEvents(
        (event) => this._lightEffectCalled(event?.data),
        "call_service",
      );
      if (!this.isConnected || this._unsubEffects) unsubscribe();
      else this._unsubEffects = unsubscribe;
    } catch {
      // Without the event the room still follows the reported effect.
    } finally {
      this._effectsPending = false;
    }
  }
  _lightEffectCalled(call) {
    const effect = call?.service_data?.effect;
    if (
      call?.domain !== "light" ||
      call.service !== "turn_on" ||
      typeof effect !== "string" ||
      !this._model ||
      !this._view
    )
      return;
    const targets = [call.service_data.entity_id].flat().filter(Boolean);
    for (const control of this._model.controls)
      if (
        control.type === "light" &&
        targets.includes(this._model.bindings?.[control.id])
      )
        this._view.triggerLightEffect(control.id, effect);
  }
  /** Rooms changed: check now, or once the current load has finished. */
  _modelsEvent() {
    if (this._loading) this._changedDuringLoad = true;
    else this._modelsChanged();
  }
  _recheckAfterLoad() {
    if (!this._changedDuringLoad || !this.isConnected) return;
    this._changedDuringLoad = false;
    this._modelsChanged();
  }
  _syncFloorSwitch() {
    const group = this._floorSwitch;
    group.hidden =
      this._floors.length < 2 || this._config?.floor_selector === false;
    if (group.hidden) return;
    const key = JSON.stringify(this._floors);
    if (group.dataset.options !== key) {
      group.replaceChildren(
        ...this._floors.map((floor) => {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.floor = floor.id;
          button.textContent = floor.floorId === null ? "All" : floor.label;
          button.title =
            floor.floorId === null ? "Whole house" : `Show ${floor.label}`;
          if (floor.floorId === null)
            button.setAttribute("aria-label", "Whole house");
          button.onclick = () => this._selectFloor(floor.id);
          return button;
        }),
      );
      group.dataset.options = key;
    }
    for (const button of group.children)
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.floor === this._model?.id),
      );
  }
  /**
   * Show another floor of the already loaded house without downloading or
   * rebuilding it. Session-only: the saved card and room never change.
   */
  _selectFloor(id) {
    if (this._loading || (id === this._model?.id && !this._focus)) return;
    const target = this._views.find((view) => view.id === id);
    if (!target || !this._floors.some((floor) => floor.id === id)) return;
    this._showView(target, target.title, () => {
      this._floor = id === this._config?.model ? null : id;
      const keepCamera = !!this._cameraFree;
      if (
        !this._view?.setHouseView(target, {
          keepCamera,
          render: false,
        })
      ) {
        this._load();
        return;
      }
      if (!keepCamera) this._cameraMoved = false;
      this._model = target;
      this._focus = null;
      this._buildAccess();
      this._signature = null;
      this._states();
      this._syncFloorSwitch();
      this._syncRoomTags();
      this._syncCameraButtons();
    });
  }
  /**
   * Show `target`, another view of the loaded house. A view whose shaders are
   * not built yet would freeze the page while the graphics driver compiles
   * them (seconds for a big room), so they are built first behind a spinner;
   * that work runs off the page's thread, so the spinner keeps turning.
   * Views prepared by `_warmViews` switch at once.
   */
  _showView(target, label, apply) {
    const view = this._view;
    if (!view || this._switching) return;
    if (view.isHouseViewPrepared?.(target) ?? true) {
      apply();
      return;
    }
    this._switching = true;
    this._switchLabel.textContent = `Opening ${label || "view"}…`;
    this._switchOverlay.hidden = false;
    this._container.setAttribute("aria-busy", "true");
    const generation = this._generation;
    // Let the spinner appear before the compile call starts. A hidden page
    // never draws a frame, so do not wait for one for long.
    new Promise((done) => {
      requestAnimationFrame(() => done());
      setTimeout(done, 150);
    })
      .then(() => view.prepareHouseView(target))
      .catch(() => {})
      .then(() => {
        this._switching = false;
        this._switchOverlay.hidden = true;
        if (!this._loading) this._container.setAttribute("aria-busy", "false");
        if (
          generation === this._generation &&
          view === this._view &&
          !this._loading
        )
          apply();
      });
  }
  /**
   * Build the shaders of every room and floor view in the background, one at
   * a time, so that opening one later is instant (see `_showView`).
   */
  _warmViews() {
    clearTimeout(this._warmTimer);
    const view = this._view,
      generation = this._generation;
    if (!view?.prepareHouseView || !this._model?.houseView) return;
    const bases = [
        this._model,
        ...this._views.filter((v) => v !== this._model),
      ],
      targets = [];
    if (this._config?.room_focus !== false)
      for (const base of bases)
        for (const { room } of focusableRooms(base)) {
          const target = this._roomTarget(base, room);
          if (target) targets.push(target);
        }
    if (this._config?.floor_selector !== false) targets.push(...bases);
    const next = async () => {
      if (generation !== this._generation || view !== this._view) return;
      if (this._loading || this._switching || document.hidden) {
        this._warmTimer = setTimeout(next, 1000);
        return;
      }
      const target = targets.shift();
      if (!target) return;
      if (!view.isHouseViewPrepared(target))
        await view.prepareHouseView(target);
      this._warmTimer = setTimeout(next, 100);
    };
    this._warmTimer = setTimeout(next, 800);
  }
  /** The view of one room, framed at the angle the view chose for it. */
  _roomTarget(base, room) {
    const target = roomFocusView(base, room),
      chosen = this._config?.markers?._rooms?.[room];
    if (target && (chosen?.heading !== undefined || chosen?.tilt !== undefined))
      target.focusFrame = { heading: chosen.heading, tilt: chosen.tilt };
    return target;
  }
  /** Show one room of the loaded house on its own. Session-only. */
  _focusRoom(roomId) {
    if (this._loading || !this._view || this._focus) return;
    const base = this._model,
      target = this._roomTarget(base, roomId);
    if (!target) return;
    this._showView(target, target.title, () => {
      if (!this._view.setHouseView(target, { render: false })) return;
      this._focus = { base, room: roomId };
      this._showModel(target);
      this._roomBack.focus();
    });
  }
  /** Back from a focused room to the house or floor it came from. */
  _exitRoom() {
    const focus = this._focus;
    if (!focus || this._loading || !this._view) return;
    this._showView(focus.base, focus.base.title, () => {
      if (!this._view.setHouseView(focus.base, { render: false })) {
        this._load();
        return;
      }
      this._focus = null;
      this._showModel(focus.base);
      this._roomTags
        .querySelector(`[data-room="${CSS.escape(focus.room)}"]`)
        ?.focus();
    });
  }
  /** Go to the previous (-1) or next (1) room of the house or floor. */
  _stepRoom(delta) {
    const focus = this._focus,
      members = focus?.base.members || [];
    if (!focus || this._loading || !this._view || members.length < 2) return;
    const at = members.findIndex((m) => m.model === focus.room),
      next = members[(at + delta + members.length) % members.length].model,
      target = this._roomTarget(focus.base, next);
    if (!target) return;
    this._showView(target, target.title, () => {
      if (!this._view.setHouseView(target, { render: false })) return;
      focus.room = next;
      this._showModel(target);
    });
  }
  _showModel(model) {
    this._openGroup = null;
    this._cameraMoved = false;
    this._model = model;
    this._buildAccess();
    this._signature = null;
    this._states();
    this._syncRoomTags();
    this._syncCameraButtons();
  }
  _syncRoomTags() {
    const rooms =
        this._config?.room_focus === false || !this._view
          ? []
          : focusableRooms(this._model),
      key = JSON.stringify(rooms);
    if (this._roomTags.dataset.rooms !== key) {
      this._roomTags.dataset.rooms = key;
      this._roomTags.replaceChildren(
        ...rooms.map(({ room, title }) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "room-tag";
          button.dataset.room = room;
          button.hidden = true;
          const lights = !!this._roomLightsOf(room);
          button.title = `Show ${title} on its own${lights ? " · hold to switch its lights" : ""}`;
          button.setAttribute("aria-label", `Show ${title} on its own`);
          button.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg><span class="room-tag-name"></span><span class="room-tag-count" hidden></span>';
          button.querySelector(".room-tag-name").textContent = title;
          this._wireRoomTag(button, room);
          return button;
        }),
      );
    }
    this._syncRoomTagStates();
    const focused = !!this._focus;
    this._roomBack.hidden = !focused;
    this._roomNav.hidden = !focused;
    if (focused) {
      const members = this._focus.base.members,
        at = members.findIndex((m) => m.model === this._focus.room);
      this._roomSteps.forEach((step, i) => {
        const other =
            members[(at + (i ? 1 : -1) + members.length) % members.length],
          title = shortRoomTitle(roomTitleOf(this._focus.base, other.model));
        step.hidden = members.length < 2;
        step.title = `${i ? "Next" : "Previous"} room · ${title}`;
        step.setAttribute("aria-label", step.title);
      });
      const name = this._model.title || "";
      this._roomBack.querySelector(".room-back-name").textContent = name;
      this._roomBack.setAttribute(
        "aria-label",
        `Back to the house view from ${name}`,
      );
    }
    this._positionRoomTags();
  }
  /** A room's light devices (for its button's count and long-press). */
  _roomLightsOf(roomId) {
    return roomLights(this._model).find(
      (r) => r.id === roomId && r.lights.length,
    );
  }
  /**
   * Tap opens the room; holding switches its lights (any on turns all off,
   * otherwise all on, as in the Lights panel); hovering or focusing outlines
   * the room in the house.
   */
  _wireRoomTag(button, room) {
    let timer = null,
      start,
      held = false;
    const clear = () => {
      clearTimeout(timer);
      timer = null;
      delete button.dataset.pressing;
    };
    button.addEventListener("pointerdown", (event) => {
      held = false;
      if (event.button > 0 || !this._roomLightsOf(room)) return;
      start = [event.clientX, event.clientY];
      button.dataset.pressing = "true";
      timer = setTimeout(() => {
        clear();
        held = true;
        this._toggleRoomLights(room, this._roomLightsOf(room));
      }, 550);
    });
    button.addEventListener("pointermove", (event) => {
      if (
        timer &&
        Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 8
      )
        clear();
    });
    for (const type of ["pointerup", "pointercancel", "pointerleave"])
      button.addEventListener(type, clear);
    button.addEventListener("contextmenu", (event) => event.preventDefault());
    button.onclick = () => {
      if (held) {
        held = false;
        return;
      }
      this._focusRoom(room);
    };
    const outline = (on) => this._view?.highlightRoom?.(on ? room : null);
    button.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "touch") outline(true);
    });
    button.addEventListener("pointerleave", () => outline(false));
    button.addEventListener("focus", () => outline(true));
    button.addEventListener("blur", () => outline(false));
  }
  /** Show how many of each room's lights are on on its button. */
  _syncRoomTagStates() {
    const tags = [...(this._roomTags?.children || [])];
    if (!tags.length) return;
    const rooms = new Map(roomLights(this._model).map((r) => [r.id, r])),
      states = this._lightStates || new Map();
    for (const tag of tags) {
      const room = rooms.get(tag.dataset.room),
        on = room ? roomLightSummary(room, states).on : 0,
        count = tag.querySelector(".room-tag-count");
      tag.dataset.active = String(on > 0);
      if (!count) continue;
      count.hidden = on === 0;
      count.textContent = on;
      count.title = `${on} on`;
    }
  }
  /**
   * Keep each room button in front of its room as the camera moves, at the
   * spot the room chose, and only while the room's own setting says so.
   */
  _positionRoomTags() {
    const tags = [...(this._roomTags?.children || [])];
    if (!tags.length) return;
    const buttons = this._config?.markers?._rooms || {},
      positions = Object.fromEntries(
        Object.entries(buttons)
          .filter(([, b]) => b.position)
          .map(([room, b]) => [room, b.position]),
      ),
      points = new Map(
        (this._view?.roomFrontPoints?.(positions) || []).map((p) => [
          p.room,
          p,
        ]),
      );
    // Keep buttons on the card and above the bottom toolbar.
    const width = this._container?.clientWidth || 0,
      lowest = Math.max(
        40,
        (this._controls?.offsetTop || this._container?.clientHeight || 0) - 44,
      );
    const items = [];
    for (const tag of tags) {
      const point = points.get(tag.dataset.room);
      const show =
        !!point?.visible &&
        roomButtonShows(
          buttons[tag.dataset.room]?.mode || "auto",
          point.exposure ?? 1,
          tag.dataset.shown === "true",
        );
      tag.dataset.shown = String(show);
      tag.dataset.manual = String(!!point?.manual);
      tag.hidden = !show;
      if (!show) continue;
      const size = buttons[tag.dataset.room]?.size ?? 30;
      tag.style.setProperty("--room-tag-size", size + "px");
      const w = tag.offsetWidth || 80,
        half = w / 2 + 8;
      items.push({
        tag,
        w,
        h: size,
        fixed: point.manual,
        // A placed button is centred on its spot; others hang below the edge.
        offset: point.manual ? -size / 2 : 6,
        x:
          width > 2 * half
            ? Math.max(half, Math.min(width - half, point.x))
            : point.x,
        y:
          Math.max(8, Math.min(lowest, point.y)) +
          (point.manual ? -size / 2 : 6),
      });
    }
    const ys = spreadButtons(items);
    items.forEach((item, i) => {
      item.tag.style.left = item.x + "px";
      item.tag.style.top = Math.min(lowest, ys[i] - item.offset) + "px";
    });
  }
  /** The manager page that edits this card's saved view, or its room. */
  _editorURL() {
    const model = this._config?.model,
      saved = this._sourceConfig?.saved_view;
    if (!model) return null;
    const query = new URLSearchParams({ model });
    if (saved) {
      query.set("tab", "views");
      query.set("saved_view", saved);
    }
    // Only ids the manager's own route accepts are passed on.
    const route = roomRoute(query);
    if (!route.has("model")) return null;
    const path = `/three_d_rooms?${route}`;
    return this._hass?.hassUrl?.(path) ?? path;
  }
  _openEditor() {
    const url = this._editorURL();
    if (url) window.open(url, "_blank", "noopener");
  }
  /** The manager is for administrators and for real Home Assistant, not previews. */
  _syncEditButton() {
    this._editButton.hidden = !(
      this._view &&
      this._hass?.user?.is_admin &&
      !this._preview &&
      !this._config?.addon &&
      this._config?.edit_button !== false &&
      this._editorURL()
    );
  }
  /** Session-only camera controls; the saved card framing never changes. */
  _syncCameraButtons() {
    const shown = !!this._view && this._config?.camera_controls !== false;
    this._moveCamera.hidden = !shown;
    this._moveCamera.setAttribute("aria-pressed", String(!!this._cameraFree));
    this._moveCamera.title = this._cameraFree
      ? "Camera movement on — drag to orbit, pinch or scroll to zoom. Click to lock."
      : "Camera locked. Click to allow moving the camera.";
    this._resetCamera.hidden =
      !shown || (!this._cameraFree && !this._cameraMoved);
  }
  _setCameraMovement(enabled) {
    this._cameraFree = !!enabled;
    this._cameraTouched = true;
    this._view?.setInteractive(this._cameraFree);
    this._syncCameraButtons();
  }
  _resetView() {
    if (!this._view) return;
    this._view.reset();
    this._cameraMoved = false;
    this._syncCameraButtons();
  }
  _background() {
    return this._config?.background || DEFAULT_BACKGROUND;
  }
  /** Paint the backdrop for the chosen preset and the current time of day. */
  _applyBackdrop(sun) {
    const layer = this.shadowRoot.querySelector(".backdrop");
    if (!layer || !this._config) return;
    const time = tone(
      effectiveElevation(
        this._model?.daylight?.mode,
        sun ?? this._hass?.states?.[this._model?.daylight?.entity || "sun.sun"],
      ),
    );
    paintBackdrop(layer, this._config, time);
  }
  _syncDaylightSwitch() {
    const daylight = this._model?.daylight;
    this._daylightSwitch.hidden = !daylight || !!this._preview;
    if (daylight) this._showDaylightMode(daylight.mode);
  }
  /** Slide the highlight onto the current time-of-day option. */
  _showDaylightMode(mode) {
    const group = this._daylightSwitch,
      shown = DAYLIGHT_MODES[mode] ? mode : "auto";
    group.value = shown;
    if (group.dataset) group.dataset.mode = shown;
    for (const button of group.querySelectorAll?.("button") || []) {
      const chosen = button.dataset.mode === shown;
      button.setAttribute("aria-checked", String(chosen));
      button.tabIndex = chosen ? 0 : -1;
    }
  }
  _chooseDaylight(mode) {
    if (mode !== this._daylightSwitch.value) this._setDaylight(mode);
  }
  /** Daylight is saved with the room; a failed save restores the old mode. */
  async _setDaylight(mode) {
    const daylight = this._model?.daylight;
    if (!daylight || this._preview) return;
    const previous = daylight.mode;
    const apply = (value) => {
      daylight.mode = value;
      this._showDaylightMode(value);
      this._signature = null;
      this._states();
    };
    apply(mode);
    try {
      const result = await this._hass.callWS({
        type: "three_d_rooms/request",
        operation: "daylight",
        data: { model: this._model.id, mode, entity: daylight.entity },
      });
      daylight.mode = result.daylight.mode;
    } catch (error) {
      apply(previous);
      this.shadowRoot.querySelector(".fixture-feedback")?.remove();
      const message = document.createElement("div");
      message.className = "fixture-feedback";
      message.setAttribute("role", "alert");
      message.textContent =
        error.message || "Could not save the time of day for this room.";
      this._container.append(message);
      setTimeout(() => message.remove(), 5000);
    }
  }
  /** Reload only when the room itself changed, not for a daylight-only edit. */
  async _modelsChanged() {
    const generation = this._generation;
    try {
      if (this._sourceConfig?.saved_view) {
        const components = await this._hass.callWS({
          type: "three_d_rooms/request",
          operation: "components",
        });
        if (generation !== this._generation) return;
        const resolved = resolveSavedView(this._sourceConfig, components);
        if (JSON.stringify(resolved) !== JSON.stringify(this._config)) {
          this._load();
          return;
        }
      }
      const models = await this._hass.callWS({
        type: "three_d_rooms/request",
        operation: "models",
      });
      // A focused room is derived from the house view it came from.
      const shown = this._focus?.base ?? this._model;
      const next = models.find(
        (m) => m.id === (shown?.id ?? this._config?.model),
      );
      const rest = ({ daylight, ...model }) => JSON.stringify(model);
      // A house card holds all its floors, so any changed floor needs a reload.
      const loaded = this._views?.length ? this._views : [shown];
      const unchanged = loaded.every((view) => {
        const fresh = models.find((m) => m.id === view?.id);
        return fresh && rest(fresh) === rest(view);
      });
      if (
        generation === this._generation &&
        next &&
        shown &&
        unchanged &&
        rest(next) === rest(shown) &&
        !!next.daylight === !!shown.daylight
      ) {
        if (next.daylight)
          shown.daylight = this._model.daylight = next.daylight;
        this._syncDaylightSwitch();
        this._signature = null;
        this._states();
        return;
      }
    } catch {}
    if (generation === this._generation) this._load();
  }
  _buildAccess() {
    this._covered = new Set();
    this.shadowRoot.querySelector(".fixture-access")?.remove();
    this.shadowRoot.querySelector(".fixture-tray")?.remove();
    const access = document.createElement("div");
    access.className = "fixture-access";
    const tray = document.createElement("div");
    tray.className = "fixture-tray";
    for (const control of this._model.controls) {
      if (control.hidden) continue;
      const device = deviceForControl(this._model, control.id);
      if (
        control.lightGroupPrimary === false ||
        (device && device.height !== control.id)
      )
        continue;
      const button = document.createElement("button");
      const label = device?.label || deviceLabel(control, "light");
      button.dataset.control = control.id;
      const presentation = markerSettings(this._config.markers, control.id);
      button.style.setProperty("--marker-size", presentation.size + "px");
      button.setAttribute(
        "aria-label",
        control.type !== "light"
          ? `Control ${label}`
          : `Toggle ${label}. Hold for more info.`,
      );
      button.title =
        control.type !== "light"
          ? `${label}: value controls`
          : `${label}: click to toggle, hold for more info`;
      // Keep the viewer’s AC glyph; HA resolves other device and state icons.
      // Light-DOM SVG is a fallback for standalone previews without HA elements.
      // A view may choose its own icon; HA then draws it in place of the state icon.
      // A view's own icon, else the room's icon, else HA's state icon.
      // Separate icons for the on and off state are applied on every update.
      const customIcon = stateIconName(presentation, control, false);
      const anyCustom =
        customIcon || stateIconName(presentation, control, true);
      const icon = document.createElement(
        control.type === "climate" && !anyCustom ? "span" : "ha-state-icon",
      );
      if (control.type === "climate" && !anyCustom)
        icon.className = "fixture-ac-icon";
      if (customIcon) icon.icon = customIcon;
      icon.setAttribute("aria-hidden", "true");
      // Light-DOM fallback for previews outside HA; HA draws every mdi: name itself.
      icon.innerHTML = customIcon
        ? `<svg viewBox="0 0 24 24">${markerIconPath(customIcon) || ""}</svg>`
        : control.type === "climate"
          ? `<svg viewBox="0 0 24 24">${AC_ICON_PATH}</svg>`
          : control.type === "lock"
            ? `<svg viewBox="0 0 24 24">${LOCK_ICON_PATH}</svg>`
            : control.type === "button"
              ? '<svg viewBox="0 0 24 24"><path d="m8 4 12 8-12 8Z"/></svg>'
              : control.type === "number"
                ? '<svg viewBox="0 0 24 24"><path d="M3 7h18v3H3zm2 3h2v11H5zm12 0h2v11h-2z"/></svg>'
                : control.type !== "light"
                  ? '<svg viewBox="0 0 24 24"><path d="M3 3h18v2H3zm1 4h16v2H4zm0 4h16v2H4zm0 4h16v2H4zm7 4h2v3h-2z"/></svg>'
                  : '<svg viewBox="0 0 24 24"><path d="M9 21h6v-1H9v1Zm3-19a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2Zm2.85 11.1-.85.6V16h-4v-2.3l-.85-.6a5 5 0 1 1 5.7 0Z"/></svg>';
      const badge = document.createElement("span");
      badge.className = "fixture-state";
      badge.setAttribute("aria-hidden", "true");
      badge.hidden = !presentation.show_label;
      button.append(icon);
      if (presentation.placement === "tray") {
        const name = document.createElement("span");
        name.className = "fixture-name";
        name.textContent = label;
        button.append(name);
      }
      button.append(badge);
      let timer,
        origin,
        held = false;
      const cancel = () => {
        clearTimeout(timer);
        origin = null;
      };
      button.onpointerdown = (event) => {
        if (event.button !== 0) return;
        held = false;
        origin = [event.clientX, event.clientY];
        button.setPointerCapture(event.pointerId);
        timer = setTimeout(() => {
          held = true;
          this._pick(control.id);
        }, 500);
      };
      button.onpointermove = (event) => {
        if (
          origin &&
          Math.hypot(event.clientX - origin[0], event.clientY - origin[1]) > 8
        ) {
          held = true;
          cancel();
        }
      };
      button.onpointerup = cancel;
      button.onpointercancel = () => {
        held = true;
        cancel();
      };
      button.onlostpointercapture = cancel;
      button.oncontextmenu = (event) => event.preventDefault();
      button.onclick = () => {
        if (!held) this._toggle(control.id);
        held = false;
      };
      button.onkeydown = (event) => {
        if (event.key === "F2" || (event.shiftKey && event.key === "Enter")) {
          event.preventDefault();
          this._pick(control.id);
        }
      };
      if (presentation.visible)
        (presentation.placement === "tray" ? tray : access).append(button);
    }
    this._container.append(access);
    this.shadowRoot.querySelector("ha-card").append(tray);
    this._groupChips = new Map();
    this._openGroup = null;
    this._positionButtons();
    this._buildLightPanel();
  }
  /** Room shades: covers the loaded scene animates as roller shades. */
  _isShade(control) {
    return !!this._view?.fixtures
      ?.get(control.id)
      ?.coverNodes?.some((node) => node?.userData?.rollerShade);
  }
  /** Wording for the open panel's kind. */
  _panelWords(kind = this._panelKind || "light") {
    return kind === "shade"
      ? {
          title: "Shades",
          noun: "shades",
          one: "shade",
          on: "open",
          turnOn: "Open",
          turnOff: "Close",
        }
      : {
          title: "Lights",
          noun: "lights",
          one: "light",
          on: "on",
          turnOn: "Turn on",
          turnOff: "Turn off",
        };
  }
  /** Rebuild the Lights/Shades panel for the shown room, house or floor. */
  _buildLightPanel() {
    this._panelRooms = {
      light: this._config?.light_panel === false ? [] : roomLights(this._model),
      shade:
        this._config?.shade_panel === false
          ? []
          : roomDevices(this._model, "shade", (c) => this._isShade(c)),
    };
    for (const [kind, button] of Object.entries(this._panelButtons))
      button.hidden = !this._panelRooms[kind].length;
    if (this._panelKind && !this._panelRooms[this._panelKind].length)
      this._panelKind = null;
    const kind = this._panelKind;
    this._rooms = this._panelRooms[kind || "light"];
    for (const [k, button] of Object.entries(this._panelButtons))
      button.setAttribute("aria-expanded", String(k === kind));
    this._lightPanel?.remove();
    this._lightPanel = null;
    if (!kind) return;
    const words = this._panelWords(kind);
    for (const room of this._rooms)
      if (this._rooms.length === 1) this._expandedRooms.add(kind + room.id);
    const panel = document.createElement("div");
    panel.className = "light-panel";
    panel.dataset.kind = kind;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", `Room ${words.noun}`);
    panel.innerHTML =
      '<h2><span></span><span class="light-room-count"></span><button type="button" role="switch" data-room-switch=""></button><button type="button" class="panel-close">×</button></h2><div class="light-rooms"></div>';
    panel.querySelector("h2 span").textContent = words.title;
    panel
      .querySelector('h2 [role="switch"]')
      .setAttribute("aria-label", `All ${words.noun}`);
    panel
      .querySelector(".panel-close")
      .setAttribute("aria-label", `Close ${words.noun}`);
    panel.querySelector('h2 [role="switch"]').onclick = async () => {
      if (await this._confirmAllLights()) this._toggleRoomLights("");
    };
    panel.querySelector(".panel-close").onclick = () =>
      this._setLightPanel(null);
    panel.onkeydown = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      this._setLightPanel(null);
      this._panelButtons[kind].focus();
    };
    const list = panel.querySelector(".light-rooms");
    for (const room of this._rooms) {
      const section = document.createElement("section");
      section.className = "light-room";
      section.dataset.room = room.id;
      const head = document.createElement("div");
      head.className = "light-room-head";
      const expand = document.createElement("button");
      expand.type = "button";
      expand.innerHTML =
        '<svg class="light-chevron" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m9 6 6 6-6 6z"/></svg><span class="light-room-title"></span><span class="light-room-count"></span>';
      expand.querySelector(".light-room-title").textContent = room.title;
      const key = kind + room.id,
        expanded = this._expandedRooms.has(key);
      expand.setAttribute("aria-expanded", String(expanded));
      const all = document.createElement("button");
      all.type = "button";
      all.setAttribute("role", "switch");
      all.dataset.roomSwitch = room.id;
      all.setAttribute("aria-label", `All ${room.title} ${words.noun}`);
      all.onclick = () => this._toggleRoomLights(room.id);
      head.append(expand, all);
      const devices = document.createElement("ul");
      devices.className = "light-list";
      devices.hidden = !expanded;
      expand.onclick = () => {
        const open = devices.hidden;
        devices.hidden = !open;
        expand.setAttribute("aria-expanded", String(open));
        if (open) this._expandedRooms.add(key);
        else this._expandedRooms.delete(key);
      };
      for (const device of room.lights) {
        const row = document.createElement("li");
        row.className = "light-row";
        row.dataset.light = device.id;
        const name = document.createElement("button");
        name.type = "button";
        name.title = `${device.label}: details`;
        const icon = document.createElement("ha-state-icon");
        icon.setAttribute("aria-hidden", "true");
        icon.innerHTML = this._panelButtons[kind].innerHTML;
        const label = document.createElement("span");
        label.className = "light-name";
        label.textContent = device.label;
        name.append(icon, label);
        name.onclick = () => this._pick(device.id);
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.setAttribute("role", "switch");
        toggle.setAttribute("aria-label", device.label);
        toggle.onclick = () =>
          kind === "shade"
            ? this._toggleShade(device.id)
            : this._toggle(device.id);
        row.append(name, toggle);
        // Point at the device's marker in the room while hovering its row.
        const highlight = (on) => {
          for (const marker of this.shadowRoot.querySelectorAll(
            "[data-control]",
          ))
            if (marker.dataset.control === device.id)
              marker.dataset.highlight = String(on);
          // A grouped icon is pointed out through its room chip.
          const room = this._groupOf?.get(device.id);
          if (room && this._groupChips.get(room))
            this._groupChips.get(room).dataset.highlight = String(on);
        };
        row.onpointerenter = () => highlight(true);
        row.onpointerleave = () => highlight(false);
        row.addEventListener("focusin", () => highlight(true));
        row.addEventListener("focusout", () => highlight(false));
        devices.append(row);
      }
      section.append(head, devices);
      list.append(section);
    }
    this._lightPanel = panel;
    this._container.append(panel);
    this._syncLightPanel();
  }
  /** The All switch affects every room shown, so it asks first. */
  _confirmAllLights() {
    const everything = allLights(this._rooms || []),
      states = this._lightStates || new Map(),
      { on, available } = roomLightSummary(everything, states),
      turnOn = on === 0,
      words = this._panelWords(),
      plural = (n) => (n === 1 ? words.one : words.noun);
    this._dialog?.remove();
    const dialog = document.createElement("dialog");
    this._dialog = dialog;
    dialog.className = "confirm-all-lights";
    dialog.innerHTML =
      '<form method="dialog"><h2></h2><p></p><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button value="cancel" autofocus>Cancel</button><button value="ok" class="confirm"></button></div></form>';
    dialog.querySelector("h2").textContent =
      `${turnOn ? words.turnOn : words.turnOff} all ${words.noun}?`;
    dialog.querySelector("p").textContent = turnOn
      ? `This will ${words.turnOn.toLowerCase()} ${available} ${plural(available)} in ${this._rooms.length === 1 ? this._rooms[0].title : "every room shown"}. Hidden devices are not changed.`
      : `This will ${words.turnOff.toLowerCase()} the ${on} ${plural(on)} that ${on === 1 ? "is" : "are"} ${words.on}. Hidden devices are not changed.`;
    dialog.querySelector(".confirm").textContent = turnOn
      ? `${words.turnOn} all`
      : `${words.turnOff} all`;
    this.shadowRoot.append(dialog);
    return new Promise((resolve) => {
      dialog.addEventListener("close", () => {
        resolve(dialog.returnValue === "ok");
        dialog.remove();
      });
      dialog.showModal();
    });
  }
  /** Open one kind of panel, or close it with null. */
  _setLightPanel(kind) {
    this._panelKind = kind === true ? "light" : kind || null;
    this._buildLightPanel();
  }
  /** Reflect live (or preview) states in the panel's switches. */
  _syncLightPanel(states = this._lightStates) {
    const panel = this._lightPanel;
    if (!panel || !states) return;
    const words = this._panelWords(),
      isOn = PANEL_KINDS[this._panelKind || "light"].isOn,
      everything = allLights(this._rooms),
      total = roomLightSummary(everything, states),
      master = panel.querySelector('h2 [role="switch"]');
    panel.querySelector("h2 .light-room-count").textContent = total.available
      ? `${total.on} ${words.on}`
      : "";
    master.setAttribute("aria-checked", String(total.on > 0));
    master.disabled =
      !total.available || (!this._preview && !everything.entities.length);
    master.title = `${total.on ? words.turnOff : words.turnOn} all ${words.noun}`;
    for (const room of this._rooms) {
      const section = [...panel.querySelectorAll("[data-room]")].find(
        (s) => s.dataset.room === room.id,
      );
      if (!section) continue;
      const summary = roomLightSummary(room, states);
      section.querySelector(".light-room-count").textContent = summary.available
        ? `${summary.on} of ${summary.available} ${words.on}`
        : room.entities.length || this._preview
          ? "Unavailable"
          : "Not connected";
      const all = section.querySelector("[data-room-switch]");
      all.setAttribute("aria-checked", String(summary.on > 0));
      all.disabled =
        !summary.available || (!this._preview && !room.entities.length);
      all.title = `${summary.on ? words.turnOff : words.turnOn} all ${room.title} ${words.noun}`;
      for (const row of section.querySelectorAll("[data-light]")) {
        const device = room.lights.find((l) => l.id === row.dataset.light),
          state = states.get(device.id) || {},
          entity = this._hass?.states?.[device.entityId],
          unavailable = !!state.unavailable || !device.entityId,
          on = !unavailable && isOn(state);
        row.dataset.on = String(on);
        row.dataset.unavailable = String(unavailable);
        const toggle = row.querySelector('[role="switch"]');
        toggle.setAttribute("aria-checked", String(on));
        toggle.disabled = unavailable && !this._preview;
        const icon = row.querySelector("ha-state-icon");
        if (icon && entity) {
          icon.hass = this._hass;
          icon.stateObj = entity;
        }
      }
    }
  }
  /** Open a closed shade, close an open one. */
  async _toggleShade(id) {
    const states = this._lightStates || new Map(),
      open = PANEL_KINDS.shade.isOn(states.get(id) || {});
    if (this._preview) {
      this._previewStates.set(id, { position: open ? 0 : 100 });
      this._states();
      return;
    }
    const entityId = this._model.bindings[id];
    const entity = this._hass.states?.[entityId];
    if (
      !entityId?.startsWith("cover.") ||
      !entity ||
      ["unavailable", "unknown"].includes(entity.state)
    )
      return;
    try {
      await this._hass.callService(
        "cover",
        open ? "close_cover" : "open_cover",
        { entity_id: entityId },
      );
    } catch {
      this._panelFeedback("Could not move the shade. Try again.");
    }
  }
  _panelFeedback(text) {
    this.shadowRoot.querySelector(".fixture-feedback")?.remove();
    const message = document.createElement("div");
    message.className = "fixture-feedback";
    message.setAttribute("role", "alert");
    message.textContent = text;
    this._container.append(message);
    setTimeout(() => message.remove(), 5000);
  }
  /** One switch per room: anything on/open turns all off/closed, else on/open. */
  async _toggleRoomLights(roomId, given) {
    const room =
      given ||
      (roomId === ""
        ? this._rooms?.length && allLights(this._rooms)
        : this._rooms?.find((r) => r.id === roomId));
    if (!room || this._pendingRooms.has(roomId)) return;
    const states = this._lightStates || new Map();
    const words = this._panelWords(room.kind);
    if (this._preview) {
      const on = roomLightSummary(room, states).on === 0;
      for (const device of room.lights) {
        if (room.kind === "shade") {
          this._previewStates.set(device.id, { position: on ? 100 : 0 });
          continue;
        }
        const control = this._model.controls.find((c) => c.id === device.id);
        const state = this._previewStates.get(device.id) || {
          on: true,
          brightness: 255,
          rgb: hexToRgb(control?.color || "#fff0d4"),
        };
        this._previewStates.set(device.id, { ...state, on });
      }
      this._states();
      return;
    }
    const { calls } = roomLightCommands(room, states, this._hass.states);
    if (!calls.length) return;
    this._pendingRooms.add(roomId);
    const all = [
      ...(this._lightPanel?.querySelectorAll("[data-room-switch]") || []),
    ].find((b) => b.dataset.roomSwitch === roomId);
    all?.setAttribute("aria-busy", "true");
    this.shadowRoot.querySelector(".fixture-feedback")?.remove();
    try {
      await Promise.all(calls.map((call) => this._hass.callService(...call)));
    } catch {
      this._panelFeedback(
        roomId
          ? `Could not change the ${room.title} ${words.noun}. Try again.`
          : `Could not change the ${words.noun}. Try again.`,
      );
    } finally {
      this._pendingRooms.delete(roomId);
      all?.removeAttribute("aria-busy");
    }
  }
  /**
   * Icons of devices that lie under another room of the house (a light below
   * the bedroom's floor) do not show. Worked out once the camera has stopped
   * moving, from what the scene actually draws.
   */
  _scheduleCoverCheck() {
    clearTimeout(this._coverTimer);
    if (!this._model?.houseView || this._model.focusRoom) {
      if (this._covered?.size) this._covered = new Set();
      return;
    }
    this._coverTimer = setTimeout(() => this._checkCovered(), 150);
  }
  _checkCovered() {
    if (!this._view?.coveredMarkers || !this._model) return;
    const entries = [];
    for (const button of this.shadowRoot.querySelectorAll("[data-control]")) {
      const id = button.dataset.control,
        settings = markerSettings(this._config?.markers, id);
      if (settings.placement === "tray" || !settings.visible) continue;
      const room = this._model.controls.find((c) => c.id === id)?.sourceModel;
      if (room) entries.push({ id, room, offset: settings.offset });
    }
    let covered;
    try {
      covered = this._view.coveredMarkers(entries);
    } catch {
      // Without the check, icons simply show as they did before.
      covered = new Set();
    }
    const key = (set) => [...set].sort().join("|");
    if (key(covered) === key(this._covered || new Set())) return;
    this._covered = covered;
    this._positionButtons(true);
  }
  _positionButtons(afterCoverCheck = false) {
    const width = this._container.clientWidth,
      height = this._container.clientHeight,
      items = [];
    for (const button of this.shadowRoot.querySelectorAll("[data-control]")) {
      const settings = markerSettings(
        this._config?.markers,
        button.dataset.control,
      );
      if (settings.placement === "tray") {
        button.hidden = !settings.visible;
        continue;
      }
      const point = this._view?.fixtureScreenPosition(
        button.dataset.control,
        settings.offset,
      );
      button.hidden =
        !settings.visible ||
        !point?.visible ||
        !!this._covered?.has(button.dataset.control);
      if (!point) continue;
      const layout = markerLayout(point, settings, width, height);
      button.style.left = layout.left + "px";
      button.style.top = layout.top + "px";
      if (!button.hidden)
        items.push({
          id: button.dataset.control,
          room: this._model?.controls.find(
            (c) => c.id === button.dataset.control,
          )?.sourceModel,
          x: layout.left + settings.size / 2,
          y: layout.top + settings.size / 2,
          size: settings.size,
          button,
        });
    }
    this._groupIcons(items, width, height);
    this._positionRoomTags();
    if (!afterCoverCheck) this._scheduleCoverCheck();
  }
  /**
   * House and floor views: a room whose icons overlap shows one chip; the
   * chip shows that room's icons in their real places until you tap
   * elsewhere or press Escape.
   */
  _groupIcons(items, width, height) {
    this._groupChips ||= new Map();
    // Only rooms set to "Group this room's icons" in their settings group.
    const grouping = new Set(
      this._model?.houseView
        ? (this._model.members || [])
            .filter((m) => m.groupIcons)
            .map((m) => m.model)
        : [],
    );
    const enabled = grouping.size > 0;
    items = items.filter((item) => grouping.has(item.room));
    const open = this._openGroup;
    const groups = enabled
      ? groupMarkers(items, { open: new Set(open ? [open] : []) })
      : [];
    // The open room shows its icons where they really are; tapping elsewhere
    // (or Escape) groups it again. Once its icons no longer overlap it stays
    // ungrouped on its own.
    if (open && !(enabled && roomCrowded(items, open))) this._openGroup = null;
    this._groupOf = new Map();
    const shown = new Set();
    for (const group of groups) {
      shown.add(group.room);
      for (const id of group.ids) {
        this._groupOf.set(id, group.room);
        const item = items.find((i) => i.id === id);
        if (item) item.button.hidden = true;
      }
      let chip = this._groupChips.get(group.room);
      if (!chip) {
        chip = document.createElement("button");
        chip.type = "button";
        chip.className = "room-group";
        chip.dataset.groupRoom = group.room;
        chip.onclick = () => {
          this._openGroup = this._openGroup === group.room ? null : group.room;
          this._positionButtons();
          if (this._openGroup)
            [
              ...this.shadowRoot.querySelectorAll(
                ".fixture-access [data-control]",
              ),
            ]
              .find(
                (b) =>
                  !b.hidden &&
                  this._model?.controls.find((c) => c.id === b.dataset.control)
                    ?.sourceModel === group.room,
              )
              ?.focus();
        };
        this.shadowRoot.querySelector(".fixture-access")?.append(chip);
        this._groupChips.set(group.room, chip);
      }
      const members = this._model.controls.filter((c) =>
          group.ids.includes(c.id),
        ),
        active = members.filter(
          (c) =>
            this.shadowRoot.querySelector(
              `.fixture-access [data-control="${CSS.escape(c.id)}"]`,
            )?.dataset.active === "true",
        ).length,
        title = shortRoomTitle(
          this._model.controls.find((c) => c.sourceModel === group.room)
            ?.roomTitle || "Room",
        );
      chip.hidden = false;
      chip.style.left = group.x + "px";
      chip.style.top = group.y + "px";
      chip.dataset.active = String(active > 0);
      chip.innerHTML =
        '<span class="group-name"></span><span class="group-count"></span>';
      chip.querySelector(".group-name").textContent = title;
      chip.querySelector(".group-count").textContent = group.ids.length;
      chip.setAttribute(
        "aria-label",
        `${title}: ${group.ids.length} devices${active ? `, ${active} on` : ""}. Show them`,
      );
      chip.title = `${title} — ${group.ids.length} devices${active ? `, ${active} on` : ""}`;
    }
    for (const [room, chip] of this._groupChips)
      if (!shown.has(room)) chip.hidden = true;
  }
  async _toggle(id) {
    const control = this._model.controls.find((c) => c.id === id);
    if (!control || control.hidden) return;
    if (control.type === "button") {
      await this._pressPreset(control);
      return;
    }
    if (
      control.type === "climate" ||
      control.type === "lock" ||
      control.type === "cover" ||
      control.type === "number"
    ) {
      this._pick(id);
      return;
    }
    if (this._preview) {
      const state = this._previewStates.get(id) || {
        on: true,
        brightness: 255,
        rgb: hexToRgb(control.color || "#fff0d4"),
      };
      this._previewStates.set(id, { ...state, on: !state.on });
      this._states();
      return;
    }
    const entityId = this._model.bindings[id];
    const entity = this._hass.states?.[entityId];
    if (!entity || ["unavailable", "unknown"].includes(entity.state)) return;
    this._pendingToggles ||= new Set();
    if (this._pendingToggles.has(id)) return;
    this._pendingToggles.add(id);
    const button = [...this.shadowRoot.querySelectorAll("[data-control]")].find(
      (b) => b.dataset.control === id,
    );
    button?.setAttribute("aria-busy", "true");
    this.shadowRoot.querySelector(".fixture-feedback")?.remove();
    try {
      const domain = entityId.split(".")[0];
      await this._hass.callService(
        ["light", "switch", "input_boolean", "fan"].includes(domain)
          ? domain
          : "homeassistant",
        "toggle",
        { entity_id: entityId },
      );
    } catch {
      const message = document.createElement("div");
      message.className = "fixture-feedback";
      message.setAttribute("role", "alert");
      message.textContent = "Could not change the light. Try again.";
      this._container.append(message);
    } finally {
      this._pendingToggles.delete(id);
      button?.removeAttribute("aria-busy");
    }
  }
  async _pressPreset(control) {
    if (this._preview || !this._model.bindings[control.id]) {
      this._pick(control.id);
      return;
    }
    const entity = this._hass.states?.[this._model.bindings[control.id]];
    if (actionState(entity).unavailable) return;
    this._pendingPresets ||= new Set();
    if (this._pendingPresets.has(control.id)) return;
    this._pendingPresets.add(control.id);
    try {
      await this._hass.callWS({
        type: "three_d_rooms/request",
        operation: "command",
        data: { model: this._model.id, controlId: control.id, action: "press" },
      });
    } catch {
      const message = document.createElement("div");
      message.className = "fixture-feedback";
      message.setAttribute("role", "alert");
      message.textContent = "Could not run the preset. Try again.";
      this._container.append(message);
    } finally {
      this._pendingPresets.delete(control.id);
    }
  }
  _pick(id) {
    if (this._layout?.fullscreen) {
      document
        .exitFullscreen()
        .then(() => this._pick(id))
        .catch(() => {});
      return;
    }
    const control = this._model.controls.find((c) => c.id === id);
    if (!control || control.hidden) return;
    const desk = deviceForControl(this._model, id);
    if (desk) {
      this._deskDialog(desk);
      return;
    }
    const entityId = this._model.bindings[id];
    if (!this._preview && entityId) {
      this.dispatchEvent(
        new CustomEvent("hass-more-info", {
          detail: { entityId },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }
    if (control.type === "climate") {
      this._dialog?.remove();
      const dialog = document.createElement("dialog");
      this._dialog = dialog;
      dialog.innerHTML =
        '<form method="dialog"><h2>Air conditioner</h2><p>Connect this AC to its climate entity in 3D Rooms → Devices. The mapped device opens Home Assistant controls for temperature, mode and fan features.</p><button>Close</button></form>';
      this.shadowRoot.append(dialog);
      dialog.showModal();
      return;
    }
    if (control.type === "button") {
      this._dialog?.remove();
      const dialog = document.createElement("dialog");
      this._dialog = dialog;
      dialog.innerHTML =
        '<form method="dialog"><h2></h2><p>Connect this preset to its button, script or scene in 3D Rooms → Devices.</p><button>Close</button></form>';
      dialog.querySelector("h2").textContent = deviceLabel(control);
      this.shadowRoot.append(dialog);
      dialog.showModal();
      return;
    }
    if (control.type === "number") {
      this._numberPreview(control);
      return;
    }
    if (control.type === "lock") {
      this._lockPreview(control);
      return;
    }
    if (control.type === "cover") {
      this._coverPreview(control);
      return;
    }
    this._dialog?.remove();
    const dialog = document.createElement("dialog");
    this._dialog = dialog;
    dialog.innerHTML = `<form method="dialog"><h2></h2><p></p><div class="preview-controls"><button type="button" role="switch">On</button><label>Brightness<input type="range" min="1" max="255"></label><label>Color<input type="color"></label><label>Temperature<input type="range" min="2000" max="6500" step="100"></label></div><button class="close">Close</button></form>`;
    dialog.querySelector("h2").textContent = deviceLabel(control, "Room light");
    dialog.querySelector("p").textContent = this._preview
      ? "Local preview · no real device commands"
      : "Connect this light to an entity in 3D Rooms → Model settings.";
    dialog.querySelector(".preview-controls").hidden = !this._preview;
    const state = {
      ...(this._previewStates.get(id) || {
        on: true,
        brightness: 255,
        rgb: hexToRgb(control.color || "#fff0d4"),
      }),
    };
    const toggle = dialog.querySelector('[role="switch"]');
    const brightness = dialog.querySelector('[type="range"]');
    const color = dialog.querySelector('[type="color"]');
    const temperature = dialog.querySelectorAll('[type="range"]')[1];
    const update = () => {
      toggle.textContent = state.on ? "On" : "Off";
      toggle.setAttribute("aria-checked", String(state.on));
      toggle.setAttribute("aria-label", "Light power");
      this._previewStates.set(id, { ...state });
      this._states();
    };
    brightness.value = state.brightness;
    color.value =
      "#" +
      state.rgb
        .map((v) => Math.round(v).toString(16).padStart(2, "0"))
        .join("");
    temperature.value = state.colorTempKelvin || 3000;
    toggle.onclick = () => {
      state.on = !state.on;
      update();
    };
    brightness.oninput = () => {
      state.brightness = Number(brightness.value);
      update();
    };
    color.oninput = () => {
      state.rgb = hexToRgb(color.value);
      update();
    };
    temperature.oninput = () => {
      state.colorTempKelvin = Number(temperature.value);
      state.rgb = kelvinToRgb(state.colorTempKelvin);
      color.value =
        "#" + state.rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
      update();
    };
    if (this._preview) update();
    dialog.addEventListener("close", () => dialog.remove());
    this.shadowRoot.append(dialog);
    dialog.showModal();
  }
  _deskDialog(device) {
    this._dialog?.remove();
    const dialog = document.createElement("dialog");
    this._dialog = dialog;
    dialog.className = "dm";
    dialog.dataset.desk = device.id;
    dialog.innerHTML = DESK_HTML;
    dialog.querySelector("h2").textContent = device.label;
    const macros = dialog.querySelector(".dm-macros");
    for (const [index, id] of device.macros.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dm-round";
      button.dataset.macro = id;
      button.setAttribute("aria-label", "Macro " + (index + 1));
      const disc = document.createElement("span"),
        icon = document.createElement("ha-state-icon"),
        label = document.createElement("span");
      disc.className = "dm-disc";
      icon.setAttribute("aria-hidden", "true");
      disc.append(icon);
      button.append(disc, label);
      macros.append(button);
      button.onclick = () => this._deskCommand(id, "press");
    }
    dialog.querySelector("[data-desk-macros-section]").hidden =
      !device.macros.length;
    for (const button of dialog.querySelectorAll("[data-action]"))
      button.onclick = () =>
        this._deskCommand(device.motion, button.dataset.action);
    // Large vertical height slider: drag or use the arrow keys, then the
    // desk is sent the new height once.
    const slider = dialog.querySelector(".dm-slider");
    let keyTimer;
    const range = () => dialog._deskRange;
    const show = (value) => this._showDeskHeight(value);
    const send = (value) =>
      this._deskCommand(device.height, "set_value", value);
    slider.onpointerdown = (event) => {
      if (slider.getAttribute("aria-disabled") === "true" || !range()) return;
      event.preventDefault();
      slider.setPointerCapture(event.pointerId);
      slider.classList.add("dm-dragging");
      dialog._deskDragging = true;
      const at = (e) =>
        heightAt(e.clientY, slider.getBoundingClientRect(), range());
      dialog._deskValue = at(event);
      show(dialog._deskValue);
      slider.onpointermove = (e) => {
        dialog._deskValue = at(e);
        show(dialog._deskValue);
      };
      slider.onpointerup = slider.onpointercancel = (e) => {
        slider.onpointermove =
          slider.onpointerup =
          slider.onpointercancel =
            null;
        slider.classList.remove("dm-dragging");
        dialog._deskDragging = false;
        if (e.type === "pointerup") send(dialog._deskValue);
        else this._updateDeskDialog();
      };
    };
    slider.onkeydown = (event) => {
      const r = range();
      if (!r || slider.getAttribute("aria-disabled") === "true") return;
      const big = Math.max(r.step, (r.max - r.min) / 10);
      const delta = {
        ArrowUp: r.step,
        ArrowRight: r.step,
        ArrowDown: -r.step,
        ArrowLeft: -r.step,
        PageUp: big,
        PageDown: -big,
      }[event.key];
      const target =
        event.key === "Home"
          ? r.min
          : event.key === "End"
            ? r.max
            : delta === undefined
              ? undefined
              : (dialog._deskValue ?? r.min) + delta;
      if (target === undefined) return;
      event.preventDefault();
      dialog._deskDragging = true;
      dialog._deskValue = snapHeight(target, r);
      show(dialog._deskValue);
      clearTimeout(keyTimer);
      keyTimer = setTimeout(() => {
        dialog._deskDragging = false;
        send(dialog._deskValue);
      }, 500);
    };
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      clearTimeout(keyTimer);
      dialog.remove();
    });
    this.shadowRoot.append(dialog);
    this._updateDeskDialog();
    dialog.showModal();
  }
  _showDeskHeight(value) {
    const dialog = this._dialog,
      r = dialog?._deskRange;
    if (!r) return;
    const known = Number.isFinite(value);
    dialog.querySelector(".dm-fill").style.height =
      heightRatio(value, r) * 100 + "%";
    dialog.querySelector(".dm-big").textContent = known
      ? `${value} ${r.unit}`
      : "—";
    const slider = dialog.querySelector(".dm-slider");
    slider.setAttribute("aria-valuemin", r.min);
    slider.setAttribute("aria-valuemax", r.max);
    if (known) {
      slider.setAttribute("aria-valuenow", value);
      slider.setAttribute("aria-valuetext", `${value} ${r.unit}`);
    } else slider.removeAttribute("aria-valuenow");
  }
  async _deskCommand(id, action, value) {
    const control = this._model.controls.find((c) => c.id === id);
    if (this._preview) {
      if (control.type === "number") this._previewStates.set(id, { value });
      this._states();
      return;
    }
    const buttons =
      this._dialog?.querySelectorAll('button[type="button"]') || [];
    buttons.forEach((b) => (b.disabled = true));
    try {
      await this._hass.callWS({
        type: "three_d_rooms/request",
        operation: "command",
        data: {
          model: this._model.id,
          controlId: id,
          action,
          ...(value === undefined ? {} : { value }),
        },
      });
    } catch (error) {
      const host = this._dialog?.querySelector("[data-desk-error]");
      if (host)
        host.textContent =
          error.message || "Could not change the desk. Try again.";
    } finally {
      this._updateDeskDialog();
    }
  }
  _updateDeskDialog() {
    const dialog = this._dialog;
    if (!dialog?.dataset?.desk) return;
    const device = this._model.devices?.find(
      (d) => d.id === dialog.dataset.desk,
    );
    if (!device) return;
    const height = this._model.controls.find((c) => c.id === device.height),
      entity = this._hass.states?.[this._model.bindings[height.id]],
      reported = this._preview
        ? this._previewStates.get(height.id) || { value: height.defaultValue }
        : numberState(entity, height);
    dialog._deskRange = {
      min: Math.max(height.min, entity?.attributes?.min ?? height.min),
      max: Math.min(height.max, entity?.attributes?.max ?? height.max),
      step: Math.max(height.step, entity?.attributes?.step || height.step),
      unit: height.unit,
    };
    dialog
      .querySelector(".dm-slider")
      .setAttribute("aria-disabled", String(!!reported.unavailable));
    dialog.querySelector("[data-desk-status]").textContent =
      reported.unavailable
        ? "Unavailable"
        : reported.value === undefined
          ? "Height unknown"
          : `Height ${reported.value} ${height.unit}`;
    if (!dialog._deskDragging) {
      dialog._deskValue = reported.value;
      this._showDeskHeight(reported.value);
    }
    const cover = this._hass.states?.[this._model.bindings[device.motion]],
      features = this._preview
        ? { open: true, close: true, stop: true }
        : coverFeatures(cover),
      unavailable = !this._preview && coverState(cover).unavailable;
    for (const button of dialog.querySelectorAll("[data-action]"))
      button.disabled = unavailable || !features[button.dataset.action];
    for (const button of dialog.querySelectorAll("[data-macro]")) {
      const id = button.dataset.macro,
        e = this._hass.states?.[this._model.bindings[id]],
        name = macroName(this._model, device, id);
      button.querySelector("span:last-child").textContent =
        name || "Name macro";
      button.setAttribute(
        "aria-label",
        name || "Macro " + (device.macros.indexOf(id) + 1),
      );
      const icon = button.querySelector("ha-state-icon");
      icon.hass = this._hass;
      icon.stateObj = e || {
        entity_id: "button.preview",
        state: "unknown",
        attributes: { icon: "mdi:gesture-tap-button" },
      };
      button.disabled = !this._preview && actionState(e).unavailable;
    }
  }
  _numberPreview(control) {
    this._dialog?.remove();
    const dialog = document.createElement("dialog");
    this._dialog = dialog;
    dialog.innerHTML =
      '<form method="dialog"><h2></h2><p></p><label>Height <output></output><input type="range" aria-label="Desk height"></label><button>Close</button></form>';
    dialog.querySelector("h2").textContent = deviceLabel(control);
    dialog.querySelector("p").textContent = this._preview
      ? "Local preview · no real device commands"
      : "Connect this height to a number or input number entity in 3D Rooms → Devices.";
    const input = dialog.querySelector("input");
    Object.assign(input, {
      min: control.min,
      max: control.max,
      step: control.step,
      value:
        this._previewStates?.get(control.id)?.value ?? control.defaultValue,
      disabled: !this._preview,
    });
    const update = () => {
      dialog.querySelector("output").textContent =
        input.value + " " + control.unit;
      if (this._preview) {
        this._previewStates.set(control.id, { value: Number(input.value) });
        this._states();
      }
    };
    input.oninput = update;
    update();
    dialog.addEventListener("close", () => dialog.remove());
    this.shadowRoot.append(dialog);
    dialog.showModal();
  }
  _coverPreview(control) {
    this._dialog?.remove();
    const dialog = document.createElement("dialog");
    this._dialog = dialog;
    dialog.innerHTML =
      '<form method="dialog"><h2></h2><p></p><label>Opening <output></output><input type="range" min="0" max="100" step="1" aria-label="Shade opening"></label><button>Close</button></form>';
    dialog.querySelector("h2").textContent = deviceLabel(control);
    dialog.querySelector("p").textContent = this._preview
      ? "Local preview · no real device commands"
      : "Connect this shade to a cover entity in 3D Rooms → Model settings.";
    const input = dialog.querySelector("input");
    input.disabled = !this._preview;
    input.value =
      this._previewStates.get(control.id)?.position ??
      control.defaultPosition ??
      0;
    const update = () => {
      dialog.querySelector("output").textContent = input.value + "% open";
      if (this._preview) {
        this._previewStates.set(control.id, { position: Number(input.value) });
        this._states();
      }
    };
    input.oninput = update;
    update();
    dialog.addEventListener("close", () => dialog.remove());
    this.shadowRoot.append(dialog);
    dialog.showModal();
  }
  _lockPreview(control) {
    this._dialog?.remove();
    const dialog = document.createElement("dialog");
    this._dialog = dialog;
    dialog.innerHTML =
      '<form method="dialog"><h2></h2><p></p><div class="preview-controls"><button type="button" data-lock="unlock">Unlock</button><button type="button" data-lock="lock">Lock</button></div><button>Close</button></form>';
    dialog.querySelector("h2").textContent = deviceLabel(control);
    dialog.querySelector("p").textContent = this._preview
      ? "Local preview · no real device commands"
      : "Connect this lock to its lock entity in 3D Rooms → Devices. The mapped lock opens Home Assistant's own lock controls.";
    for (const button of dialog.querySelectorAll("[data-lock]")) {
      button.disabled = !this._preview;
      button.onclick = () => {
        const locked = button.dataset.lock === "lock";
        this._previewStates.set(control.id, {
          locked,
          label: locked ? "Locked" : "Unlocked",
          unavailable: false,
        });
        this._states();
      };
    }
    dialog.addEventListener("close", () => dialog.remove());
    this.shadowRoot.append(dialog);
    dialog.showModal();
  }
  _states() {
    if (!this._model || !this._view) return;
    const states = new Map();
    for (const control of this._model.controls) {
      const entity = this._hass.states?.[this._model.bindings[control.id]];
      if (control.type === "climate") {
        states.set(control.id, climateState(entity));
        continue;
      }
      if (control.type === "lock") {
        states.set(
          control.id,
          this._preview
            ? this._previewStates?.get(control.id) || {
                locked: true,
                label: "Locked",
                unavailable: false,
              }
            : lockState(entity),
        );
        continue;
      }
      if (control.type === "button") {
        states.set(
          control.id,
          this._preview ? { unavailable: false } : actionState(entity),
        );
        continue;
      }
      if (control.type === "number") {
        states.set(
          control.id,
          this._preview
            ? this._previewStates?.get(control.id) || {
                value: control.defaultValue,
              }
            : numberState(entity, control),
        );
        continue;
      }
      if (control.type === "cover") {
        states.set(
          control.id,
          this._preview
            ? this._previewStates?.get(control.id) || {
                position: control.defaultPosition ?? 0,
              }
            : coverState(entity),
        );
        continue;
      }
      states.set(
        control.id,
        this._preview
          ? this._previewStates?.get(control.id) || {
              on: true,
              brightness: 255,
              rgb: hexToRgb(control.color || "#fff0d4"),
            }
          : {
              on: entity?.state === "on",
              unavailable:
                !entity || ["unavailable", "unknown"].includes(entity.state),
              brightness: entity?.attributes?.brightness ?? 255,
              ...entityAppearance(entity, control.color),
            },
      );
    }
    this._updateDeskDialog();
    this._lightStates = states;
    this._syncLightPanel(states);
    this._syncRoomTagStates();
    for (const button of this.shadowRoot.querySelectorAll("[data-control]")) {
      const id = button.dataset.control;
      const control = this._model.controls.find((c) => c.id === id);
      const entity = this._hass.states?.[this._model.bindings[id]];
      const appearance = markerAppearance(
        control,
        entity,
        states.get(id),
        this._preview,
      );
      button.dataset.active = String(appearance.active);
      button.dataset.moving = String(appearance.moving);
      button.dataset.unavailable = String(appearance.unavailable);
      applyMarkerTone(button, appearance);
      const label =
        deviceForControl(this._model, id)?.label || deviceLabel(control);
      button.title = `${label}: ${appearance.description}`;
      button.setAttribute(
        "aria-label",
        `${control.type !== "light" ? "Control" : "Toggle"} ${label}, ${appearance.description}${control.type !== "light" ? "" : ". Hold for more info."}`,
      );
      button.setAttribute("aria-disabled", String(appearance.unavailable));
      if (control.type !== "light") button.removeAttribute("aria-pressed");
      else button.setAttribute("aria-pressed", String(appearance.active));
      const icon = button.querySelector("ha-state-icon");
      if (icon) {
        icon.hass = this._hass;
        icon.stateObj = appearance.stateObj;
        // Own icon for the current state, else Home Assistant's state icon.
        const named = stateIconName(
          markerSettings(this._config.markers, id),
          control,
          appearance.active,
        );
        if (icon.icon !== named) icon.icon = named;
      }
      button.querySelector(".fixture-state").textContent = appearance.badge;
    }
    const sun = this._preview
      ? undefined
      : this._hass.states?.[this._model.daylight?.entity || "sun.sun"];
    const signature = JSON.stringify([
      [...states],
      this._model.daylight?.mode,
      sun?.state,
      sun?.attributes?.elevation,
    ]);
    if (signature === this._signature) return;
    this._signature = signature;
    this._applyBackdrop(sun);
    this._view.setStates(states);
    this._view.setDaylight?.(this._model.daylight?.mode ?? "night", sun);
  }
}
if (!customElements.get("three-d-rooms-card"))
  customElements.define("three-d-rooms-card", ThreeDRoomsCard);
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "three-d-rooms-card"))
  window.customCards.push({
    type: "three-d-rooms-card",
    name: "3D Rooms",
    description:
      "Your room in perspective, with live lighting and controls on the modeled fixtures.",
    preview: true,
  });
