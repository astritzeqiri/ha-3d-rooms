import { ICONS } from "./more-info-icons.mjs";
import {
  describeEntity,
  controlCall,
  alarmNeedsCode,
  cameraUrls,
  coverIcon,
  hsToRgb,
  sinceText,
  entityRow,
  entityRowCall,
} from "./more-info-model.mjs";
import { kelvinToRgb } from "../shared/light.mjs";
import { customEntityDefaultIcon } from "../shared/custom-entities.mjs";
import {
  VACUUM_STATUS_CSS,
  VACUUM_STATUS_SVG,
  vacuumVisualState,
} from "./vacuum-art.mjs";

export { describeEntity, controlCall };

/**
 * The entity pop-up of the standalone page, laid out like Home Assistant's
 * own more-info dialog (which only exists inside its frontend): a header with
 * close, the entity's name and last change, a large control for the main
 * value, round feature buttons, and an Attributes list. It follows the
 * system light/dark setting with Home Assistant's default colours.
 */
const STYLE = `
dialog.mi{--mi-bg:#1c1c1c;--mi-fg:#e1e1e1;--mi-muted:#9b9b9b;--mi-line:#ffffff1f;--mi-surface:#ffffff14;--mi-surface-2:#ffffff24;--mi-primary:#03a9f4;--mi-ink:#fff;--mi-accent:var(--mi-primary);--mi-accent-ink:#fff;
 box-sizing:border-box;width:min(520px,calc(100vw - 32px));max-height:min(92vh,880px);margin:auto;padding:0;overflow:hidden;border:0;border-radius:28px;background:var(--mi-bg);color:var(--mi-fg);font:400 14px/1.45 Roboto,system-ui,sans-serif;box-shadow:0 24px 64px #0009;animation:mi-in .22s cubic-bezier(.2,.8,.2,1)}
@media (prefers-color-scheme:light){dialog.mi{--mi-bg:#fff;--mi-fg:#212121;--mi-muted:#727272;--mi-line:#0000001f;--mi-surface:#0000000d;--mi-surface-2:#0000001a;--mi-ink:#212121;box-shadow:0 24px 64px #0004}}
dialog.mi::backdrop{background:#000a}
@media (prefers-color-scheme:light){dialog.mi::backdrop{background:#0006}}
@keyframes mi-in{from{opacity:0;transform:translateY(20px) scale(.98)}}
@media (prefers-reduced-motion:reduce){dialog.mi{animation:none}.mi *{transition:none!important;animation:none!important}}
@media (max-width:600px){dialog.mi{width:100vw;max-width:100vw;margin:auto 0 0;border-radius:28px 28px 0 0;max-height:94vh;animation-name:mi-up}@keyframes mi-up{from{transform:translateY(100%)}}}
.mi-frame{display:flex;flex-direction:column;max-height:min(92vh,880px)}
@media (max-width:600px){.mi-frame{max-height:94vh}}
/* phones: a grab handle; the sheet follows a downward drag and is dismissed */
.mi-grab{display:none}
@media (max-width:600px){.mi-grab{display:block;flex-shrink:0;width:36px;height:4px;margin:8px auto 0;border-radius:2px;background:var(--mi-muted);opacity:.5}.mi-head{padding-top:4px}}
dialog.mi.mi-dragging{transition:none!important}
dialog.mi.mi-settling{transition:transform .22s cubic-bezier(.2,.8,.2,1)}
dialog.mi:focus{outline:none}
.mi-head{display:flex;align-items:center;gap:4px;padding:12px 16px 4px 12px;flex-shrink:0}
.mi-head .mi-titles{flex:1;min-width:0;padding-left:4px}
.mi-head h2{margin:0;font-weight:500;font-size:20px;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mi-head p{margin:0;color:var(--mi-muted);font-size:13px}
.mi-iconbtn{display:grid;place-items:center;flex-shrink:0;width:48px;height:48px;padding:0;border:0;border-radius:50%;background:transparent;color:inherit;cursor:pointer;transition:background .15s}
.mi-iconbtn:hover{background:var(--mi-surface)}
.mi svg{width:24px;height:24px;fill:currentColor;display:block}
.mi-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:8px 24px 24px}
.mi-center{display:flex;flex-direction:column;align-items:center;gap:20px}
.mi button:focus-visible,.mi [role=slider]:focus-visible{outline:2px solid var(--mi-primary);outline-offset:3px}
/* sliders */
.mi-slider{position:relative;overflow:hidden;background:var(--mi-surface);touch-action:none;cursor:pointer;user-select:none;-webkit-user-select:none;transition:background .15s}
.mi-slider:hover{background:var(--mi-surface-2)}
.mi-slider .mi-fill{position:absolute;background:var(--mi-accent);opacity:.92;transition:background .3s}
.mi-slider.mi-dragging .mi-fill{transition:none}
.mi-slider.mi-v{width:132px;height:min(300px,38vh);min-height:200px;border-radius:28px}
.mi-v .mi-fill{left:0;right:0;bottom:0}
.mi-v .mi-readout{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;pointer-events:none;color:var(--mi-accent-ink);text-shadow:0 1px 2px #0004}
.mi-v .mi-big{font:500 34px/1.1 Roboto,system-ui,sans-serif}
.mi-v .mi-small{font-size:14px;opacity:.85}
.mi-slider.mi-h{width:100%;height:48px;border-radius:14px}
.mi-h .mi-fill{left:0;top:0;bottom:0}
.mi-h.mi-track{background-image:var(--mi-gradient);background-color:transparent}
.mi-h.mi-track .mi-fill{display:none}
.mi-h .mi-thumb{position:absolute;top:8px;bottom:8px;width:6px;margin-left:-3px;border-radius:3px;background:#fff;box-shadow:0 0 0 1.5px #0004;pointer-events:none}
.mi-field{width:100%;display:grid;gap:8px}
.mi-field>.mi-label{display:flex;justify-content:space-between;font-weight:500}
.mi-field output{color:var(--mi-muted);font-weight:400}
/* round buttons */
.mi-row{display:flex;justify-content:center;flex-wrap:wrap;gap:14px;width:100%}
.mi-round{display:flex;flex-direction:column;align-items:center;gap:6px;border:0;background:none;padding:0;color:inherit;font:inherit;font-size:12px;cursor:pointer;min-width:64px}
.mi-round .mi-disc{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:var(--mi-surface-2);transition:background .15s,color .15s}
.mi-round:hover .mi-disc{background:color-mix(in srgb,var(--mi-surface-2) 70%,var(--mi-fg) 14%)}
.mi-round[aria-pressed=true] .mi-disc{background:var(--mi-accent);color:var(--mi-accent-ink)}
.mi-round:disabled{opacity:.4;cursor:default}
.mi-round>span:last-child{color:var(--mi-muted)}
.mi-round[aria-pressed=true]>span:last-child{color:var(--mi-fg)}
/* panels & lists */
.mi-panel{width:100%;display:grid;gap:18px;padding:16px;border-radius:20px;background:var(--mi-surface)}
.mi-panel[hidden]{display:none}
.mi-list{display:grid;gap:2px;margin:0;padding:0;list-style:none;max-height:220px;overflow:auto}
.mi-list button{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:44px;padding:0 12px;border:0;border-radius:12px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.mi-list button:hover{background:var(--mi-surface-2)}
.mi-list button[aria-checked=true]{color:var(--mi-primary);font-weight:500}
.mi-list button[aria-checked=true]::after{content:"✓"}
/* big tall switch and lock */
.mi-tall{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:132px;height:min(240px,32vh);min-height:170px;border:0;border-radius:28px;background:var(--mi-surface-2);color:var(--mi-muted);font:500 16px Roboto,system-ui,sans-serif;cursor:pointer;transition:background .2s,color .2s}
.mi-tall svg{width:44px;height:44px}
.mi-tall[aria-checked=true]{background:var(--mi-accent);color:var(--mi-accent-ink)}
.mi-lock{display:grid;place-items:center;width:176px;height:176px;border:0;border-radius:50%;background:color-mix(in srgb,var(--mi-accent) 22%,transparent);color:var(--mi-accent);cursor:pointer;transition:background .2s,color .2s;box-shadow:inset 0 0 0 3px color-mix(in srgb,var(--mi-accent) 55%,transparent)}
.mi-lock svg{width:72px;height:72px}
.mi-lock:disabled{opacity:.5;cursor:default}
/* cover: big state, then a tall two-way switch or a position slider */
.mi-statehead{display:flex;flex-direction:column;align-items:center;gap:2px;margin:4px 0 4px;text-align:center}
.mi-statehead strong{font:400 40px/1.15 Roboto,system-ui,sans-serif;letter-spacing:-.5px}
.mi-statehead span{color:var(--mi-muted);font-size:16px}
.mi-cover-switch{position:relative;box-sizing:border-box;width:132px;height:min(330px,40vh);min-height:220px;padding:8px;border:0;border-radius:32px;background:var(--mi-surface-2);color:inherit;cursor:pointer;touch-action:none}
.mi-cover-switch:hover{background:color-mix(in srgb,var(--mi-surface-2) 70%,var(--mi-fg) 10%)}
.mi-cover-knob{position:absolute;left:8px;right:8px;bottom:calc(8px + (50% - 8px) * var(--mi-pos,0));height:calc(50% - 8px);display:grid;place-items:center;border-radius:24px;background:#9e9e9e;color:#fff;pointer-events:none;transition:bottom .25s cubic-bezier(.3,.7,.3,1),background .25s}
.mi-cover-switch.mi-dragging .mi-cover-knob{transition:background .25s}
.mi-cover-switch[aria-checked=true] .mi-cover-knob{background:var(--mi-accent)}
.mi-cover-switch[data-moving=true]{background:color-mix(in srgb,var(--mi-accent) 28%,var(--mi-surface-2))}
.mi-cover-switch[data-moving=true] .mi-cover-knob{background:var(--mi-accent);animation:mi-moving 1.2s ease-in-out infinite}
@keyframes mi-moving{50%{opacity:.7}}
.mi-cover-knob svg{width:30px;height:30px}
.mi-cover-switch:disabled{opacity:.5;cursor:default}
.mi-cover-buttons{display:flex;gap:0;padding:4px;border-radius:24px;background:var(--mi-surface)}
.mi-cover-buttons .mi-iconbtn{width:64px;height:48px;border-radius:20px}
.mi-cover-buttons .mi-iconbtn:hover{background:var(--mi-surface-2)}
.mi-state{font:500 20px Roboto,system-ui,sans-serif}
.mi-sub{color:var(--mi-muted);margin-top:-12px}
/* climate */
.mi-temp{display:flex;align-items:center;justify-content:center;gap:20px;width:100%}
.mi-temp output{display:flex;flex-direction:column;align-items:center;min-width:140px;font:500 56px/1 Roboto,system-ui,sans-serif}
.mi-temp output small{margin-top:8px;font:400 14px Roboto,system-ui,sans-serif;color:var(--mi-muted)}
.mi-temp .mi-iconbtn{width:56px;height:56px;background:var(--mi-surface-2)}
.mi-temp .mi-iconbtn:hover{background:color-mix(in srgb,var(--mi-surface-2) 70%,var(--mi-fg) 14%)}
.mi-pill{min-height:48px;padding:0 28px;border:0;border-radius:24px;background:var(--mi-primary);color:#fff;font:500 15px Roboto,system-ui,sans-serif;cursor:pointer}
.mi-pill:hover{filter:brightness(1.08)}
/* climate dial */
.mi-climate{gap:12px}
.mi-current{display:flex;flex-direction:column;align-items:center;gap:2px;color:var(--mi-muted)}
.mi-current strong{color:var(--mi-fg);font:500 20px Roboto,system-ui,sans-serif}
.mi-dial{position:relative;width:min(300px,100%);aspect-ratio:1;touch-action:none;cursor:pointer;user-select:none;-webkit-user-select:none;border-radius:50%}
.mi-dial svg{width:100%;height:100%;overflow:visible}
.mi-dial svg path{fill:none;stroke-width:20;stroke-linecap:round}
.mi-arc-track{stroke:var(--mi-surface-2)}
.mi-arc-fill{stroke:var(--mi-accent);transition:stroke .3s}
.mi-cur{fill:var(--mi-muted)}
.mi-handle{fill:#fff;stroke:var(--mi-bg);stroke-width:0;filter:drop-shadow(0 1px 3px #0006)}
.mi-dial.mi-dragging .mi-handle{r:13}
.mi-dial-text{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;pointer-events:none}
.mi-dial-state{font:400 18px Roboto,system-ui,sans-serif}
.mi-dial-value{display:flex;align-items:flex-start;font:400 72px/1 Roboto,system-ui,sans-serif;letter-spacing:-1px}
.mi-sup{display:flex;flex-direction:column;align-items:flex-start;gap:2px;margin:6px 0 0 4px;font:400 22px/1 Roboto,system-ui,sans-serif;letter-spacing:0}
.mi-dec{font-size:22px;color:var(--mi-fg)}
.mi-dialbtns{display:flex;gap:36px;margin-top:-58px;position:relative}
.mi-outline{display:grid;place-items:center;width:56px;height:56px;padding:0;border:1px solid var(--mi-muted);border-radius:50%;background:var(--mi-bg);color:var(--mi-fg);cursor:pointer}
.mi-outline:hover{background:var(--mi-surface-2)}
.mi-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;margin-top:8px}
.mi-tile{display:flex;align-items:center;gap:12px;min-height:64px;padding:8px 14px;border:0;border-radius:16px;background:var(--mi-surface);color:inherit;font:inherit;text-align:left;cursor:pointer;min-width:0}
.mi-tile:hover{background:var(--mi-surface-2)}
.mi-tile-icon svg{width:24px;height:24px}
.mi-tile-text{display:flex;flex-direction:column;min-width:0}
.mi-tile-label{color:var(--mi-muted);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mi-tile-value{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* alarm panel: big state, a vertical mode picker and a code keypad */
.mi-modes{display:flex;flex-direction:column;gap:6px;box-sizing:border-box;width:184px;padding:6px;border-radius:32px;background:var(--mi-surface)}
.mi-mode{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:min(92px,13vh);flex:1;padding:8px;border:0;border-radius:26px;background:transparent;color:var(--mi-fg);font:500 15px Roboto,system-ui,sans-serif;cursor:pointer;transition:background .2s,color .2s}
.mi-mode:hover{background:var(--mi-surface-2)}
.mi-mode[aria-checked=true]{background:var(--mi-accent);color:var(--mi-accent-ink)}
.mi-mode[data-busy=true]{animation:mi-moving 1.2s ease-in-out infinite}
.mi-mode:disabled{cursor:default}
dialog.mi.mi-code{width:min(360px,calc(100vw - 32px))}
@media (max-width:600px){dialog.mi.mi-code{width:100vw}}
.mi-code .mi-body{display:grid;justify-items:center;gap:16px;padding:8px 24px 28px}
.mi-code-field{display:flex;align-items:center;box-sizing:border-box;width:100%;min-height:56px;border-radius:6px 6px 0 0;background:var(--mi-surface-2);border-bottom:1px solid var(--mi-muted)}
.mi-code-field:focus-within{border-bottom:2px solid var(--mi-primary)}
.mi-code-field input{flex:1;min-width:0;height:56px;padding:0 16px;border:0;background:transparent;color:inherit;font:400 18px Roboto,system-ui,sans-serif;letter-spacing:2px;outline:none}
.mi-code-field input::placeholder{color:var(--mi-muted);letter-spacing:0;font-size:16px}
.mi-keypad{display:grid;grid-template-columns:repeat(3,64px);gap:16px 28px;margin-top:8px}
.mi-key{display:grid;place-items:center;width:64px;height:64px;padding:0;border:0;border-radius:50%;background:var(--mi-surface-2);color:var(--mi-fg);font:400 26px Roboto,system-ui,sans-serif;cursor:pointer;transition:background .15s}
.mi-key:hover{background:color-mix(in srgb,var(--mi-surface-2) 70%,var(--mi-fg) 14%)}
.mi-key.mi-key-clear{color:var(--mi-muted)}
.mi-key.mi-key-ok{background:color-mix(in srgb,#43a047 45%,var(--mi-surface-2));color:#8bd88f}
.mi-key.mi-key-ok:hover{background:color-mix(in srgb,#43a047 60%,var(--mi-surface-2))}
@media (prefers-color-scheme:light){.mi-key.mi-key-ok{color:#1b5e20}}
.mi-key:disabled{opacity:.5;cursor:default}
.mi-code .mi-pill{width:100%}
/* camera: a wide dialog with the live picture */
dialog.mi.mi-wide{width:min(1040px,calc(100vw - 32px))}
@media (max-width:600px){dialog.mi.mi-wide{width:100vw}}
.mi-wide .mi-body{padding:0 0 16px}
.mi-camera{position:relative;width:100%;aspect-ratio:16/9;max-height:calc(min(92vh,880px) - 140px);background:#000;overflow:hidden}
.mi-camera>img,.mi-camera>video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000}
.mi-camera>img[hidden],.mi-camera>video[hidden]{display:none}
.mi-camera-note{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;color:#fff;text-align:center;background:#0006}
.mi-camera-note[hidden]{display:none}
.mi-camera-note svg{width:40px;height:40px;opacity:.85}
.mi-camera-bar{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;gap:4px;padding:8px 10px;background:linear-gradient(transparent,#000a);color:#fff}
.mi-camera-bar .mi-iconbtn{width:44px;height:44px;color:#fff}
.mi-camera-bar .mi-iconbtn:hover{background:#ffffff26}
.mi-camera-bar [hidden]{display:none}
.mi-live{display:inline-flex;align-items:center;gap:6px;margin-right:auto;padding:3px 10px;border-radius:999px;background:#0008;font-size:12px;font-weight:500;letter-spacing:.04em;text-transform:uppercase}
.mi-live::before{content:"";width:8px;height:8px;border-radius:50%;background:#f44336;animation:mi-moving 1.6s ease-in-out infinite}
.mi-live[data-still=true]::before{background:#9e9e9e;animation:none}
.mi-camera:fullscreen{max-height:none;aspect-ratio:auto}
.mi-wide .mi-attrs{margin:16px 24px 0}
.mi-wide .mi-error{margin:12px 24px 0}
/* attributes */
.mi-attrs{margin-top:24px;border-top:1px solid var(--mi-line);padding-top:4px}
.mi-attrs summary{display:flex;align-items:center;justify-content:space-between;min-height:48px;font-weight:500;cursor:pointer;list-style:none}
.mi-attrs summary::-webkit-details-marker{display:none}
.mi-attrs summary svg{transition:transform .2s}
.mi-attrs[open] summary svg{transform:rotate(180deg)}
.mi-attrs dl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:8px 16px;margin:0 0 4px}
.mi-attrs dt{color:var(--mi-muted)}
.mi-attrs dd{margin:0;text-align:right;overflow-wrap:anywhere}
.mi-error{margin:12px 0 0;color:#db4437;text-align:center}

/* a device's extra entities, as rows on Home Assistant's device page */
.mi-extras{display:grid;gap:12px;width:100%;margin-top:8px}
.mi-extras{gap:0;margin-top:16px;border-top:1px solid var(--mi-line)}
.mi-extra-section{border-bottom:1px solid var(--mi-line)}
.mi-extra-section summary{display:flex;align-items:center;gap:8px;min-height:48px;font-weight:500;cursor:pointer;list-style:none}
.mi-extra-section summary::-webkit-details-marker{display:none}
.mi-extra-section summary>span:first-child{flex:1}
.mi-extra-count{min-width:22px;padding:0 7px;border-radius:11px;background:var(--mi-surface-2);color:var(--mi-muted);font-size:12px;line-height:20px;text-align:center}
.mi-extra-section summary svg{transition:transform .2s}
.mi-extra-section[open] summary svg{transform:rotate(180deg)}
.mi-extra-section[open]{padding-bottom:8px}
.mi-row{display:flex;align-items:center;gap:14px;min-height:48px}
.mi-row-icon{flex-shrink:0;width:24px;height:24px;--mdc-icon-size:24px;color:var(--mi-muted)}
.mi-row-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mi-row[data-unavailable=true] .mi-row-name{color:var(--mi-muted)}
.mi-row-ctl{display:flex;align-items:center;gap:8px;flex-shrink:0;max-width:55%}
.mi-row-value{color:var(--mi-fg);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mi-row-ctl .mi-row-value{color:var(--mi-muted)}
.mi-row-ctl>.mi-row-value:only-child{color:var(--mi-fg)}
.mi-row-select,.mi-row-time{min-height:40px;max-width:100%;padding:0 10px;border:0;border-radius:10px;background:var(--mi-surface-2);color:var(--mi-fg);font:inherit}
.mi-row-range{width:120px;accent-color:var(--mi-primary)}
.mi .mi-row-press{min-height:36px;padding:0 14px;border:0;border-radius:18px;background:transparent;color:var(--mi-primary);font:500 14px Roboto,system-ui,sans-serif;cursor:pointer}
.mi-row-press:hover{background:var(--mi-surface-2)}
.mi .mi-row-switch{position:relative;width:40px;height:24px;min-height:0;padding:0;border:0;border-radius:12px;background:var(--mi-surface-2);cursor:pointer}
.mi-row-switch::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px #0006;transition:left .15s}
.mi-row-switch[aria-checked=true]{background:var(--mi-primary)}
.mi-row-switch[aria-checked=true]::after{left:19px}
/* robot vacuum, as Home Assistant's more-info-vacuum */
.mi-vac-head{position:relative;width:100%}
.mi-vac-head .mi-vac-battery{position:absolute;right:0;bottom:2px;display:inline-flex;align-items:center;gap:4px;color:var(--mi-muted);font-size:14px}
.mi-vac-head .mi-vac-battery svg{width:18px;height:18px}
.mi-vac-status{margin:0 0 4px}
.mi-vac-buttons{display:flex;flex-wrap:wrap;justify-content:center;gap:12px}
.mi-vac-btn{display:grid;place-items:center;width:48px;height:48px;padding:0;border:0;border-radius:12px;background:var(--mi-surface);color:var(--mi-fg);cursor:pointer;transition:background .15s,opacity .15s}
.mi-vac-btn:hover:not(:disabled){background:var(--mi-surface-2)}
.mi-vac-btn:disabled{cursor:not-allowed;opacity:.4}
.mi-vac-btn svg{width:24px;height:24px}
.mi-vac-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:12px;max-width:100%}
.mi-vac-chip{display:flex;align-items:center;gap:10px;height:48px;max-width:100%;padding:6px 10px;border:0;border-radius:12px;background:var(--mi-surface);color:var(--mi-fg);font:inherit;text-align:left;cursor:pointer;letter-spacing:.25px}
.mi-vac-chip:hover{background:var(--mi-surface-2)}
.mi-vac-chip-icon{display:flex}
.mi-vac-chip-icon svg{width:20px;height:20px}
.mi-vac-chip-text{display:flex;flex-direction:column;min-width:0}
.mi-vac-chip-label{font-size:12px;letter-spacing:.4px;color:var(--mi-muted)}
.mi-vac-chip-value{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mi-vacuum .mi-center{gap:16px}
.mi-vacuum .mi-center[hidden],.mi-vac-in-areas .mi-attrs,.mi-vac-in-areas .mi-error:empty{display:none}
.mi-vac-fan{position:relative;max-width:100%}
.mi-vac-menu{position:absolute;left:0;bottom:calc(100% + 6px);z-index:3;min-width:200px;padding:6px;border-radius:16px;background:var(--mi-bg);background-image:linear-gradient(var(--mi-surface-2),var(--mi-surface-2));box-shadow:0 8px 24px #0007}
.mi-vac-menu[hidden]{display:none}
.mi-vac-menu .mi-list{max-height:240px}
.mi-vac-areas{display:flex;flex-direction:column;gap:16px}
.mi-vac-areas[hidden]{display:none}
.mi-vac-map-img{display:block;width:100%;max-height:min(70vh,640px);object-fit:contain;border-radius:16px;background:var(--mi-surface)}
.mi-vac-map-img[hidden]{display:none}
.mi-vac-areas-head{display:flex;align-items:center;gap:4px;margin-left:-12px}
.mi-vac-areas-head h3{margin:0;font:500 18px Roboto,system-ui,sans-serif}
.mi-vac-areas-body{display:flex;flex-direction:column;gap:16px}
.mi-vac-section-name{margin-bottom:8px;color:var(--mi-muted);font-weight:500}
.mi-vac-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px}
.mi-vac-area{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:80px;padding:12px;overflow:hidden;border:1px solid var(--mi-line);border-radius:12px;background:transparent;color:var(--mi-fg);font:inherit;cursor:pointer}
.mi-vac-area::before{content:"";position:absolute;inset:0;opacity:.2;transition:background .18s;pointer-events:none}
.mi-vac-area:hover::before{background:var(--mi-muted)}
.mi-vac-area[aria-pressed=true]::before{background:var(--mi-primary)}
.mi-vac-area-icon{color:var(--mi-muted)}
.mi-vac-area-icon svg{width:28px;height:28px}
.mi-vac-area[aria-pressed=true] .mi-vac-area-icon{color:var(--mi-primary)}
.mi-vac-area-name{text-align:center;line-height:1.25;word-break:break-word}
.mi-vac-badge{position:absolute;top:6px;right:6px;display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--mi-primary);color:#fff;font-size:11px;font-weight:500}
.mi-vac-badge[hidden]{display:none}
.mi-vac-hint{margin:0;text-align:center;font-size:12px;color:var(--mi-muted)}
.mi-vac-footer{display:flex;justify-content:flex-end;padding-top:16px;border-top:1px solid var(--mi-line)}
.mi-vac-footer .mi-pill:disabled{opacity:.4;cursor:not-allowed}
.mi-vac-empty{display:flex;flex-direction:column;align-items:center;text-align:center;color:var(--mi-muted);padding:24px 8px}
.mi-vac-empty svg{width:48px;height:48px}
.mi-vac-empty-title{margin:12px 0 4px;color:var(--mi-fg);font-size:18px;font-weight:500}
.mi-vac-empty p{margin:0}
${VACUUM_STATUS_CSS}
`;

const svg = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;
const rgbCss = (rgb) => `rgb(${rgb.join(",")})`;
const inkFor = ([r, g, b]) =>
  (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#1c1c1c" : "#fff";
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1).replace(/_/g, " ") : s);
const ALARM_COLOR = {
  disarmed: "#9e9e9e",
  armed: "#43a047",
  arming: "#ff9800",
  pending: "#ff9800",
  disarming: "#ff9800",
  triggered: "#e5533d",
};
const alarmColor = (state) =>
  ALARM_COLOR[state] ||
  (state?.startsWith("armed") ? ALARM_COLOR.armed : ALARM_COLOR.disarmed);
const HVAC_COLOR = {
  heat: "#ff8100",
  cool: "#2b9af9",
  heat_cool: "#ffab00",
  auto: "#4caf50",
  dry: "#efbd07",
  fan_only: "#8a8a8a",
};

function h(doc, tag, className, html) {
  const el = doc.createElement(tag);
  if (className) el.className = className;
  if (html !== undefined) el.innerHTML = html;
  return el;
}

/** A pill slider (vertical for the main value, horizontal for the rest). */
function makeSlider(doc, o) {
  const vertical = o.orient === "v";
  const el = h(doc, "div", `mi-slider ${vertical ? "mi-v" : "mi-h"}`);
  const fill = h(doc, "div", "mi-fill");
  el.append(fill);
  let readout, thumb;
  if (vertical) {
    readout = h(
      doc,
      "div",
      "mi-readout",
      '<span class="mi-big"></span><span class="mi-small"></span>',
    );
    el.append(readout);
  }
  if (o.gradient) {
    el.classList.add("mi-track");
    el.style.setProperty("--mi-gradient", o.gradient);
  }
  if (!vertical) {
    thumb = h(doc, "div", "mi-thumb");
    el.append(thumb);
  }
  el.setAttribute("role", "slider");
  el.tabIndex = 0;
  el.setAttribute("aria-label", o.label);
  el.setAttribute("aria-orientation", vertical ? "vertical" : "horizontal");
  el.setAttribute("aria-valuemin", o.min);
  el.setAttribute("aria-valuemax", o.max);
  let value = o.value ?? o.min,
    dragging = false;
  const span = o.max - o.min;
  const paint = () => {
    const r = Math.min(1, Math.max(0, (value - o.min) / span)) * 100;
    if (vertical) fill.style.height = `${r}%`;
    else {
      fill.style.width = `${r}%`;
      thumb.style.left = `${r}%`;
    }
    el.setAttribute("aria-valuenow", value);
    el.setAttribute("aria-valuetext", o.format ? o.format(value) : value);
    if (readout) {
      readout.querySelector(".mi-big").textContent = o.format
        ? o.format(value)
        : value;
    }
  };
  const snap = (v) => {
    const step = o.step || 1;
    return Math.min(
      o.max,
      Math.max(o.min, Math.round((v - o.min) / step) * step + o.min),
    );
  };
  const at = (event) => {
    const rect = el.getBoundingClientRect();
    const r = vertical
      ? 1 - (event.clientY - rect.top) / rect.height
      : (event.clientX - rect.left) / rect.width;
    return snap(o.min + Math.min(1, Math.max(0, r)) * span);
  };
  const move = (v) => {
    value = v;
    paint();
    o.onInput?.(value);
  };
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    dragging = true;
    el.classList.add("mi-dragging");
    el.setPointerCapture(e.pointerId);
    move(at(e));
  });
  el.addEventListener("pointermove", (e) => {
    if (dragging) move(at(e));
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove("mi-dragging");
    o.onCommit?.(value);
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  let keyTimer;
  el.addEventListener("keydown", (e) => {
    const big = e.shiftKey ? 10 : 1;
    const delta = {
      ArrowRight: 1,
      ArrowUp: 1,
      ArrowLeft: -1,
      ArrowDown: -1,
      PageUp: 10,
      PageDown: -10,
    }[e.key];
    let next;
    if (delta !== undefined) next = value + delta * big * (o.step || 1);
    else if (e.key === "Home") next = o.min;
    else if (e.key === "End") next = o.max;
    else return;
    e.preventDefault();
    move(snap(next));
    clearTimeout(keyTimer);
    keyTimer = setTimeout(() => o.onCommit?.(value), 350);
  });
  paint();
  return {
    el,
    caption(text) {
      const small = readout?.querySelector(".mi-small");
      if (small) small.textContent = text;
    },
    set(v) {
      if (dragging || v === value) return;
      value = v;
      paint();
    },
    get dragging() {
      return dragging;
    },
  };
}

function round(doc, icon, label, onClick, pressed) {
  const b = h(
    doc,
    "button",
    "mi-round",
    `<span class="mi-disc">${svg(icon)}</span><span>${label}</span>`,
  );
  b.type = "button";
  if (pressed !== undefined) b.setAttribute("aria-pressed", String(pressed));
  b.onclick = onClick;
  return b;
}

/**
 * Opens the pop-up for one entity. `getHass()` returns the latest hass object;
 * call `update()` after state changes. Returns `{ update, close, dialog }`.
 */
/**
 * The icon Home Assistant would show for an entity row, for the full-screen
 * page (its icon element knows only named icons): the shared per-type list,
 * plus a few classes and kinds that list leaves out.
 */
function rowIcon(entity, row) {
  const cls = entity?.attributes?.device_class;
  return (
    {
      battery_charging: "mdi:battery-charging",
      duration: "mdi:timer-outline",
      connectivity: "mdi:check-network-outline",
      problem: "mdi:alert-circle-outline",
      area: "mdi:texture-box",
      running: "mdi:play-circle-outline",
    }[cls] ||
    { time: "mdi:clock-outline", input_datetime: "mdi:clock-outline" }[
      row?.domain
    ] ||
    customEntityDefaultIcon(row?.id, entity)
  );
}

export function openMoreInfo({
  host,
  getHass,
  entityId,
  onError = () => {},
  // A device's extra entities (a robot vacuum's mop mode, dock, …), listed
  // under its controls in the order given.
  extras = [],
  // The device's map picture (an image entity), opened from a Map button.
  map = "",
}) {
  const doc = host.ownerDocument;
  const dialog = h(doc, "dialog", "mi");
  dialog.setAttribute("aria-labelledby", "mi-title");
  const frame = h(doc, "div", "mi-frame");
  const head = h(doc, "div", "mi-head");
  const closeBtn = h(doc, "button", "mi-iconbtn", svg("close"));
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close");
  const titles = h(doc, "div", "mi-titles");
  const title = h(doc, "h2");
  title.id = "mi-title";
  const subtitle = h(doc, "p");
  titles.append(title, subtitle);
  head.append(closeBtn, titles);
  const body = h(doc, "div", "mi-body");
  const style = h(doc, "style");
  style.textContent = STYLE;
  frame.append(head, body);
  dialog.append(style, frame);
  host.append(dialog);

  let signature = "",
    syncs = [],
    errorEl;
  // Layouts register teardown here (camera streams); run on rebuild and close.
  let cleanups = [];
  const runCleanups = () => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  };
  const showError = (message) => {
    errorEl ||= body.appendChild(h(doc, "p", "mi-error"));
    errorEl.textContent = message || "";
    errorEl.hidden = !message;
  };
  const call = async (description, control, value) => {
    try {
      showError("");
      const [domain, service, data] = controlCall(description, control, value);
      await getHass().callService(domain, service, data);
      return true;
    } catch (error) {
      showError(error?.message || "The command failed.");
      onError(error);
      return false;
    }
  };
  const find = (d, pred) => d.controls.find(pred);

  // ---- layouts -----------------------------------------------------------
  function lightLayout(d, root) {
    const toggle = find(d, (c) => c.kind === "toggle");
    const bright = find(d, (c) => c.key === "brightness");
    const temp = find(d, (c) => c.key === "color_temp_kelvin");
    const color = find(d, (c) => c.kind === "color");
    const effect = find(d, (c) => c.key === "effect");
    const center = h(doc, "div", "mi-center");
    let main;
    if (bright) {
      main = makeSlider(doc, {
        orient: "v",
        label: "Brightness",
        min: bright.min,
        max: bright.max,
        step: bright.step,
        value: bright.value,
        format: bright.format,
        onCommit: (v) => call(d, bright, v),
      });
      center.append(main.el);
    } else {
      main = h(doc, "button", "mi-tall", `${svg("bulb")}<span></span>`);
      main.type = "button";
      main.setAttribute("role", "switch");
      main.onclick = () =>
        call(d, toggle, main.getAttribute("aria-checked") !== "true");
      center.append(main);
    }
    const row = h(doc, "div", "mi-row");
    const power = round(
      doc,
      "power",
      "Power",
      () => {
        const on = power.getAttribute("aria-pressed") === "true";
        call(d, toggle, !on);
      },
      false,
    );
    row.append(power);
    const panels = {};
    const buttons = {};
    const openPanel = (key) => {
      for (const k of Object.keys(panels)) {
        const show = k === key && panels[k].hidden;
        panels[k].hidden = !show;
        buttons[k].setAttribute("aria-pressed", String(show));
      }
    };
    const feature = (key, icon, label, panel) => {
      buttons[key] = round(doc, icon, label, () => openPanel(key), false);
      panels[key] = panel;
      panel.hidden = true;
      row.append(buttons[key]);
    };
    const syncs2 = [];
    if (temp) {
      const out = h(doc, "output");
      const field = h(doc, "div", "mi-field");
      const label = h(
        doc,
        "div",
        "mi-label",
        "<span>Colour temperature</span>",
      );
      label.append(out);
      const s = makeSlider(doc, {
        orient: "h",
        label: "Colour temperature",
        min: temp.min,
        max: temp.max,
        step: 50,
        value: temp.value,
        gradient:
          "linear-gradient(90deg,#ffa93d,#ffe3b8 40%,#f4f6ff 65%,#a8c8ff)",
        format: (v) => `${Math.round(v)} K`,
        onInput: (v) => (out.textContent = `${Math.round(v)} K`),
        onCommit: (v) => call(d, temp, v),
      });
      field.append(label, s.el);
      const panel = h(doc, "div", "mi-panel");
      panel.append(field);
      feature("temp", "thermo", "Temperature", panel);
      syncs2.push((nd) => {
        const c = find(nd, (x) => x.key === "color_temp_kelvin");
        if (!c) return;
        s.set(c.value);
        out.textContent = `${Math.round(c.value)} K`;
      });
    }
    if (color) {
      const hueOut = h(doc, "output");
      const satOut = h(doc, "output");
      let hue = color.value[0],
        sat = color.value[1];
      const satGradient = () =>
        `linear-gradient(90deg,#fff,${rgbCss(hsToRgb([hue, 100]))})`;
      const hs = makeSlider(doc, {
        orient: "h",
        label: "Hue",
        min: 0,
        max: 360,
        step: 1,
        value: hue,
        gradient:
          "linear-gradient(90deg,#f00,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00)",
        onInput: (v) => {
          hue = v;
          hueOut.textContent = `${v}°`;
          ss.el.style.setProperty("--mi-gradient", satGradient());
        },
        onCommit: () => call(d, color, [hue, sat]),
      });
      const ss = makeSlider(doc, {
        orient: "h",
        label: "Saturation",
        min: 0,
        max: 100,
        step: 1,
        value: sat,
        gradient: satGradient(),
        onInput: (v) => {
          sat = v;
          satOut.textContent = `${v}%`;
        },
        onCommit: () => call(d, color, [hue, sat]),
      });
      const f1 = h(doc, "div", "mi-field"),
        f2 = h(doc, "div", "mi-field");
      const l1 = h(doc, "div", "mi-label", "<span>Hue</span>"),
        l2 = h(doc, "div", "mi-label", "<span>Saturation</span>");
      l1.append(hueOut);
      l2.append(satOut);
      f1.append(l1, hs.el);
      f2.append(l2, ss.el);
      hueOut.textContent = `${hue}°`;
      satOut.textContent = `${sat}%`;
      const panel = h(doc, "div", "mi-panel");
      panel.append(f1, f2);
      feature("color", "palette", "Colour", panel);
      syncs2.push((nd) => {
        const c = find(nd, (x) => x.kind === "color");
        if (!c || hs.dragging || ss.dragging) return;
        [hue, sat] = c.value;
        hs.set(hue);
        ss.set(sat);
        hueOut.textContent = `${hue}°`;
        satOut.textContent = `${sat}%`;
        ss.el.style.setProperty("--mi-gradient", satGradient());
      });
    }
    let effectButtons = [];
    if (effect) {
      const list = h(doc, "ul", "mi-list");
      list.setAttribute("role", "radiogroup");
      for (const option of ["", ...effect.options]) {
        const li = h(doc, "li");
        const b = h(doc, "button");
        b.type = "button";
        b.setAttribute("role", "radio");
        b.textContent = option || "None";
        b.dataset.value = option;
        b.onclick = () => call(d, effect, option);
        li.append(b);
        list.append(li);
        effectButtons.push(b);
      }
      const panel = h(doc, "div", "mi-panel");
      panel.append(list);
      feature("effect", "effects", "Effect", panel);
      syncs2.push((nd) => {
        const c = find(nd, (x) => x.key === "effect");
        for (const b of effectButtons)
          b.setAttribute(
            "aria-checked",
            String(b.dataset.value === (c?.value || "")),
          );
      });
    }
    center.append(row, ...Object.values(panels));
    root.append(center);
    return (nd, entity) => {
      const on = nd.state === "on";
      const a = entity?.attributes || {};
      const rgb = Array.isArray(a.rgb_color)
        ? a.rgb_color
        : a.color_temp_kelvin
          ? kelvinToRgb(a.color_temp_kelvin)
          : [255, 193, 7];
      dialog.style.setProperty("--mi-accent", rgbCss(rgb));
      dialog.style.setProperty(
        "--mi-accent-ink",
        on ? inkFor(rgb) : "var(--mi-fg)",
      );
      power.setAttribute("aria-pressed", String(on));
      const t = find(nd, (c) => c.kind === "toggle");
      if (bright) {
        const c = find(nd, (x) => x.key === "brightness");
        main.set(on ? (c?.value ?? 0) : 0);
        main.el.querySelector(".mi-big").textContent = on
          ? bright.format(c?.value ?? 0)
          : "Off";
        main.caption(on ? "On" : "");
      } else {
        main.setAttribute("aria-checked", String(on));
        main.querySelector("span").textContent = on ? "On" : "Off";
      }
      void t;
      for (const f of syncs2) f(nd);
    };
  }

  function coverLayout(d, root) {
    const pos = find(d, (c) => c.key === "position");
    const btns = find(d, (c) => c.kind === "buttons");
    const toggleOnly = !!find(d, (c) => c.kind === "cover-toggle");
    const center = h(doc, "div", "mi-center");
    // Big state and when it changed, as Home Assistant's dialog shows them.
    const head = h(
      doc,
      "div",
      "mi-statehead",
      "<strong></strong><span></span>",
    );
    center.append(head);
    subtitle.hidden = true;
    let slider,
      knob,
      wanted = null,
      wantedTimer;
    let press = null;
    const setPos = (pos) => knob?.style.setProperty("--mi-pos", String(pos));
    if (toggleOnly) {
      knob = h(
        doc,
        "button",
        "mi-cover-switch",
        `<span class="mi-cover-knob"></span>`,
      );
      knob.type = "button";
      knob.setAttribute("role", "switch");
      knob.setAttribute("aria-label", d.name);
      // The upper half opens, the lower half closes; a tap elsewhere flips it.
      // The switch moves at once and shows "moving" until the cover reports
      // where it ended (or gives up after a minute).
      // Tap anywhere flips it, or drag the knob up (open) or down (close).
      // The knob moves at once and shows "moving" until the cover reports
      // where it ended (or gives up after a minute).
      const shownOpen = () => knob.getAttribute("aria-checked") === "true";
      const send = async (open) => {
        const entity = getHass().states?.[entityId];
        const resting = ["open", "closed"].includes(entity?.state);
        wanted = open;
        clearTimeout(wantedTimer);
        // Already there: just settle the knob back.
        if (resting && (entity.state === "open") === open) wanted = null;
        else
          wantedTimer = setTimeout(() => {
            wanted = null;
            update();
          }, 60000);
        update();
        if (wanted === null) return;
        if (!(await call(d, btns, open ? "open_cover" : "close_cover"))) {
          wanted = null;
          update();
        }
      };
      knob.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || knob.disabled) return;
        press = {
          id: event.pointerId,
          y: event.clientY,
          from: shownOpen() ? 1 : 0,
          pos: shownOpen() ? 1 : 0,
          dragging: false,
        };
        try {
          knob.setPointerCapture(event.pointerId);
        } catch {
          // Not a live pointer (e.g. synthetic); dragging still works.
        }
      });
      knob.addEventListener("pointermove", (event) => {
        if (!press || event.pointerId !== press.id) return;
        const dy = press.y - event.clientY;
        if (!press.dragging && Math.abs(dy) < 6) return;
        press.dragging = true;
        knob.classList.add("mi-dragging");
        const travel = Math.max(1, knob.clientHeight / 2 - 8);
        press.pos = Math.min(1, Math.max(0, press.from + dy / travel));
        setPos(press.pos);
      });
      const release = (event) => {
        if (!press || event.pointerId !== press.id) return;
        const { dragging, pos, from } = press;
        press = null;
        knob.classList.remove("mi-dragging");
        if (event.type === "pointercancel") {
          setPos(from);
          return;
        }
        send(dragging ? pos >= 0.5 : !shownOpen());
      };
      knob.addEventListener("pointerup", release);
      knob.addEventListener("pointercancel", release);
      // Keyboard: Enter/Space flips it, arrows open and close.
      knob.onclick = (event) => {
        if (event.detail === 0) send(!shownOpen());
      };
      knob.onkeydown = (event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          send(event.key === "ArrowUp");
        }
      };
      center.append(knob);
    }
    if (pos) {
      slider = makeSlider(doc, {
        orient: "v",
        label: "Position",
        min: 0,
        max: 100,
        step: 1,
        value: pos.value,
        format: (v) => `${Math.round(v)}%`,
        onCommit: (v) => call(d, pos, v),
      });
      center.append(slider.el);
    }
    const row = h(doc, "div", "mi-row");
    const ICON = { open_cover: "up", stop_cover: "stop", close_cover: "down" };
    const LABEL = {
      open_cover: "Open",
      stop_cover: "Stop",
      close_cover: "Close",
    };
    // Beside a slider the commands sit in one compact group, as in HA.
    if (!toggleOnly) {
      row.className = "mi-cover-buttons";
      for (const b of btns?.buttons || []) {
        const button = h(doc, "button", "mi-iconbtn", svg(ICON[b.service]));
        button.type = "button";
        button.title = LABEL[b.service];
        button.setAttribute("aria-label", LABEL[b.service]);
        button.onclick = () => call(d, btns, b.service);
        row.append(button);
      }
      center.append(row);
    }
    root.append(center);
    const since = setInterval(() => {
      if (!dialog.isConnected) return clearInterval(since);
      const entity = getHass().states?.[entityId];
      head.lastChild.textContent = sinceText(entity?.last_changed);
    }, 5000);
    return (nd, entity) => {
      dialog.style.setProperty("--mi-accent", "#9c27b0");
      head.firstChild.textContent = nd.unavailable
        ? "Unavailable"
        : cap(nd.state);
      head.lastChild.textContent = nd.since;
      if (knob) {
        let open = ["open", "opening"].includes(nd.state),
          moving = ["opening", "closing"].includes(nd.state);
        if (wanted !== null) {
          // Done once the cover rests where it was sent.
          if (!moving && open === wanted) {
            wanted = null;
            clearTimeout(wantedTimer);
          } else {
            if (!moving)
              head.firstChild.textContent = wanted ? "Opening" : "Closing";
            open = wanted;
            moving = true;
          }
        }
        knob.setAttribute("aria-checked", String(open));
        if (!press?.dragging) setPos(open ? 1 : 0);
        knob.dataset.moving = String(moving);
        knob.firstChild.innerHTML = svg(coverIcon(nd.deviceClass, open));
      }
      void entity;
      const c = find(nd, (x) => x.key === "position");
      if (slider && c) {
        slider.set(c.value);
        slider.caption(cap(nd.state));
      }
    };
  }

  function lockLayout(d, root) {
    const btns = find(d, (c) => c.kind === "buttons");
    const center = h(doc, "div", "mi-center");
    const big = h(doc, "button", "mi-lock");
    big.type = "button";
    const state = h(doc, "div", "mi-state");
    big.onclick = () =>
      call(d, btns, big.dataset.locked === "true" ? "unlock" : "lock");
    center.append(big, state);
    root.append(center);
    return (nd) => {
      const locked = nd.state === "locked";
      const busy = ["locking", "unlocking", "opening"].includes(nd.state);
      const color =
        nd.state === "jammed" || nd.state === "unlocked"
          ? "#e5533d"
          : busy
            ? "#ff9800"
            : "#43a047";
      dialog.style.setProperty("--mi-accent", color);
      big.dataset.locked = String(locked);
      big.disabled = busy;
      big.innerHTML = svg(locked ? "lock" : "unlock");
      big.setAttribute(
        "aria-label",
        locked ? "Locked. Press to unlock" : "Unlocked. Press to lock",
      );
      state.textContent = cap(nd.state);
    };
  }

  function climateLayout(d, root) {
    const target = find(d, (c) => c.kind === "stepper");
    const selects = d.controls.filter((c) => c.kind === "select");
    const center = h(doc, "div", "mi-center mi-climate");
    const unit = () => getHass().config?.unit_system?.temperature || "°C";
    const current = h(doc, "div", "mi-current");
    center.append(current);
    let dial, apply, arc;
    if (target) {
      const START = 135,
        SWEEP = 270;
      const R = 92;
      const point = (deg) => {
        const a = (deg * Math.PI) / 180;
        return [110 + R * Math.cos(a), 110 + R * Math.sin(a)];
      };
      const path = (from, to) => {
        if (to - from < 0.5) return "";
        const [x0, y0] = point(from),
          [x1, y1] = point(to);
        return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
      };
      dial = h(
        doc,
        "div",
        "mi-dial",
        `<svg viewBox="0 0 220 220" aria-hidden="true"><path class="mi-arc-track" d="${path(START, START + SWEEP)}"/><path class="mi-arc-fill"/><circle class="mi-cur" r="3.5"/><circle class="mi-handle" r="11"/></svg><div class="mi-dial-text"><span class="mi-dial-state"></span><span class="mi-dial-value"><span class="mi-int"></span><span class="mi-sup"><span class="mi-unit"></span><span class="mi-dec"></span></span></span></div>`,
      );
      dial.setAttribute("role", "slider");
      dial.tabIndex = 0;
      dial.setAttribute("aria-label", "Target temperature");
      dial.setAttribute("aria-valuemin", target.min);
      dial.setAttribute("aria-valuemax", target.max);
      const fill = dial.querySelector(".mi-arc-fill"),
        handle = dial.querySelector(".mi-handle"),
        cur = dial.querySelector(".mi-cur");
      const span = target.max - target.min;
      const angle = (v) =>
        START + Math.min(1, Math.max(0, (v - target.min) / span)) * SWEEP;
      let value = target.value,
        dragging = false,
        mode = d.state,
        currentTemp;
      const snap = (v) => {
        const n = Math.round((v - target.min) / target.step) * target.step;
        return Math.min(
          target.max,
          Math.max(target.min, Math.round((target.min + n) * 100) / 100),
        );
      };
      const paint = () => {
        const a = angle(value);
        // Cooling fills from the target up to the maximum; the rest from the minimum.
        fill.setAttribute(
          "d",
          mode === "off"
            ? ""
            : mode === "cool"
              ? path(a, START + SWEEP)
              : path(START, a),
        );
        const [hx, hy] = point(a);
        handle.setAttribute("cx", hx);
        handle.setAttribute("cy", hy);
        if (Number.isFinite(currentTemp)) {
          const [cx, cy] = point(angle(currentTemp));
          cur.setAttribute("cx", cx);
          cur.setAttribute("cy", cy);
          cur.removeAttribute("hidden");
        } else cur.setAttribute("hidden", "");
        const fine = target.step < 1;
        dial.querySelector(".mi-int").textContent = Math.trunc(value);
        dial.querySelector(".mi-unit").textContent = unit();
        dial.querySelector(".mi-dec").textContent = fine
          ? (value % 1).toFixed(1).slice(1)
          : "";
        dial.setAttribute("aria-valuenow", value);
        dial.setAttribute("aria-valuetext", `${value} ${unit()}`);
      };
      const fromEvent = (e) => {
        const rect = dial.querySelector("svg").getBoundingClientRect();
        const dx = e.clientX - (rect.left + rect.width / 2),
          dy = e.clientY - (rect.top + rect.height / 2);
        let rel = ((Math.atan2(dy, dx) * 180) / Math.PI - START + 720) % 360;
        // The opening at the bottom belongs to whichever end is nearer.
        if (rel > SWEEP) rel = rel > SWEEP + (360 - SWEEP) / 2 ? 0 : SWEEP;
        return snap(target.min + (rel / SWEEP) * span);
      };
      const move = (v) => {
        value = v;
        paint();
      };
      dial.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        dragging = true;
        dial.classList.add("mi-dragging");
        dial.setPointerCapture(e.pointerId);
        move(fromEvent(e));
      });
      dial.addEventListener("pointermove", (e) => {
        if (dragging) move(fromEvent(e));
      });
      let timer;
      const commit = () => {
        clearTimeout(timer);
        timer = setTimeout(() => call(d, target, value), 500);
      };
      const end = () => {
        if (!dragging) return;
        dragging = false;
        dial.classList.remove("mi-dragging");
        call(d, target, value);
      };
      dial.addEventListener("pointerup", end);
      dial.addEventListener("pointercancel", end);
      dial.addEventListener("keydown", (e) => {
        const delta = {
          ArrowRight: 1,
          ArrowUp: 1,
          ArrowLeft: -1,
          ArrowDown: -1,
        }[e.key];
        if (delta === undefined) return;
        e.preventDefault();
        move(snap(value + delta * target.step));
        commit();
      });
      const buttons = h(doc, "div", "mi-dialbtns");
      for (const [sign, icon, label] of [
        [-1, "minus", "Lower target temperature"],
        [1, "plus", "Raise target temperature"],
      ]) {
        const b = h(doc, "button", "mi-outline", svg(icon));
        b.type = "button";
        b.setAttribute("aria-label", label);
        b.onclick = () => {
          move(snap(value + sign * target.step));
          commit();
        };
        buttons.append(b);
      }
      center.append(dial, buttons);
      apply = (nd, entity) => {
        const t = find(nd, (c) => c.kind === "stepper");
        mode = nd.state;
        currentTemp = entity?.attributes?.current_temperature;
        if (t && !dragging) value = t.value;
        const action = entity?.attributes?.hvac_action;
        dial.querySelector(".mi-dial-state").textContent =
          nd.state === "off" ? "Off" : cap(action || nd.state);
        paint();
      };
    }
    // Mode, fan, swing and preset: tiles that open a list of choices.
    const TILE_ICON = {
      hvac_mode: null,
      fan_mode: "fan_only",
      swing_mode: "swing",
      swing_horizontal_mode: "swingh",
      preset_mode: "preset",
    };
    const tiles = h(doc, "div", "mi-tiles");
    const panel = h(doc, "div", "mi-panel");
    panel.hidden = true;
    const list = h(doc, "ul", "mi-list");
    list.setAttribute("role", "radiogroup");
    panel.append(list);
    let openKey;
    const tileEls = new Map();
    const showList = (control) => {
      if (openKey === control.key) {
        openKey = undefined;
        panel.hidden = true;
        return;
      }
      openKey = control.key;
      list.replaceChildren();
      for (const option of control.options) {
        const li = h(doc, "li");
        const b = h(doc, "button");
        b.type = "button";
        b.setAttribute("role", "radio");
        b.dataset.value = option;
        b.textContent = cap(option);
        b.onclick = () => {
          call(d, control, option);
          openKey = undefined;
          panel.hidden = true;
        };
        li.append(b);
        list.append(li);
      }
      panel.hidden = false;
      refreshList(latest);
    };
    let latest;
    const refreshList = (nd) => {
      const control = nd && find(nd, (c) => c.key === openKey);
      for (const b of list.querySelectorAll("button"))
        b.setAttribute(
          "aria-checked",
          String(b.dataset.value === control?.value),
        );
    };
    for (const control of selects) {
      const tile = h(
        doc,
        "button",
        "mi-tile",
        `<span class="mi-tile-icon"></span><span class="mi-tile-text"><span class="mi-tile-label"></span><span class="mi-tile-value"></span></span>`,
      );
      tile.type = "button";
      tile.querySelector(".mi-tile-label").textContent = control.label;
      tile.onclick = () => showList(control);
      tiles.append(tile);
      tileEls.set(control.key, tile);
    }
    if (selects.length) center.append(tiles, panel);
    root.append(center);
    return (nd, entity) => {
      latest = nd;
      const a = entity?.attributes || {};
      dialog.style.setProperty(
        "--mi-accent",
        HVAC_COLOR[nd.state] || "var(--mi-muted)",
      );
      current.hidden = !Number.isFinite(a.current_temperature);
      current.innerHTML = `<span>Current temperature</span><strong>${a.current_temperature} ${unit()}</strong>`;
      apply?.(nd, entity);
      for (const control of nd.controls.filter((c) => c.kind === "select")) {
        const tile = tileEls.get(control.key);
        if (!tile) continue;
        tile.querySelector(".mi-tile-value").textContent =
          cap(control.value) || "—";
        const icon =
          control.key === "hvac_mode"
            ? ICONS[control.value]
              ? control.value
              : "power"
            : TILE_ICON[control.key];
        tile.querySelector(".mi-tile-icon").innerHTML = svg(icon);
      }
      refreshList(nd);
    };
  }

  function switchLayout(d, root) {
    const toggle = find(d, (c) => c.kind === "toggle");
    const speed = find(d, (c) => c.key === "percentage");
    const center = h(doc, "div", "mi-center");
    const big = h(doc, "button", "mi-tall", `${svg("power")}<span></span>`);
    big.type = "button";
    big.setAttribute("role", "switch");
    big.onclick = () =>
      call(d, toggle, big.getAttribute("aria-checked") !== "true");
    center.append(big);
    let s;
    if (speed) {
      const out = h(doc, "output");
      const field = h(doc, "div", "mi-field");
      const label = h(doc, "div", "mi-label", "<span>Speed</span>");
      label.append(out);
      s = makeSlider(doc, {
        orient: "h",
        label: "Speed",
        min: 0,
        max: 100,
        step: speed.step,
        value: speed.value,
        format: (v) => `${Math.round(v)}%`,
        onInput: (v) => (out.textContent = `${Math.round(v)}%`),
        onCommit: (v) => call(d, speed, v),
      });
      field.append(label, s.el);
      center.append(field);
    }
    root.append(center);
    return (nd) => {
      const on = nd.state === "on";
      dialog.style.setProperty("--mi-accent", "var(--mi-primary)");
      big.setAttribute("aria-checked", String(on));
      big.querySelector("span").textContent = on ? "On" : "Off";
      const c = find(nd, (x) => x.key === "percentage");
      if (s && c) s.set(c.value);
    };
  }

  function alarmLayout(d, root) {
    let control = find(d, (c) => c.kind === "alarm");
    const center = h(doc, "div", "mi-center");
    const head = h(
      doc,
      "div",
      "mi-statehead",
      "<strong></strong><span></span>",
    );
    const modes = h(doc, "div", "mi-modes");
    modes.setAttribute("role", "radiogroup");
    modes.setAttribute("aria-label", "Mode");
    center.append(head, modes);
    root.append(center);
    subtitle.hidden = true;
    let busy = null,
      busyTimer;
    const send = async (service, code) => {
      const [domain, name, data] = controlCall(d, control, { service, code });
      await getHass().callService(domain, name, data);
    };
    const choose = async (mode) => {
      if (mode.state === control.mode && !busy) return;
      if (alarmNeedsCode(control, mode.service)) {
        askCode(mode);
        return;
      }
      busy = mode.state;
      paint();
      try {
        showError("");
        await send(mode.service);
      } catch (error) {
        busy = null;
        paint();
        showError(error?.message || "The command failed.");
        onError(error);
      }
      clearTimeout(busyTimer);
      busyTimer = setTimeout(() => {
        busy = null;
        paint();
      }, 4000);
    };
    const buttons = new Map();
    for (const mode of control.modes) {
      const b = h(
        doc,
        "button",
        "mi-mode",
        `${svg(mode.icon)}<span>${mode.label}</span>`,
      );
      b.type = "button";
      b.setAttribute("role", "radio");
      b.onclick = () => choose(mode);
      buttons.set(mode.state, b);
      modes.append(b);
    }
    let state = d.state;
    const paint = () => {
      const selected = busy || control.mode;
      for (const [modeState, b] of buttons) {
        b.setAttribute("aria-checked", String(modeState === selected));
        b.dataset.busy = String(
          modeState === selected &&
            (modeState === busy ||
              ["arming", "pending", "disarming"].includes(state)),
        );
      }
      dialog.style.setProperty(
        "--mi-accent",
        alarmColor(busy && busy !== state ? "arming" : state),
      );
    };

    // Code entry, laid out like Home Assistant's: a masked field with a
    // show/hide eye and, for numeric codes, a keypad with clear and confirm.
    function askCode(mode) {
      const sheet = h(doc, "dialog", "mi mi-code");
      sheet.setAttribute("aria-labelledby", "mi-code-title");
      const frame = h(doc, "div", "mi-frame");
      const top = h(doc, "div", "mi-head");
      const close = h(doc, "button", "mi-iconbtn", svg("close"));
      close.type = "button";
      close.setAttribute("aria-label", "Close");
      const heading = h(
        doc,
        "div",
        "mi-titles",
        `<h2 id="mi-code-title">${mode.service === "alarm_disarm" ? "Disarm" : "Arm"}</h2>`,
      );
      top.append(close, heading);
      const inner = h(doc, "div", "mi-body");
      const field = h(doc, "label", "mi-code-field");
      const input = h(doc, "input");
      input.type = "password";
      input.placeholder = "Code";
      input.autocomplete = "off";
      input.setAttribute("aria-label", "Code");
      if (control.codeFormat === "number") input.inputMode = "numeric";
      const eye = h(doc, "button", "mi-iconbtn", svg("eye"));
      eye.type = "button";
      eye.setAttribute("aria-label", "Show code");
      eye.onclick = () => {
        const shown = input.type === "text";
        input.type = shown ? "password" : "text";
        eye.innerHTML = svg(shown ? "eye" : "eyeOff");
        eye.setAttribute("aria-label", shown ? "Show code" : "Hide code");
      };
      field.append(input, eye);
      const error = h(doc, "p", "mi-error");
      error.hidden = true;
      inner.append(field);
      let ok;
      const submit = async () => {
        if (!input.value || ok?.disabled) return;
        if (ok) ok.disabled = true;
        error.hidden = true;
        try {
          await send(mode.service, input.value);
          busy = mode.state;
          paint();
          clearTimeout(busyTimer);
          busyTimer = setTimeout(() => {
            busy = null;
            paint();
          }, 4000);
          sheet.close();
        } catch (failure) {
          input.value = "";
          error.textContent = failure?.message || "The code was not accepted.";
          error.hidden = false;
          onError(failure);
          input.focus();
        } finally {
          if (ok) ok.disabled = false;
        }
      };
      if (control.codeFormat === "number") {
        const pad = h(doc, "div", "mi-keypad");
        for (const key of ["1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
          const k = h(doc, "button", "mi-key", key);
          k.type = "button";
          k.onclick = () => {
            input.value += key;
          };
          pad.append(k);
        }
        const clear = h(doc, "button", "mi-key mi-key-clear", svg("close"));
        clear.type = "button";
        clear.setAttribute("aria-label", "Clear");
        clear.onclick = () => {
          input.value = "";
        };
        const zero = h(doc, "button", "mi-key", "0");
        zero.type = "button";
        zero.onclick = () => {
          input.value += "0";
        };
        ok = h(doc, "button", "mi-key mi-key-ok", svg("check"));
        ok.type = "button";
        ok.setAttribute("aria-label", mode.label);
        ok.onclick = submit;
        pad.append(clear, zero, ok);
        inner.append(pad);
      } else {
        ok = h(
          doc,
          "button",
          "mi-pill",
          mode.service === "alarm_disarm" ? "Disarm" : `Arm ${mode.label}`,
        );
        ok.type = "button";
        ok.onclick = submit;
        inner.append(ok);
      }
      inner.append(error);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        }
      });
      close.onclick = () => sheet.close();
      sheet.addEventListener("click", (event) => {
        event.stopPropagation();
        if (event.target === sheet) sheet.close();
      });
      sheet.addEventListener("close", (event) => {
        event.stopPropagation();
        sheet.remove();
      });
      frame.append(top, inner);
      sheet.append(frame);
      dialog.append(sheet);
      sheet.showModal();
      input.focus();
    }

    return (nd) => {
      control = find(nd, (c) => c.kind === "alarm") || control;
      state = nd.state;
      if (busy && control.mode === busy) {
        busy = null;
        clearTimeout(busyTimer);
      }
      head.firstChild.textContent = cap(nd.state);
      head.lastChild.textContent = nd.since || "";
      paint();
    };
  }

  // Live picture: HLS video where the browser plays it natively (Safari,
  // iPad, iPhone) and the camera streams; otherwise Home Assistant's MJPEG
  // proxy, which works for every camera. Stopped when the pop-up closes.
  function cameraLayout(d, root) {
    dialog.classList.add("mi-wide");
    const control = find(d, (c) => c.kind === "camera");
    const box = h(doc, "div", "mi-camera");
    const img = h(doc, "img");
    img.alt = d.name;
    img.decoding = "async";
    const video = h(doc, "video");
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.hidden = true;
    const note = h(
      doc,
      "div",
      "mi-camera-note",
      `${svg("cctv")}<span>Connecting to the camera…</span>`,
    );
    const bar = h(doc, "div", "mi-camera-bar");
    const live = h(doc, "span", "mi-live", "Live");
    const sound = h(doc, "button", "mi-iconbtn", svg("volumeOff"));
    sound.type = "button";
    sound.hidden = true;
    sound.setAttribute("aria-label", "Turn sound on");
    sound.onclick = () => {
      video.muted = !video.muted;
      sound.innerHTML = svg(video.muted ? "volumeOff" : "volumeHigh");
      sound.setAttribute(
        "aria-label",
        video.muted ? "Turn sound on" : "Turn sound off",
      );
    };
    const retry = h(doc, "button", "mi-iconbtn", svg("refresh"));
    retry.type = "button";
    retry.setAttribute("aria-label", "Reconnect");
    retry.onclick = () => start(true);
    const full = h(doc, "button", "mi-iconbtn", svg("fullscreen"));
    full.type = "button";
    full.setAttribute("aria-label", "Full screen");
    full.hidden = !box.requestFullscreen;
    full.onclick = () =>
      doc.fullscreenElement === box
        ? doc.exitFullscreen?.()
        : box.requestFullscreen?.().catch(() => {});
    const onFullscreen = () => {
      full.innerHTML = svg(
        doc.fullscreenElement === box ? "fullscreenExit" : "fullscreen",
      );
    };
    doc.addEventListener("fullscreenchange", onFullscreen);
    bar.append(live, sound, retry, full);
    box.append(img, video, note, bar);
    root.append(box);

    let token = control.token,
      stopped = false,
      attempt = 0,
      retryTimer;
    const say = (text) => {
      note.hidden = !text;
      if (text) note.querySelector("span").textContent = text;
    };
    const stop = () => {
      clearTimeout(retryTimer);
      // Clearing the sources closes the HTTP stream to Home Assistant.
      img.removeAttribute("src");
      video.pause();
      video.removeAttribute("src");
      video.load?.();
    };
    const mjpeg = () => {
      video.hidden = true;
      sound.hidden = true;
      img.hidden = false;
      live.dataset.still = "false";
      img.onload = () => {
        attempt = 0;
        say("");
      };
      img.onerror = () => {
        if (stopped) return;
        // A rotated access token or a busy camera: try again with the latest.
        attempt++;
        say(
          attempt > 3
            ? "The camera is not answering. Try Reconnect."
            : "Reconnecting to the camera…",
        );
        if (attempt <= 3)
          retryTimer = setTimeout(() => {
            img.src = cameraUrls(d.id, token).mjpeg;
          }, 1500 * attempt);
      };
      img.src = cameraUrls(d.id, token).mjpeg;
    };
    const hls =
      control.stream && !!video.canPlayType?.("application/vnd.apple.mpegurl");
    async function start(manual = false) {
      stop();
      stopped = false;
      if (manual) attempt = 0;
      say("Connecting to the camera…");
      if (hls) {
        try {
          const { url } = await getHass().callWS({
            type: "camera/stream",
            entity_id: d.id,
            format: "hls",
          });
          if (stopped) return;
          img.hidden = true;
          // A still picture until the first video frame arrives.
          video.poster = cameraUrls(d.id, token).still;
          video.hidden = false;
          sound.hidden = false;
          live.dataset.still = "false";
          video.onplaying = () => {
            clearTimeout(retryTimer);
            say("");
          };
          video.onerror = () => !stopped && mjpeg();
          video.src = url;
          video.play?.().catch(() => {});
          // A browser that only "maybe" plays HLS can stall without an error.
          retryTimer = setTimeout(() => {
            if (!stopped && video.readyState < 2) {
              video.removeAttribute("src");
              mjpeg();
            }
          }, 10000);
          return;
        } catch {
          // No stream integration or no stream source: use the proxy.
        }
      }
      mjpeg();
    }
    start();
    cleanups.push(() => {
      stopped = true;
      stop();
      doc.removeEventListener("fullscreenchange", onFullscreen);
      if (doc.fullscreenElement === box) doc.exitFullscreen?.();
    });
    return (nd) => {
      // Keep the running stream; only remember the newest token for retries.
      token = find(nd, (c) => c.kind === "camera")?.token || token;
    };
  }

  function actionLayout(d, root) {
    const btns = find(d, (c) => c.kind === "buttons");
    const center = h(doc, "div", "mi-center");
    for (const b of btns.buttons) {
      const pill = h(doc, "button", "mi-pill", b.label);
      pill.type = "button";
      pill.onclick = () => call(d, btns, b.service);
      center.append(pill);
    }
    root.append(center);
    return () => {};
  }

  /**
   * Robot vacuum, laid out like Home Assistant's more-info-vacuum: big state
   * with the time and battery, the animated status picture, a row of square
   * command buttons, then Fan speed and "Cleaning · By area" chips. Clean by
   * area opens a view of the areas mapped to the vacuum's segments.
   */
  function vacuumLayout(d, root) {
    dialog.classList.add("mi-vacuum");
    subtitle.hidden = true;
    const main = h(doc, "div", "mi-center");
    const head = h(
      doc,
      "div",
      "mi-statehead mi-vac-head",
      `<strong></strong><span class="mi-vac-since"></span><span class="mi-vac-battery" hidden></span>`,
    );
    const art = h(
      doc,
      "div",
      "mi-vac-status",
      `<div class="container idle">${VACUUM_STATUS_SVG}</div>`,
    );
    const row = h(doc, "div", "mi-vac-buttons");
    const buttons = new Map();
    for (const b of find(d, (c) => c.kind === "vacuum").buttons) {
      const button = h(doc, "button", "mi-vac-btn", svg(b.icon));
      button.type = "button";
      button.onclick = () => {
        const control = find(latest, (c) => c.kind === "vacuum");
        const now = control.buttons.find((x) => x.key === b.key);
        if (now && !now.disabled) call(latest, control, now.service);
      };
      buttons.set(b.key, button);
      row.append(button);
    }
    const chips = h(doc, "div", "mi-vac-chips");
    const vacuum = find(d, (c) => c.kind === "vacuum");
    // Fan speed menu: a pop-up on its chip, like Home Assistant's select menu.
    const panel = h(doc, "div", "mi-vac-menu");
    panel.hidden = true;
    panel.setAttribute("role", "listbox");
    const list = h(doc, "ul", "mi-list");
    panel.append(list);
    const closeMenu = () => {
      panel.hidden = true;
      fanChip?.setAttribute("aria-expanded", "false");
    };
    dialog.addEventListener("click", (event) => {
      if (!panel.hidden && !event.target.closest?.(".mi-vac-fan")) closeMenu();
    });
    let fanChip;
    if (vacuum.fanSpeeds.length) {
      fanChip = h(
        doc,
        "button",
        "mi-vac-chip",
        `<span class="mi-vac-chip-icon">${svg("fan")}</span><span class="mi-vac-chip-text"><span class="mi-vac-chip-label">Fan speed</span><span class="mi-vac-chip-value"></span></span>`,
      );
      fanChip.type = "button";
      fanChip.setAttribute("aria-haspopup", "listbox");
      fanChip.onclick = () => {
        if (!panel.hidden) return closeMenu();
        panel.hidden = false;
        fanChip.setAttribute("aria-expanded", String(!panel.hidden));
        if (panel.hidden) return;
        const control = find(latest, (c) => c.kind === "vacuum");
        list.replaceChildren();
        for (const speed of control.fanSpeeds) {
          const li = h(doc, "li");
          const b = h(doc, "button");
          b.type = "button";
          b.setAttribute("role", "radio");
          b.setAttribute("aria-checked", String(speed === control.fanSpeed));
          b.textContent = cap(speed);
          b.onclick = () => {
            closeMenu();
            call(latest, control, { fan_speed: speed });
          };
          li.append(b);
          list.append(li);
        }
      };
      const fan = h(doc, "div", "mi-vac-fan");
      fan.append(fanChip, panel);
      chips.append(fan);
    }
    if (map) {
      const mapChip = h(
        doc,
        "button",
        "mi-vac-chip",
        `<span class="mi-vac-chip-icon">${svg("map")}</span><span class="mi-vac-chip-text"><span class="mi-vac-chip-label">Map</span><span class="mi-vac-chip-value">Show map</span></span><span class="mi-vac-chip-icon">${svg("next")}</span>`,
      );
      mapChip.type = "button";
      mapChip.onclick = () => openMap();
      chips.append(mapChip);
    }
    if (vacuum.cleanArea) {
      const areaChip = h(
        doc,
        "button",
        "mi-vac-chip",
        `<span class="mi-vac-chip-icon">${svg("area")}</span><span class="mi-vac-chip-text"><span class="mi-vac-chip-label">Cleaning</span><span class="mi-vac-chip-value">By area</span></span><span class="mi-vac-chip-icon">${svg("next")}</span>`,
      );
      areaChip.type = "button";
      areaChip.onclick = () => openAreas();
      chips.append(areaChip);
    }
    main.append(head, art, row);
    if (chips.childElementCount) main.append(chips);
    root.append(main);
    // ---- the device's extra entities, grouped as on its device page ----
    const extrasEl = h(doc, "div", "mi-extras");
    let categories = {};
    // Sections start folded, like Attributes; ones opened stay open.
    const opened = new Set();
    const rowEls = new Map();
    const categoryOf = (id) =>
      getHass().entities?.[id]?.entity_category ?? categories[id] ?? null;
    const prefix = () =>
      getHass().states?.[entityId]?.attributes?.friendly_name || "";
    const sendRow = async (row, value) => {
      try {
        showError("");
        const [domain, service, data] = entityRowCall(row, value);
        await getHass().callService(domain, service, data);
      } catch (error) {
        showError(error?.message || "The command failed.");
        onError(error);
      }
    };
    function buildExtras() {
      extrasEl.replaceChildren();
      rowEls.clear();
      if (!extras.length) return;
      const groups = [
        [null, "Controls"],
        ["config", "Configuration"],
        ["diagnostic", "Diagnostic"],
      ];
      for (const [category, label] of groups) {
        const ids = extras.filter(
          (id) => (categoryOf(id) || null) === category,
        );
        if (!ids.length) continue;
        const section = h(
          doc,
          "details",
          "mi-extra-section",
          `<summary><span></span><span class="mi-extra-count">${ids.length}</span>${svg("chevron")}</summary>`,
        );
        section.querySelector("summary span").textContent = label;
        section.open = opened.has(label);
        section.addEventListener("toggle", () => {
          if (section.open) opened.add(label);
          else opened.delete(label);
        });
        for (const id of ids) {
          const el = h(
            doc,
            "div",
            "mi-row",
            `<ha-state-icon class="mi-row-icon"></ha-state-icon><span class="mi-row-name"></span><span class="mi-row-ctl"></span>`,
          );
          section.append(el);
          rowEls.set(id, { el, kind: null });
        }
        extrasEl.append(section);
      }
      syncExtras();
    }
    function syncExtras() {
      const hass = getHass();
      for (const [id, slot] of rowEls) {
        const entity = hass.states?.[id],
          row = entityRow(entity, { prefix: prefix() }),
          { el } = slot,
          icon = el.querySelector("ha-state-icon"),
          ctl = el.querySelector(".mi-row-ctl");
        icon.hass = hass;
        // The full-screen page's icon element knows only named icons; give
        // it the one Home Assistant uses for this kind of entity.
        icon.dataset.defaultIcon = rowIcon(entity, row);
        if (entity) icon.stateObj = entity;
        el.querySelector(".mi-row-name").textContent = row.name;
        el.dataset.unavailable = String(row.unavailable);
        const kind = row.unavailable ? "value" : row.kind;
        // Rebuild the control only when its kind changes, so a control in
        // use (an open select, a dragged slider) is not replaced under the finger.
        if (
          slot.kind !== kind ||
          (kind === "select" && slot.options !== row.options.join("|"))
        ) {
          slot.kind = kind;
          slot.options = row.options?.join("|");
          ctl.replaceChildren();
          if (kind === "toggle") {
            const b = h(doc, "button", "mi-row-switch");
            b.type = "button";
            b.setAttribute("role", "switch");
            b.onclick = () => {
              const current = entityRow(getHass().states?.[id]);
              sendRow(current, !current.on);
            };
            ctl.append(b);
          } else if (kind === "select") {
            const select = h(doc, "select", "mi-row-select");
            for (const option of row.options) {
              const o = h(doc, "option");
              o.value = option;
              o.textContent = cap(option);
              select.append(o);
            }
            select.onchange = () =>
              sendRow(entityRow(getHass().states?.[id]), select.value);
            ctl.append(select);
          } else if (kind === "number") {
            const range = h(doc, "input", "mi-row-range");
            range.type = "range";
            const out = h(doc, "output", "mi-row-value");
            range.oninput = () => {
              out.textContent = `${range.value}${row.unit === "%" ? "%" : row.unit ? ` ${row.unit}` : ""}`;
            };
            range.onchange = () =>
              sendRow(entityRow(getHass().states?.[id]), range.value);
            ctl.append(range, out);
          } else if (kind === "button") {
            const b = h(doc, "button", "mi-row-press", "Press");
            b.type = "button";
            b.onclick = () => sendRow(entityRow(getHass().states?.[id]));
            ctl.append(b);
          } else if (kind === "time") {
            const input = h(doc, "input", "mi-row-time");
            input.type = "time";
            input.onchange = () =>
              sendRow(entityRow(getHass().states?.[id]), input.value);
            ctl.append(input);
          } else ctl.append(h(doc, "span", "mi-row-value"));
        }
        const label = `${row.name}`;
        if (kind === "toggle") {
          const b = ctl.firstChild;
          b.setAttribute("aria-checked", String(row.on));
          b.setAttribute("aria-label", label);
        } else if (kind === "select") {
          const select = ctl.firstChild;
          select.setAttribute("aria-label", label);
          if (doc.activeElement !== select) {
            // "unknown" shows as an empty choice, as Home Assistant does.
            select.value = row.options.includes(row.value) ? row.value : "";
            if (!row.options.includes(row.value)) select.selectedIndex = -1;
          }
        } else if (kind === "number") {
          const [range, out] = ctl.children;
          Object.assign(range, { min: row.min, max: row.max, step: row.step });
          range.setAttribute("aria-label", label);
          if (doc.activeElement !== range && row.value !== undefined)
            range.value = row.value;
          out.textContent = `${row.value ?? "—"}${row.unit === "%" ? "%" : row.unit ? ` ${row.unit}` : ""}`;
        } else if (kind === "button") {
          ctl.firstChild.setAttribute("aria-label", `Press ${label}`);
        } else if (kind === "time") {
          const input = ctl.firstChild;
          input.setAttribute("aria-label", label);
          if (doc.activeElement !== input) input.value = row.value;
        } else ctl.firstChild.textContent = row.value;
      }
    }
    if (extras.length) main.append(extrasEl);
    buildExtras();

    // ---- the robot's map picture ----
    const mapView = h(doc, "div", "mi-vac-areas mi-vac-map");
    mapView.hidden = true;
    root.append(mapView);
    let mapShown = "";
    const mapSrc = () => {
      const entity = getHass().states?.[map],
        picture = entity?.attributes?.entity_picture;
      if (!picture) return "";
      // The state changes with each new picture; it keeps the URL fresh.
      return `${picture}${picture.includes("?") ? "&" : "?"}t=${encodeURIComponent(entity.state)}`;
    };
    function syncMap() {
      if (mapView.hidden) return;
      const src = mapSrc(),
        img = mapView.querySelector("img"),
        note = mapView.querySelector(".mi-vac-hint");
      const entity = getHass().states?.[map];
      note.textContent = !entity
        ? "The map entity was not found."
        : src
          ? `Updated ${sinceText(entity.state) || sinceText(entity.last_changed) || ""}`
          : "No map picture yet.";
      img.hidden = !src;
      if (src && src !== mapShown) {
        mapShown = src;
        img.src = src;
      }
    }
    function openMap() {
      main.hidden = true;
      areasView.hidden = true;
      mapView.hidden = false;
      dialog.classList.add("mi-vac-in-areas");
      mapView.innerHTML = `<div class="mi-vac-areas-head"><button type="button" class="mi-iconbtn" aria-label="Back">${svg("back")}</button><h3>Map</h3></div><img class="mi-vac-map-img" alt="" hidden><p class="mi-vac-hint"></p>`;
      mapView.querySelector("img").alt = `${prefix() || "Vacuum"} map`;
      mapView.querySelector("button").onclick = () => {
        mapView.hidden = true;
        main.hidden = false;
        mapShown = "";
        dialog.classList.remove("mi-vac-in-areas");
      };
      mapShown = "";
      syncMap();
    }

    // ---- clean by area (Home Assistant's clean-areas view) ----
    const areasView = h(doc, "div", "mi-vac-areas");
    areasView.hidden = true;
    root.append(areasView);
    let selected = [];
    const closeAreas = () => {
      areasView.hidden = true;
      main.hidden = false;
      dialog.classList.remove("mi-vac-in-areas");
    };
    async function openAreas() {
      main.hidden = true;
      areasView.hidden = false;
      dialog.classList.add("mi-vac-in-areas");
      selected = [];
      areasView.innerHTML = `<div class="mi-vac-areas-head"><button type="button" class="mi-iconbtn" aria-label="Back">${svg("back")}</button><h3>Clean areas</h3></div><div class="mi-vac-areas-body"><p class="mi-vac-hint">Loading areas…</p></div>`;
      areasView.querySelector("button").onclick = closeAreas;
      const bodyEl = areasView.querySelector(".mi-vac-areas-body");
      let mapped, areas, floors;
      try {
        const hass = getHass();
        const [entry, areaList, floorList] = await Promise.all([
          hass.callWS({
            type: "config/entity_registry/get",
            entity_id: entityId,
          }),
          hass.callWS({ type: "config/area_registry/list" }),
          hass.callWS({ type: "config/floor_registry/list" }).catch(() => []),
        ]);
        mapped = new Set(
          Object.keys(entry?.options?.vacuum?.area_mapping || {}),
        );
        areas = areaList.filter((a) => mapped.has(a.area_id));
        floors = floorList;
      } catch (error) {
        bodyEl.innerHTML = `<p class="mi-error"></p>`;
        bodyEl.firstChild.textContent =
          error?.message || "Could not load the vacuum's areas.";
        return;
      }
      if (!areas.length) {
        bodyEl.innerHTML = `<div class="mi-vac-empty">${svg("area")}<p class="mi-vac-empty-title">No areas set up</p><p>Map this vacuum's rooms to Home Assistant areas in its entity settings, then clean them from here.</p></div>`;
        return;
      }
      const sections = [];
      for (const floor of [...floors].sort(
        (a, b) => (a.level ?? 0) - (b.level ?? 0),
      )) {
        const inFloor = areas.filter((a) => a.floor_id === floor.floor_id);
        if (inFloor.length) sections.push([floor.name, inFloor]);
      }
      const other = areas.filter(
        (a) => !floors.some((f) => f.floor_id === a.floor_id),
      );
      if (other.length) sections.push(["Other areas", other]);
      bodyEl.replaceChildren();
      for (const [name, list] of sections) {
        const section = h(doc, "div", "mi-vac-section");
        if (sections.length > 1)
          section.append(h(doc, "div", "mi-vac-section-name"));
        if (sections.length > 1) section.firstChild.textContent = name;
        const grid = h(doc, "div", "mi-vac-grid");
        for (const area of list) {
          const card = h(
            doc,
            "button",
            "mi-vac-area",
            `<span class="mi-vac-badge" hidden></span><span class="mi-vac-area-icon">${svg("area")}</span><span class="mi-vac-area-name"></span>`,
          );
          card.type = "button";
          card.dataset.area = area.area_id;
          card.querySelector(".mi-vac-area-name").textContent = area.name;
          card.onclick = () => {
            const at = selected.indexOf(area.area_id);
            selected =
              at >= 0
                ? selected.filter((id) => id !== area.area_id)
                : [...selected, area.area_id];
            paint();
          };
          grid.append(card);
        }
        section.append(grid);
        bodyEl.append(section);
      }
      bodyEl.append(
        h(
          doc,
          "p",
          "mi-vac-hint",
          "The order in which areas are cleaned may not be supported by your vacuum.",
        ),
      );
      const footer = h(doc, "div", "mi-vac-footer");
      const start = h(doc, "button", "mi-pill");
      start.type = "button";
      start.onclick = async () => {
        start.disabled = true;
        const control = find(latest, (c) => c.kind === "vacuum");
        if (await call(latest, control, { areas: selected })) closeAreas();
        else paint();
      };
      footer.append(start);
      areasView.append(footer);
      const paint = () => {
        for (const card of bodyEl.querySelectorAll(".mi-vac-area")) {
          const at = selected.indexOf(card.dataset.area);
          card.setAttribute("aria-pressed", String(at >= 0));
          const badge = card.querySelector(".mi-vac-badge");
          badge.hidden = at < 0;
          badge.textContent = String(at + 1);
        }
        start.disabled = !selected.length;
        start.textContent = `Start cleaning${selected.length ? ` (${selected.length})` : ""}`;
      };
      paint();
    }

    // ---- battery: the device's battery sensor, as Home Assistant finds it ----
    let batteryIds = null;
    getHass()
      .callWS?.({ type: "config/entity_registry/list_for_display" })
      .then((registry) => {
        const entries = registry?.entities || [];
        // Entity categories for grouping the extra entities (frontend
        // pages already have them in hass.entities).
        const names = registry?.entity_categories || {};
        categories = Object.fromEntries(
          entries
            .filter((e) => e.ec !== undefined && names[e.ec])
            .map((e) => [e.ei, names[e.ec]]),
        );
        if (extras.length) buildExtras();
        const device = entries.find((e) => e.ei === entityId)?.di;
        if (!device) return;
        const siblings = entries
          .filter((e) => e.di === device)
          .map((e) => e.ei);
        const states = getHass().states || {};
        const battery = siblings.find(
          (id) =>
            /^sensor\./.test(id) &&
            states[id]?.attributes?.device_class === "battery" &&
            !isNaN(Number(states[id].state)),
        );
        const charging = siblings.find(
          (id) =>
            /^binary_sensor\./.test(id) &&
            states[id]?.attributes?.device_class === "battery_charging",
        );
        batteryIds = { battery, charging };
        if (latest) sync(latest);
      })
      .catch(() => {});
    const since = setInterval(() => {
      if (!dialog.isConnected) return clearInterval(since);
      const entity = getHass().states?.[entityId];
      head.querySelector(".mi-vac-since").textContent = sinceText(
        entity?.last_changed,
      );
    }, 5000);
    let latest;
    const COLOR = {
      cleaning: "var(--state-vacuum-active-color,#009688)",
      returning: "var(--state-vacuum-active-color,#009688)",
      error: "var(--error-color,#db4437)",
    };
    const sync = (nd) => {
      latest = nd;
      const control = find(nd, (c) => c.kind === "vacuum");
      if (!control) return;
      const entity = getHass().states?.[entityId];
      head.firstChild.textContent = control.status || cap(nd.state) || "";
      head.querySelector(".mi-vac-since").textContent = nd.since || "";
      const states = getHass().states || {};
      const level = batteryIds?.battery
        ? Number(states[batteryIds.battery]?.state)
        : control.battery;
      const charging = batteryIds?.charging
        ? states[batteryIds.charging]?.state === "on"
        : nd.state === "docked" && level < 100;
      const batteryEl = head.querySelector(".mi-vac-battery");
      batteryEl.hidden = !Number.isFinite(level);
      if (Number.isFinite(level))
        batteryEl.innerHTML = `<span>${Math.round(level)}%</span>${svg(charging ? "batterycharging" : "battery")}`;
      const visual = vacuumVisualState(entity);
      const container = art.firstChild;
      container.className = `container ${visual}`;
      container.style.setProperty(
        "--vacuum-color",
        COLOR[visual] || "var(--mi-muted)",
      );
      for (const b of control.buttons) {
        const button = buttons.get(b.key);
        if (!button) continue;
        button.innerHTML = svg(b.icon);
        button.disabled = b.disabled;
        button.title = b.label;
        button.setAttribute("aria-label", b.label);
      }
      if (fanChip)
        fanChip.querySelector(".mi-vac-chip-value").textContent =
          cap(control.fanSpeed) || "—";
      syncExtras();
      syncMap();
    };
    return sync;
  }

  function plainLayout(d, root, entity) {
    const center = h(doc, "div", "mi-center");
    const value = h(doc, "div", "mi-state");
    center.append(value);
    root.append(center);
    return (nd, e) => {
      const unit = e?.attributes?.unit_of_measurement;
      value.textContent = `${cap(nd.state) ?? ""}${unit ? ` ${unit}` : ""}`;
    };
  }

  const LAYOUTS = {
    light: lightLayout,
    cover: coverLayout,
    lock: lockLayout,
    vacuum: vacuumLayout,
    climate: climateLayout,
    alarm_control_panel: alarmLayout,
    camera: cameraLayout,
    switch: switchLayout,
    input_boolean: switchLayout,
    fan: switchLayout,
    automation: switchLayout,
    button: actionLayout,
    input_button: actionLayout,
    scene: actionLayout,
    script: actionLayout,
  };

  let sync = () => {};
  function build(d) {
    runCleanups();
    dialog.classList.remove("mi-wide", "mi-vacuum", "mi-vac-in-areas");
    body.replaceChildren();
    errorEl = undefined;
    const root = h(doc, "div");
    body.append(root);
    subtitle.hidden = false;
    const layout = d.unavailable
      ? plainLayout
      : LAYOUTS[d.domain] || plainLayout;
    sync = layout(d, root);
    if (d.attributes.length) {
      const details = h(
        doc,
        "details",
        "mi-attrs",
        `<summary><span>Attributes</span>${svg("chevron")}</summary>`,
      );
      const dl = h(doc, "dl");
      for (const [k, v] of d.attributes) {
        dl.append(h(doc, "dt"), h(doc, "dd"));
        dl.lastChild.previousSibling.textContent = k;
        dl.lastChild.textContent = v;
      }
      details.append(dl);
      body.append(details);
    }
  }

  function update() {
    const entity = getHass().states?.[entityId];
    const d = describeEntity(entity);
    title.textContent = d.name;
    subtitle.textContent = d.unavailable
      ? "Unavailable"
      : [cap(d.state), d.changed && `changed ${d.changed}`]
          .filter(Boolean)
          .join(" · ");
    const next = [
      d.unavailable,
      d.domain,
      ...d.controls.map(
        (c) =>
          `${c.kind}:${c.key || ""}:${(c.options || []).join(",")}:${(c.buttons || c.modes || []).length}`,
      ),
    ].join("|");
    if (next !== signature) {
      signature = next;
      build(d);
    }
    sync(d, entity);
  }

  const closeDialog = () => {
    if (dialog.open) dialog.close();
  };
  closeBtn.onclick = closeDialog;
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener("close", () => {
    runCleanups();
    dialog.remove();
  });
  // ---- phones: drag the sheet down to dismiss it ----
  const grab = h(doc, "div", "mi-grab");
  grab.setAttribute("aria-hidden", "true");
  frame.prepend(grab);
  const win = doc.defaultView;
  const isSheet = () => win?.matchMedia?.("(max-width:600px)").matches;
  // Controls that use a vertical drag themselves keep it.
  const OWN_DRAG =
    "input, select, textarea, .mi-slider, .mi-dial, .mi-cover-switch, .mi-mode, [role=slider]";
  let drag = null;
  const place = (dy) =>
    dialog.style.setProperty("transform", dy ? `translateY(${dy}px)` : "");
  dialog.addEventListener(
    "touchstart",
    (event) => {
      if (!isSheet() || event.touches.length !== 1) return (drag = null);
      if (event.target.closest?.(OWN_DRAG)) return (drag = null);
      const touch = event.touches[0];
      drag = {
        y: touch.clientY,
        t: performance.now(),
        dy: 0,
        active: false,
        // From the handle or the header, or the content scrolled to its top.
        fromTop: !!event.target.closest?.(".mi-grab, .mi-head"),
      };
    },
    { passive: true },
  );
  dialog.addEventListener(
    "touchmove",
    (event) => {
      if (!drag) return;
      const dy = event.touches[0].clientY - drag.y;
      if (!drag.active) {
        if (dy < -6) return (drag = null); // scrolling up the content
        if (dy < 8 || !(drag.fromTop || body.scrollTop <= 0)) return;
        drag.active = true;
        drag.y += dy; // follow from here, no jump
        drag.t = performance.now();
        dialog.classList.add("mi-dragging");
        return;
      }
      event.preventDefault();
      drag.dy = Math.max(0, dy);
      place(drag.dy);
    },
    { passive: false },
  );
  const release = () => {
    const done = drag;
    drag = null;
    if (!done?.active) return;
    dialog.classList.remove("mi-dragging");
    const speed = done.dy / Math.max(1, performance.now() - done.t);
    const reduced = win?.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (done.dy > Math.min(140, dialog.offsetHeight * 0.25) || speed > 0.8) {
      if (reduced) return closeDialog();
      dialog.classList.add("mi-settling");
      place(dialog.offsetHeight);
      setTimeout(closeDialog, 220);
      return;
    }
    dialog.classList.add("mi-settling");
    place(0);
    setTimeout(() => dialog.classList.remove("mi-settling"), 240);
  };
  dialog.addEventListener("touchend", release);
  dialog.addEventListener("touchcancel", release);

  update();
  dialog.showModal();
  // Open without a focus ring on the close button (a touch is not a Tab).
  dialog.tabIndex = -1;
  dialog.focus({ preventScroll: true });
  return { update, close: closeDialog, dialog };
}
