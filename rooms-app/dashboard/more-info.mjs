import { ICONS } from "./more-info-icons.mjs";
import { describeEntity, controlCall, hsToRgb } from "./more-info-model.mjs";
import { kelvinToRgb } from "../shared/light.mjs";

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
@media (prefers-reduced-motion:reduce){dialog.mi{animation:none}.mi *{transition:none!important}}
@media (max-width:600px){dialog.mi{width:100vw;max-width:100vw;margin:auto 0 0;border-radius:28px 28px 0 0;max-height:94vh;animation-name:mi-up}@keyframes mi-up{from{transform:translateY(100%)}}}
.mi-frame{display:flex;flex-direction:column;max-height:min(92vh,880px)}
@media (max-width:600px){.mi-frame{max-height:94vh}}
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
`;

const svg = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;
const rgbCss = (rgb) => `rgb(${rgb.join(",")})`;
const inkFor = ([r, g, b]) =>
  (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#1c1c1c" : "#fff";
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1).replace(/_/g, " ") : s);
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
export function openMoreInfo({ host, getHass, entityId, onError = () => {} }) {
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
    } catch (error) {
      showError(error?.message || "The command failed.");
      onError(error);
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
        min: 1,
        max: 255,
        step: 1,
        value: bright.value,
        format: (v) => `${Math.round((v / 255) * 100)}%`,
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
          ? `${Math.round(((c?.value ?? 0) / 255) * 100)}%`
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
    const center = h(doc, "div", "mi-center");
    let slider;
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
    for (const b of btns?.buttons || [])
      row.append(
        round(doc, ICON[b.service], LABEL[b.service], () =>
          call(d, btns, b.service),
        ),
      );
    center.append(row);
    root.append(center);
    return (nd) => {
      dialog.style.setProperty("--mi-accent", "#9c27b0");
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
    climate: climateLayout,
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
    body.replaceChildren();
    errorEl = undefined;
    const root = h(doc, "div");
    body.append(root);
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
          `${c.kind}:${c.key || ""}:${(c.options || []).join(",")}:${(c.buttons || []).length}`,
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
  dialog.addEventListener("close", () => dialog.remove());
  update();
  dialog.showModal();
  return { update, close: closeDialog, dialog };
}
