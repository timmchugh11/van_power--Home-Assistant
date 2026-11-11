// Sun times, clock/date display and the day-simulation debug controls.
// Mixed into VanPowerCard.prototype; methods run with `this` = the card.
export const clockMethods = {
  parseSunTime(entityId, preferredAttribute = "") {
    if (!entityId) return null;
    const state = this.lookup(entityId);
    if (!state) return null;
    const attributeName = String(preferredAttribute || "").trim();
    if (attributeName) {
      const attrValue = state.attributes?.[attributeName];
      if (typeof attrValue === "string" && attrValue.trim()) {
        const parsedAttrDate = new Date(attrValue.trim());
        if (!Number.isNaN(parsedAttrDate.getTime())) {
          return parsedAttrDate.getTime();
        }
      }
    }
    const raw = String(state.state || "").trim();
    if (!raw || raw === "unknown" || raw === "unavailable") return null;
    const parsedDate = new Date(raw);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.getTime();
    }
    const hhmmss = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!hhmmss) return null;
    const now = new Date();
    const hour = Math.max(0, Math.min(23, Number(hhmmss[1]) || 0));
    const minute = Math.max(0, Math.min(59, Number(hhmmss[2]) || 0));
    const second = Math.max(0, Math.min(59, Number(hhmmss[3]) || 0));
    const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, second, 0);
    return dt.getTime();
  },
  getSunTimes() {
    const sunEntity = String(this._config.sun_entity || "").trim();
    if (!sunEntity) {
      return null;
    }
    let sunriseMs = this.parseSunTime(sunEntity, "next_dawn");
    let sunsetMs = this.parseSunTime(sunEntity, "next_dusk");
    if (!Number.isFinite(sunriseMs) || !Number.isFinite(sunsetMs)) {
      return null;
    }
    if (sunriseMs > sunsetMs) {
      sunriseMs -= 864e5;
    }
    if (sunsetMs <= sunriseMs) {
      sunsetMs += 864e5;
    }
    return { sunriseMs, sunsetMs };
  },
  handleDebugDayTimeInput(event) {
    const raw = Number(event?.target?.value);
    const value = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : null;
    this._debugDayTimeOverride = value;
    this._sunSimulationProgress = this._scene?.setSunSimulationProgress?.(value) ?? value;
    this.updateDebugDayTimeDisplay(value);
    this.updateDaySimulationControl();
  },
  updateDebugDayTimeDisplay(progress) {
    const slider = this.shadowRoot?.getElementById("debug-daytime-slider");
    const valueNode = this.shadowRoot?.getElementById("debug-daytime-value");
    if (slider && Number.isFinite(progress)) {
      slider.value = String(Math.max(0, Math.min(1, progress)));
    }
    if (valueNode) {
      if (!Number.isFinite(progress)) {
        valueNode.textContent = "AUTO";
      } else {
        const normalized = Math.max(0, Math.min(1, progress));
        const simulatedMs = this.getSimulatedTimestamp(normalized);
        const simulatedText = Number.isFinite(simulatedMs) ? this.formatClockTime(simulatedMs) : "--:--";
        valueNode.textContent = `${(normalized * 100).toFixed(1)}% ${simulatedText}`;
      }
    }
  },
  formatClockTime(ms) {
    if (!Number.isFinite(ms)) return "--:--";
    return new Date(ms).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  },
  getSimulatedTimestamp(progress) {
    if (!Number.isFinite(progress)) return null;
    const lat = this.getConfiguredLatitude();
    const lon = this.getConfiguredLongitude();
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return startOfDay + progress * 864e5;
    }
    const sunTimes = this.getSunTimes();
    if (sunTimes && Number.isFinite(sunTimes.sunriseMs) && Number.isFinite(sunTimes.sunsetMs) && sunTimes.sunsetMs > sunTimes.sunriseMs) {
      const daySpan = sunTimes.sunsetMs - sunTimes.sunriseMs;
      return sunTimes.sunriseMs + progress * daySpan;
    }
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return startOfDay + progress * 864e5;
  },
  updateDaySimulationControl() {
    const sceneProgress = this._scene?.getSunSimulationProgress?.();
    const activeProgress = Number.isFinite(sceneProgress) ? sceneProgress : this._scene?.getCurrentDayProgress?.();
    const progress = Math.max(0, Math.min(1, Number.isFinite(activeProgress) ? activeProgress : 0));
    this._sunSimulationProgress = Number.isFinite(sceneProgress) ? progress : null;
    this.updateDebugDayTimeDisplay(Number.isFinite(this._sunSimulationProgress) ? this._sunSimulationProgress : progress);
    this.updateDebugTimeMeta();
    this.updateMoonDisplay();
  },
  updateDebugTimeMeta() {
    const node = this.shadowRoot?.getElementById("debug-time-meta");
    if (!node) return;
    const debug = this._scene?.getSunDebugState?.(Date.now());
    if (!debug) {
      node.textContent = "";
      return;
    }
    const mode = Number.isFinite(debug.sunSimulationProgress) ? "SIM" : "REALTIME";
    const effectiveLocal = Number.isFinite(debug.effectiveNowMs) ? this.formatClockTime(debug.effectiveNowMs) : "--:--";
    const realLocal = this.formatClockTime(Date.now());
    const elev = Number.isFinite(debug.currentSunElevationDeg) ? debug.currentSunElevationDeg.toFixed(2) : "n/a";
    const nightTimes = debug.nightFromSunTimes == null ? "n/a" : debug.nightFromSunTimes ? "yes" : "no";
    const sprite = debug.sunSpriteVisible ? "on" : "off";
    node.textContent = `MODE ${mode} | REAL ${realLocal} | EFF ${effectiveLocal}\nELEV ${elev}° | NIGHT_BY_TIMES ${nightTimes} | SUN ${sprite}`;
  },
  updateDateTimeDisplay() {
    const timeNode = this.shadowRoot?.getElementById("clock-time");
    const dateNode = this.shadowRoot?.getElementById("clock-date");
    if (!timeNode || !dateNode) return;
    const now = new Date();
    timeNode.textContent = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    dateNode.textContent = now.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
  },
  startDateTimeTimer() {
    if (this._dateTimeTimer) {
      clearInterval(this._dateTimeTimer);
    }
    this.updateDateTimeDisplay();
    this.updateMoonDisplay();
    this.updateDebugTimeMeta();
    this._dateTimeTimer = setInterval(() => {
      this.updateDateTimeDisplay();
      this.updateMoonDisplay();
      this.updateDebugTimeMeta();
      this.updateWeatherDebugPanel();
    }, 1e3);
  }
};
