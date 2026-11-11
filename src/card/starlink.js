// The Starlink pop-up panel and its embedded card.
// Mixed into VanPowerCard.prototype; methods run with `this` = the card.
export const starlinkMethods = {
  getStarlinkCombinedUrl() {
    try {
      const ingressPathRaw = window.localStorage.getItem("starlink_gui.ingress_path");
      const ingressPath = String(ingressPathRaw || "").trim();
      if (!ingressPath) return "";
      const normalized = ingressPath.endsWith("/") ? ingressPath.slice(0, -1) : ingressPath;
      return `${normalized}/combined`;
    } catch {
      return "";
    }
  },
  getStarlinkCardConfig() {
    const config = this._config.starlink_card;
    if (!config || typeof config !== "object" || Array.isArray(config)) return null;
    const type = String(config.type || "").trim();
    return type ? { ...config, type } : null;
  },
  createFallbackCardElement(config) {
    const type = String(config?.type || "").trim();
    const tagName = type.startsWith("custom:") ? type.slice(7) : `hui-${type}-card`;
    if (!tagName) return null;
    const card = document.createElement(tagName);
    if (typeof card.setConfig === "function") {
      card.setConfig(config);
    } else {
      card.config = config;
    }
    return card;
  },
  async createStarlinkCardElement(config) {
    if (typeof window.loadCardHelpers === "function") {
      const helpers = await window.loadCardHelpers();
      if (typeof helpers?.createCardElement === "function") {
        return helpers.createCardElement(config);
      }
    }
    return this.createFallbackCardElement(config);
  },
  async ensureStarlinkCard() {
    const config = this.getStarlinkCardConfig();
    if (!config) return null;
    const host = this.shadowRoot?.getElementById("starlink-card-host");
    if (!host) return null;
    const configKey = JSON.stringify(config);
    if (this._starlinkCardElement && this._starlinkCardConfigKey === configKey) {
      this._starlinkCardElement.hass = this._hass;
      return this._starlinkCardElement;
    }
    const buildId = (this._starlinkCardBuildId || 0) + 1;
    this._starlinkCardBuildId = buildId;
    this._starlinkCardElement = null;
    this._starlinkCardConfigKey = "";
    host.textContent = "Loading...";
    try {
      const card = await this.createStarlinkCardElement(config);
      if (this._starlinkCardBuildId !== buildId) return null;
      if (!card) throw new Error("No card element was created");
      card.hass = this._hass;
      host.replaceChildren(card);
      this._starlinkCardElement = card;
      this._starlinkCardConfigKey = configKey;
      return card;
    } catch (error22) {
      if (this._starlinkCardBuildId !== buildId) return null;
      console.error("Failed to create Starlink popup card", error22);
      host.textContent = "Unable to load Starlink card";
      return null;
    }
  },
  updateStarlinkCardHass() {
    if (this._starlinkCardElement) {
      this._starlinkCardElement.hass = this._hass;
    }
  },
  resetStarlinkCard() {
    this._starlinkCardBuildId = (this._starlinkCardBuildId || 0) + 1;
    this._starlinkCardElement = null;
    this._starlinkCardConfigKey = "";
    const host = this.shadowRoot?.getElementById("starlink-card-host");
    if (host) host.replaceChildren();
  },
  openStarlinkPanel(detail = {}) {
    const panel = this.shadowRoot?.getElementById("starlink-panel");
    const frame = this.shadowRoot?.getElementById("starlink-frame");
    const cardHost = this.shadowRoot?.getElementById("starlink-card-host");
    if (!panel || !frame || !cardHost) return;
    const cardConfig = this.getStarlinkCardConfig();
    if (cardConfig) {
      frame.classList.add("is-hidden");
      frame.removeAttribute("src");
      cardHost.classList.remove("is-hidden");
      this.ensureStarlinkCard();
    } else {
      const url = this.getStarlinkCombinedUrl();
      if (!url) {
        console.warn("Starlink ingress path not found in localStorage key: starlink_gui.ingress_path");
        return;
      }
      cardHost.classList.add("is-hidden");
      frame.classList.remove("is-hidden");
      frame.src = url;
    }
    panel.classList.remove("is-hidden");
    const clientX = Number(detail?.clientX);
    const clientY = Number(detail?.clientY);
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
    const stage = this.shadowRoot?.querySelector(".stage");
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    requestAnimationFrame(() => {
      const panelWidth = panel.offsetWidth || 360;
      const panelHeight = panel.offsetHeight || 260;
      const margin = 10;
      const desiredX = clientX - stageRect.left + 12;
      const desiredY = clientY - stageRect.top + 12;
      const maxX = Math.max(margin, stageRect.width - panelWidth - margin);
      const maxY = Math.max(margin, stageRect.height - panelHeight - margin);
      const clampedX = Math.min(Math.max(margin, desiredX), maxX);
      const clampedY = Math.min(Math.max(margin, desiredY), maxY);
      panel.style.left = `${clampedX}px`;
      panel.style.top = `${clampedY}px`;
    });
  },
  closeStarlinkPanel() {
    const panel = this.shadowRoot?.getElementById("starlink-panel");
    const frame = this.shadowRoot?.getElementById("starlink-frame");
    if (!panel || !frame) return;
    panel.classList.add("is-hidden");
    frame.removeAttribute("src");
  },
  handleStarlinkClick(detail = {}) {
    this.openStarlinkPanel(detail);
  }
};
