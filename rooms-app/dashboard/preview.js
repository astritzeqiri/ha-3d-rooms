/** Render the actual dashboard card in HA's document and theme, without saving. */
export function openDashboardPreview(host, component, hass) {
  const dialog = document.createElement("dialog");
  dialog.setAttribute("aria-labelledby", "dashboard-preview-title");
  dialog.innerHTML = `<style>
    dialog.dashboard-preview{box-sizing:border-box;width:min(960px,calc(100vw - 24px));max-width:none;max-height:calc(100dvh - 24px);padding:0;border:1px solid var(--divider-color,#777);border-radius:12px;background:var(--primary-background-color,#fafafa);color:var(--primary-text-color,#212121);font:14px/1.5 system-ui}
    .dashboard-preview::backdrop{background:#0009}
    .preview-toolbar{position:sticky;top:0;z-index:2;background:var(--primary-background-color,#fafafa);display:flex;align-items:center;flex-wrap:wrap;gap:12px;padding:16px;border-bottom:1px solid var(--divider-color,#777)}
    .preview-toolbar h2{font-size:18px;margin:0;flex:1;min-width:160px}
    .preview-actions{display:flex;align-items:center;gap:12px;margin-left:auto}
    .preview-widths{display:flex;padding:3px;border:1px solid var(--divider-color,#ddd);border-radius:8px;background:var(--secondary-background-color,#eee)}
    .preview-toolbar button{display:inline-flex;align-items:center;justify-content:center;gap:8px;box-sizing:border-box;min-height:44px;padding:8px 12px;border:0;border-radius:5px;color:var(--secondary-text-color,#555);background:transparent;font:500 14px/20px system-ui;cursor:pointer;white-space:nowrap}
    .preview-widths button[aria-pressed="true"]{color:var(--primary-text-color,#212121);background:var(--card-background-color,#fff);box-shadow:0 1px 3px #0002}
    .preview-toolbar button:hover{color:var(--primary-text-color,#212121);background:var(--card-background-color,#fff)}
    .preview-toolbar .preview-close{width:44px;padding:10px;border-radius:50%}
    .preview-toolbar svg{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    @media(max-width:480px){.preview-toolbar{gap:8px;padding:12px}.preview-toolbar h2{flex-basis:100%}.preview-actions{width:100%;justify-content:space-between}.preview-widths{flex:1}.preview-widths button{flex:1}}
    .preview-toolbar :focus-visible{outline:2px solid var(--primary-color,#03a9f4);outline-offset:2px}
    .preview-note{margin:0;padding:12px 16px;color:var(--secondary-text-color,#555)}
    .preview-dashboard{padding:16px;background:var(--lovelace-background,var(--primary-background-color,#fafafa))}
    .preview-card{width:100%;max-width:560px;margin:auto}
    .preview-card[data-width="phone"]{max-width:360px}
    @media(max-width:600px){dialog.dashboard-preview{width:100vw;max-width:100vw;max-height:100dvh;margin:auto 0;border-radius:0;overflow:auto;overscroll-behavior:contain}.preview-toolbar{gap:8px;padding:12px}.preview-toolbar h2{font-size:16px}.preview-note{font-size:13px;padding:12px}.preview-dashboard{padding:12px;padding-bottom:max(12px,env(safe-area-inset-bottom))}}
  </style><div class="preview-toolbar"><h2 id="dashboard-preview-title">Dashboard preview</h2><div class="preview-actions"><div class="preview-widths" role="group" aria-label="Preview card width"><button type="button" data-width="desktop" aria-pressed="true"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 21h8M12 16v5"/></svg>Desktop</button><button type="button" data-width="phone" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>Phone</button></div><button class="preview-close" type="button" aria-label="Close preview" title="Close preview" autofocus><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div></div><p class="preview-note">Your current changes, without saving. Device controls are live. The final card width depends on your dashboard layout.</p><div class="preview-dashboard"><div class="preview-card"></div></div>`;
  dialog.className = "dashboard-preview";
  const card = document.createElement("three-d-rooms-card");
  card.setConfig({
    type: "custom:three-d-rooms-card",
    ...structuredClone(component.layers[0]),
    title: component.title,
    show_title: component.show_title ?? true,
    height: component.height,
    markers: component.markers,
  });
  card.hass = hass;
  dialog.querySelector(".preview-card").append(card);
  for (const button of dialog.querySelectorAll(".preview-widths button")) {
    button.onclick = () => {
      dialog.querySelector(".preview-card").dataset.width =
        button.dataset.width;
      for (const option of dialog.querySelectorAll(".preview-widths button"))
        option.setAttribute("aria-pressed", String(option === button));
    };
  }
  dialog.querySelector(".preview-close").onclick = () => dialog.close();
  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    )
      dialog.close();
  });
  host.append(dialog);
  dialog.showModal();
  return {
    card,
    close: () => dialog.close(),
    closed: new Promise((resolve) => {
      dialog.addEventListener(
        "close",
        () => {
          dialog.remove();
          resolve();
        },
        { once: true },
      );
    }),
  };
}
