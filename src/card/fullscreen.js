// Kiosk-style fullscreen mode and burn-in pixel shift.
// Mixed into VanPowerCard.prototype; methods run with `this` = the card.
export const fullscreenMethods = {
  isFullscreenEnabled() {
    return this._config.fullscreen === true || this._config.fullscreen === "true";
  },
  startPixelShift() {
    const card = this.shadowRoot?.getElementById("dynamic-card");
    if (!card) return;
    if (this._pixelShiftTimer) {
      clearInterval(this._pixelShiftTimer);
      this._pixelShiftTimer = null;
    }
    const overscan = 30;
    const step = 5;
    card.style.position = "relative";
    card.style.width = `calc(100% + ${overscan * 2}px)`;
    card.style.height = `calc(100% + ${overscan * 2}px)`;
    card.style.left = `${-overscan}px`;
    card.style.top = `${-overscan}px`;
    card.style.willChange = "transform";
    const updateShift = () => {
      const x = Math.round((Math.random() * 2 - 1) * (overscan / step)) * step;
      const y = Math.round((Math.random() * 2 - 1) * (overscan / step)) * step;
      card.style.transform = `translate(${x}px, ${y}px)`;
    };
    updateShift();
    this._pixelShiftTimer = setInterval(updateShift, 3e4);
  },
  stopPixelShift() {
    if (this._pixelShiftTimer) {
      clearInterval(this._pixelShiftTimer);
      this._pixelShiftTimer = null;
    }
    const card = this.shadowRoot?.getElementById("dynamic-card");
    if (card) {
      card.style.removeProperty("position");
      card.style.removeProperty("width");
      card.style.removeProperty("height");
      card.style.removeProperty("left");
      card.style.removeProperty("top");
      card.style.removeProperty("transform");
      card.style.removeProperty("will-change");
    }
  },
  activateFullscreenMode() {
    const viewDiv = document.querySelector("body > home-assistant")?.shadowRoot?.querySelector("home-assistant-main")?.shadowRoot?.querySelector("ha-drawer > partial-panel-resolver > ha-panel-lovelace")?.shadowRoot?.querySelector("hui-root")?.shadowRoot?.querySelector("#view");
    if (viewDiv) {
      viewDiv.style.setProperty("padding", "0px");
    }
    const haMain = document.querySelector("body > home-assistant")?.shadowRoot?.querySelector("home-assistant-main");
    if (haMain) {
      haMain.style.setProperty("--ha-sidebar-width", "0px");
    }
    const headerDiv = document.querySelector("body > home-assistant")?.shadowRoot?.querySelector("home-assistant-main")?.shadowRoot?.querySelector("ha-drawer > partial-panel-resolver > ha-panel-lovelace")?.shadowRoot?.querySelector("hui-root")?.shadowRoot?.querySelector("div > div.header");
    if (headerDiv) {
      headerDiv.style.setProperty("display", "none");
    }
    this.startPixelShift();
    this._fullscreenApplied = true;
  },
  restoreFullscreenMode() {
    this.stopPixelShift();
    if (!this._fullscreenApplied) return;
    const ham = document.querySelector("body > home-assistant")?.shadowRoot?.querySelector("home-assistant-main");
    if (ham) {
      ham.style.removeProperty("--ha-sidebar-width");
    }
    const drawer = ham?.shadowRoot?.querySelector("ha-drawer");
    const panel = drawer?.querySelector("partial-panel-resolver > ha-panel-lovelace");
    const root = panel?.shadowRoot?.querySelector("hui-root");
    const view = root?.shadowRoot?.querySelector("#view");
    if (view) {
      view.style.removeProperty("padding");
    }
    const header = root?.shadowRoot?.querySelector("div > div.header");
    if (header) {
      header.style.removeProperty("display");
    }
    this._fullscreenApplied = false;
  },
  applyFullscreenMode() {
    if (this.isFullscreenEnabled()) {
      this.activateFullscreenMode();
      return;
    }
    this.restoreFullscreenMode();
  }
};
