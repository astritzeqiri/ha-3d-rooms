/**
 * The adjustable desk's pop-up, laid out like Home Assistant's more-info
 * dialogs: a header with close, the desk's name and height, a large vertical
 * height slider, round Up / Stop / Down buttons and the desk's macros. It uses
 * the Home Assistant theme when there is one (dashboards) and Home Assistant's
 * default light or dark colours otherwise (the full-screen page).
 */
export const DESK_STYLE = `
dialog.dm{--dm-bg:var(--ha-card-background,var(--card-background-color,#1c1c1c));--dm-fg:var(--primary-text-color,#e1e1e1);--dm-muted:var(--secondary-text-color,#9b9b9b);--dm-line:var(--divider-color,#ffffff1f);--dm-surface:color-mix(in srgb,var(--dm-fg) 8%,transparent);--dm-surface-2:color-mix(in srgb,var(--dm-fg) 14%,transparent);--dm-accent:var(--primary-color,#03a9f4);--dm-accent-ink:var(--text-primary-color,#fff);
 box-sizing:border-box;width:min(520px,calc(100vw - 32px));max-width:none;max-height:min(92vh,880px);margin:auto;padding:0;overflow:hidden;border:0;border-radius:28px;background:var(--dm-bg);color:var(--dm-fg);font:400 14px/1.45 Roboto,system-ui,sans-serif;box-shadow:0 24px 64px #0009;animation:dm-in .22s cubic-bezier(.2,.8,.2,1)}
@media (prefers-color-scheme:light){dialog.dm{--dm-bg:var(--ha-card-background,var(--card-background-color,#fff));--dm-fg:var(--primary-text-color,#212121);--dm-muted:var(--secondary-text-color,#727272);--dm-line:var(--divider-color,#0000001f);box-shadow:0 24px 64px #0004}}
dialog.dm::backdrop{background:#000a}
@keyframes dm-in{from{opacity:0;transform:translateY(20px) scale(.98)}}
@media (max-width:600px){dialog.dm{width:100vw;margin:auto 0 0;border-radius:28px 28px 0 0;max-height:94vh;padding-bottom:env(safe-area-inset-bottom);animation-name:dm-up}@keyframes dm-up{from{transform:translateY(100%)}}}
@media (prefers-reduced-motion:reduce){dialog.dm{animation:none}.dm *{transition:none!important}}
.dm form{display:flex;flex-direction:column;max-height:inherit;margin:0}
.dm-head{display:flex;align-items:center;gap:4px;padding:12px 16px 4px 12px;flex-shrink:0}
.dm-titles{flex:1;min-width:0;padding-left:4px}
dialog.dm h2{margin:0;font-weight:500;font-size:20px;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
dialog.dm p{margin:0;color:var(--dm-muted);font-size:13px;line-height:1.45}
dialog.dm button{min-height:0;padding:0;border:0;border-radius:0;background:none;color:inherit;font:inherit;cursor:pointer}
dialog.dm button:focus-visible,.dm-slider:focus-visible{outline:2px solid var(--dm-accent);outline-offset:3px}
.dm-close{display:grid;place-items:center;flex-shrink:0;width:48px;height:48px;border-radius:50%!important;transition:background .15s}
.dm-close:hover{background:var(--dm-surface)!important}
.dm svg{width:24px;height:24px;display:block;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.dm-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:8px 24px 24px;display:flex;flex-direction:column;align-items:center;gap:20px}
.dm-slider{position:relative;width:132px;height:min(300px,38vh);min-height:200px;border-radius:28px;overflow:hidden;background:var(--dm-surface);touch-action:none;cursor:pointer;user-select:none;-webkit-user-select:none;transition:background .15s}
.dm-slider:hover{background:var(--dm-surface-2)}
.dm-slider[aria-disabled=true]{opacity:.5;cursor:default}
.dm-fill{position:absolute;left:0;right:0;bottom:0;background:var(--dm-accent);opacity:.92;transition:height .2s}
.dm-slider.dm-dragging .dm-fill{transition:none}
.dm-readout{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;pointer-events:none;text-shadow:0 1px 2px #0004}
.dm-big{font:500 34px/1.1 Roboto,system-ui,sans-serif}
.dm-small{font-size:14px;opacity:.85}
.dm-row{display:flex;justify-content:center;flex-wrap:wrap;gap:14px 10px;width:100%}
.dm-round{display:flex!important;flex-direction:column;align-items:center;gap:6px;width:76px;font-size:12px!important}
.dm-disc{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:var(--dm-surface-2);transition:background .15s,color .15s}
.dm-round:hover .dm-disc{background:color-mix(in srgb,var(--dm-surface-2) 70%,var(--dm-fg) 14%)}
.dm-round:active .dm-disc{background:var(--dm-accent);color:var(--dm-accent-ink)}
.dm-round:disabled{opacity:.4;cursor:default!important}
.dm-round>span:last-child{max-width:100%;color:var(--dm-muted);text-align:center;overflow-wrap:anywhere;line-height:1.3}
.dm-round ha-state-icon{--mdc-icon-size:24px;width:24px;height:24px;display:flex}
.dm-section{width:100%;border-top:1px solid var(--dm-line);padding-top:16px;display:grid;gap:14px}
.dm-section h3{margin:0;font-size:14px;font-weight:500}
.dm-error:empty{display:none}
dialog.dm .dm-error{color:var(--error-color,#db4437)}
`;

const ICON = {
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
};
const svg = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;
const round = (action, label, icon) =>
  `<button type="button" class="dm-round" data-action="${action}"><span class="dm-disc">${svg(icon)}</span><span>${label}</span></button>`;

export const DESK_HTML = `<style>${DESK_STYLE}</style><form method="dialog"><div class="dm-head"><button class="dm-close" value="close" aria-label="Close">${svg("close")}</button><div class="dm-titles"><h2></h2><p data-desk-status></p></div></div><div class="dm-body"><div class="dm-slider" role="slider" tabindex="0" aria-label="Desk height" aria-orientation="vertical"><div class="dm-fill"></div><div class="dm-readout"><span class="dm-big"></span><span class="dm-small">Height</span></div></div><div class="dm-row">${round("open", "Up", "up")}${round("stop", "Stop", "stop")}${round("close", "Down", "down")}</div><div class="dm-section" data-desk-macros-section><h3>Macros</h3><div class="dm-row dm-macros"></div></div><p class="dm-error" data-desk-error role="alert"></p><p>Set entities and macro names in 3D Rooms → Devices → Desk settings.</p></div></form>`;

/** Snap a value to the slider's range and step. */
export function snapHeight(value, { min, max, step }) {
  const clamped = Math.min(max, Math.max(min, value));
  const steps = Math.round((clamped - min) / (step || 1));
  const snapped = min + steps * (step || 1);
  return Number(Math.min(max, snapped).toFixed(6));
}

/** Height for a pointer at `clientY` on a vertical slider (top = max). */
export function heightAt(clientY, rect, range) {
  const ratio = rect.height ? 1 - (clientY - rect.top) / rect.height : 0;
  return snapHeight(range.min + ratio * (range.max - range.min), range);
}

/** Fill fraction (0–1) for a height. */
export function heightRatio(value, { min, max }) {
  if (!Number.isFinite(value) || max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}
