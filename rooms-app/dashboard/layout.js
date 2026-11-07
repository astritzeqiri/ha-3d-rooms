/** Owns viewport sizing and fullscreen without changing saved camera framing. */
export class CardLayout {
  constructor(host) {
    this.host = host;
    this.card = host.shadowRoot.querySelector("ha-card");
    this.scene = host._container;
    this.style = document.createElement("style");
    this.style.textContent = `ha-card[data-fill]{display:flex;flex-direction:column;box-sizing:border-box}ha-card[data-fill] .scene{flex:1;min-height:0;height:auto!important}ha-card[data-fill] .card-top{flex-shrink:0}ha-card[data-fill] .fixture-tray{flex-shrink:0;max-height:30%;overflow:auto;box-sizing:border-box}ha-card:fullscreen{width:100%;border:0;border-radius:0;padding-bottom:env(safe-area-inset-bottom)}.fullscreen-toggle{position:absolute;bottom:max(12px,env(safe-area-inset-bottom));right:12px;z-index:2;display:grid;place-items:center;width:44px;height:44px;padding:10px;color:var(--primary-text-color,#edf2eb);background:var(--card-background-color,#202923)}.fullscreen-toggle svg{width:22px;height:22px}`;
    host.shadowRoot.append(this.style);
    this.button = document.createElement("button");
    this.button.className = "fullscreen-toggle";
    this.button.type = "button";
    this.button.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>';
    this.button.hidden =
      !document.fullscreenEnabled || !this.card.requestFullscreen;
    this.button.onclick = async () => {
      try {
        if (this.fullscreen) await document.exitFullscreen();
        else await this.card.requestFullscreen();
      } catch {
        this.button.title = "Fullscreen is unavailable in this browser";
      }
    };
    this.scene.append(this.button);
    this.schedule = () => {
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => this.update());
    };
    this.changed = () => {
      this.schedule();
      this.button.focus();
    };
    window.addEventListener("resize", this.schedule);
    window.visualViewport?.addEventListener("resize", this.schedule);
    document.addEventListener("fullscreenchange", this.changed);
    this.observer = new ResizeObserver(this.schedule);
    this.observer.observe(host);
    this.observer.observe(host.shadowRoot.querySelector(".card-top"));
    this.schedule();
  }
  get fullscreen() {
    return this.host.shadowRoot.fullscreenElement === this.card;
  }
  update() {
    const fill = this.fullscreen || this.host._config?.height === "auto";
    this.card.toggleAttribute("data-fill", fill);
    if (fill) {
      const viewport = window.visualViewport;
      const bottom = viewport
        ? viewport.height + viewport.offsetTop
        : window.innerHeight;
      // Use the actual card offset: HA headers, view tabs and dashboard padding vary.
      const top = this.fullscreen
        ? 0
        : Math.max(0, this.card.getBoundingClientRect().top);
      const height = `${Math.max(180, Math.floor(bottom - top))}px`;
      if (this.card.style.height !== height) this.card.style.height = height;
    } else {
      this.card.style.height = "";
      this.scene.style.height = `${this.host._config?.height || 500}px`;
    }
    const label = this.fullscreen ? "Exit fullscreen" : "Enter fullscreen";
    this.button.setAttribute("aria-label", label);
    this.button.setAttribute("aria-pressed", String(this.fullscreen));
    this.button.title = label;
  }
  dispose() {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    window.removeEventListener("resize", this.schedule);
    window.visualViewport?.removeEventListener("resize", this.schedule);
    document.removeEventListener("fullscreenchange", this.changed);
    this.button.remove();
    this.style.remove();
  }
}
