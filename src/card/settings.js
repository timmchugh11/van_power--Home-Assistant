// Derived settings from the card config (performance, location, scene options, display scales).
// Mixed into VanPowerCard.prototype; methods run with `this` = the card.
export const settingsMethods = {
  isLowPowerModeEnabled(config = this._config) {
    const setting = config.low_power_mode;
    if (setting === false || setting === "false") return false;
    if (setting === true || setting === "true") return true;
    return /Android/i.test(typeof navigator !== "undefined" ? navigator.userAgent || "" : "");
  },
  getConfiguredMaxPixelRatio(config = this._config) {
    const fallback = this.isLowPowerModeEnabled(config) ? 1 : 1.5;
    const raw = config.max_pixel_ratio;
    const parsed = raw != null ? Number(raw) : NaN;
    return Math.max(0.5, Math.min(2, Number.isFinite(parsed) && parsed > 0 ? parsed : fallback));
  },
  getConfiguredFpsLimit(config = this._config) {
    const fallback = this.isLowPowerModeEnabled(config) ? 15 : 30;
    const parsed = Number(config.fps_limit);
    return Math.max(1, Math.min(60, Number.isFinite(parsed) && parsed > 0 ? parsed : fallback));
  },
  performanceSceneConfigChanged(previousConfig, nextConfig) {
    if (!previousConfig) return false;
    return this.isLowPowerModeEnabled(previousConfig) !== this.isLowPowerModeEnabled(nextConfig) || this.getConfiguredMaxPixelRatio(previousConfig) !== this.getConfiguredMaxPixelRatio(nextConfig) || this.getConfiguredFpsLimit(previousConfig) !== this.getConfiguredFpsLimit(nextConfig);
  },
  getConfiguredLatitude() {
    const fromLocationAttribute = this.parseEntityAttributeNumber(
      this._config.location_entity,
      this._config.latitude_attribute || "latitude"
    );
    if (Number.isFinite(fromLocationAttribute)) return fromLocationAttribute;
    const fromEntity = this.parseStateNumber(this._config.latitude_entity);
    if (Number.isFinite(fromEntity)) return fromEntity;
    const fromConfig = this.parseConfiguredNumber(this._config.latitude);
    if (Number.isFinite(fromConfig)) return fromConfig;
    const hassLatitude = Number(this._hass?.config?.latitude);
    return Number.isFinite(hassLatitude) ? hassLatitude : null;
  },
  getConfiguredLongitude() {
    const fromLocationAttribute = this.parseEntityAttributeNumber(
      this._config.location_entity,
      this._config.longitude_attribute || "longitude"
    );
    if (Number.isFinite(fromLocationAttribute)) return fromLocationAttribute;
    const fromEntity = this.parseStateNumber(this._config.longitude_entity);
    if (Number.isFinite(fromEntity)) return fromEntity;
    const fromConfig = this.parseConfiguredNumber(this._config.longitude);
    if (Number.isFinite(fromConfig)) return fromConfig;
    const hassLongitude = Number(this._hass?.config?.longitude);
    return Number.isFinite(hassLongitude) ? hassLongitude : null;
  },
  shouldResetViewOnReload() {
    return this._config.reset_view_on_reload === true || this._config.reset_view_on_reload === "true";
  },
  getConfiguredSpinEnabled() {
    if (this.isLowPowerModeEnabled() && !Object.prototype.hasOwnProperty.call(this._rawConfig || {}, "spin_enabled")) {
      return false;
    }
    return this._config.spin_enabled !== false && this._config.spin_enabled !== "false";
  },
  getConfiguredDaySimulationProgress() {
    const raw = this._config.debug_time_of_day;
    if (raw == null || raw === "") return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Math.min(1, parsed));
  },
  applySceneControlConfig() {
    this._spinEnabled = this.getConfiguredSpinEnabled();
    this._scene?.setSpinEnabled?.(this._spinEnabled);
    const configuredProgress = this.getConfiguredDaySimulationProgress();
    const progress = Number.isFinite(this._debugDayTimeOverride) ? this._debugDayTimeOverride : configuredProgress;
    this._sunSimulationProgress = this._scene?.setSunSimulationProgress?.(progress) ?? progress;
  },
  useFloatingMetrics() {
    return this._config.show_floating_metrics === true || this._config.show_floating_metrics === "true";
  },
  useCompass() {
    return this._config.show_compass !== false && this._config.show_compass !== "false";
  },
  useClouds() {
    return this._config.show_clouds !== false && this._config.show_clouds !== "false";
  },
  normalizeLightingStyle(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "spotlight" || normalized === "model") return "spotlight";
    return "studio";
  },
  getDisplayScaleValue(raw, fallback = 1) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0.5, Math.min(2.5, parsed));
  },
  applyDisplayScales() {
    const dateTimeOverlay = this.shadowRoot?.querySelector(".date-time-overlay");
    const metricPanel = this.shadowRoot?.querySelector(".metric-panel");
    const weatherPanel = this.shadowRoot?.querySelector(".weather-panel");
    const dateTimeScale = this.getDisplayScaleValue(this._config.date_time_scale, 1);
    const metricsScale = this.getDisplayScaleValue(this._config.metrics_scale, 1);
    const weatherScale = this.getDisplayScaleValue(this._config.weather_scale, 1);
    if (dateTimeOverlay) {
      dateTimeOverlay.style.transformOrigin = "top left";
      dateTimeOverlay.style.transform = `scale(${dateTimeScale})`;
    }
    if (metricPanel) {
      metricPanel.style.transformOrigin = "bottom left";
      metricPanel.style.transform = `scale(${metricsScale})`;
    }
    if (weatherPanel) {
      weatherPanel.style.transformOrigin = "bottom right";
      weatherPanel.style.transform = `scale(${weatherScale})`;
    }
  }
};
