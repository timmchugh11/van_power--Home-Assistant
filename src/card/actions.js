// Click handling: more-info dialogs, navigation and 3D hotspot actions.
// Mixed into VanPowerCard.prototype; methods run with `this` = the card.
export const actionMethods = {
  openMoreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      bubbles: true,
      composed: true,
      detail: { entityId }
    }));
  },
  getHomepageUrl() {
    const raw = String(this._config.homepage_url || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;
    if (/^www\./i.test(raw)) return `https://${raw}`;
    return raw;
  },
  navigateTo(path) {
    if (!path) return;
    if (this._hass?.navigate) {
      this._hass.navigate(path);
      return;
    }
    window.history.pushState(null, "", path);
    window.dispatchEvent(new Event("location-changed"));
  },
  openHomepageUrl() {
    this.restoreFullscreenMode();
    const url = this.getHomepageUrl();
    if (!url) return;
    if (url.startsWith("/")) {
      this.navigateTo(url);
      return;
    }
    if (/^https?:\/\//i.test(url)) {
      try {
        const parsed = new URL(url);
        if (parsed.origin === window.location.origin) {
          this.navigateTo(`${parsed.pathname}${parsed.search}${parsed.hash}`);
          return;
        }
      } catch {
      }
    }
    window.location.assign(url);
  },
  getModelLightEntityId(index) {
    if (index === 0) return this._config.model_light_1_entity || "";
    if (index === 1) return this._config.model_light_2_entity || "";
    return "";
  },
  getCameraEntityId(index) {
    if (index === 0) return this._config.camera_left_entity || "";
    if (index === 1) return this._config.camera_right_entity || "";
    return "";
  },
  getGrillEntityId(index) {
    if (index === 0) return this._config.upper_grill || "";
    if (index === 1) return this._config.lower_grill || "";
    return "";
  },
  handleGrillClick(index) {
    const entityId = this.getGrillEntityId(index);
    if (!entityId) return;
    this.openMoreInfo(entityId);
  },
  handleCameraClick(index) {
    const entityId = this.getCameraEntityId(index);
    if (!entityId) return;
    this.openMoreInfo(entityId);
  },
  async handleModelLightClick(index, detail = {}) {
    const entityId = this.getModelLightEntityId(index);
    if (!entityId) return;
    const isLongPress = detail?.longPress === true;
    if (isLongPress) {
      this.openMoreInfo(entityId);
      return;
    }
    const domain = entityId.split(".")[0];
    if (domain === "light" && this._hass?.callService) {
      try {
        await this._hass.callService("light", "toggle", { entity_id: entityId });
      } catch (error22) {
        console.error("Failed to toggle light from model click", error22);
      }
    }
  }
};
