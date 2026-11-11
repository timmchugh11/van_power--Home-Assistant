// Moon phase / water-heater panel and moon lighting.
// Mixed into VanPowerCard.prototype; methods run with `this` = the card.
export const moonPanelMethods = {
  getMoonPhaseLabel() {
    const phase = this.getMoonPhaseState();
    if (!phase) return "";
    const map = {
      new_moon: "New Moon",
      waxing_crescent: "Waxing Crescent",
      first_quarter: "First Quarter",
      waxing_gibbous: "Waxing Gibbous",
      full_moon: "Full Moon",
      waning_gibbous: "Waning Gibbous",
      last_quarter: "Last Quarter",
      waning_crescent: "Waning Crescent"
    };
    if (map[phase]) return map[phase];
    return phase.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()).trim();
  },
  updateMoonDisplay() {
    const panel = this.shadowRoot?.getElementById("moon-panel");
    const labelNode = this.shadowRoot?.getElementById("moon-label");
    const waterTemperatureNode = this.shadowRoot?.getElementById("water-heater-temperature");
    const waterTargetNode = this.shadowRoot?.getElementById("water-heater-target");
    const isNight = this._scene?.isNight?.() ?? this._scene?.isNightMode?.() ?? false;
    const moonPhase = this.getMoonPhaseState();
    const moonLabel = moonPhase ? this.getMoonPhaseLabel() : "";
    const waterHeater = this.getWaterHeaterDisplay();
    const card = this.shadowRoot?.getElementById("dynamic-card");
    const stage = this.shadowRoot?.querySelector(".stage");
    card?.classList.toggle("is-night", isNight);
    stage?.classList.toggle("is-night", isNight);
    const rawIcon = this.getWeatherRawIcon();
    this.applyDayWeatherBackground(this.resolveWeatherVisual(rawIcon)?.condition || rawIcon || "sunny");
    if (!panel) return;
    panel.classList.toggle("is-water-heating", waterHeater.isHeating);
    panel.classList.toggle("is-hidden", !waterHeater.isHeating && !(isNight && moonPhase));
    if (labelNode) {
      labelNode.textContent = moonLabel;
    }
    if (waterTemperatureNode) {
      const unitNode = document.createElement("span");
      unitNode.textContent = waterHeater.unit;
      waterTemperatureNode.replaceChildren(waterHeater.currentValue, unitNode);
    }
    if (waterTargetNode) {
      waterTargetNode.textContent = waterHeater.targetText;
    }
  },
  getWaterHeaterDisplay() {
    const entityId = String(this._config.water_heater_entity || "").trim();
    const entity = entityId ? this.lookup(entityId) : null;
    const state = String(entity?.state || entity?.attributes?.operation_mode || "").trim().toLowerCase();
    const isHeating = state === "gas";
    const current = Number(entity?.attributes?.current_temperature);
    const target = Number(entity?.attributes?.temperature);
    const unit = String(this._hass?.config?.unit_system?.temperature || "°C");
    const formatTemperature = (value) => Number.isFinite(value) ? value.toLocaleString([], { maximumFractionDigits: 1 }) : "--";
    return {
      isHeating,
      currentValue: formatTemperature(current),
      unit,
      targetText: Number.isFinite(target) ? `TARGET ${formatTemperature(target)}${unit}` : "WATER HEATING"
    };
  },
  getMoonPhaseState() {
    const moonEntityId = String(this._config.moon_entity || "").trim();
    if (!moonEntityId) return "";
    const moonState = this.lookup(moonEntityId);
    const phase = String(moonState?.state || "").trim().toLowerCase();
    if (!phase || phase === "unknown" || phase === "unavailable") return "";
    return phase;
  },
  getMoonLightAngles() {
    const phase = this.getMoonPhaseState();
    if (!phase) return null;
    const phaseAzimuth = {
      new_moon: 0,
      waxing_crescent: 68,
      first_quarter: 100,
      waxing_gibbous: 132,
      full_moon: 191,
      waning_gibbous: 229,
      last_quarter: 261,
      waning_crescent: 293
    };
    const azimuthDeg = phaseAzimuth[phase];
    if (!Number.isFinite(azimuthDeg)) return null;
    return {
      azimuthDeg,
      elevationDeg: 18
    };
  },
  updateMoonLightFromEntity() {
    const angles = this.getMoonLightAngles();
    if (!angles) return;
    this._moonScene?.setLightFromAzimuthElevation?.(angles.azimuthDeg, angles.elevationDeg);
  }
};
