import { cToTemperature, degToCompass, kmToDistance, mmToPrecip, msToSpeed } from "./weather-inputs.js";

// Debug panel: override the weather inputs (wind, visibility, rain, ...) and the
// simulated ground state to preview the weather effects. Opened by long-pressing
// the weather panel, or always shown with `show_debug_controls: true`.
// Mixed into VanPowerCard.prototype; methods run with `this` = the card.

const LONG_PRESS_MS = 700;
const VISIBILITY_MIN_KM = 0.1;
const VISIBILITY_RANGE = 300; // slider spans 0.1 km .. 30 km on a log scale

const round = (value, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

// key: name in the card's debug overrides (weather input or surface override).
const WEATHER_DEBUG_CONTROLS = [
  { key: "windSpeedMs", label: "Wind", min: 0, max: 30, step: 0.1, kind: "speed" },
  { key: "windGustMs", label: "Gusts", min: 0, max: 40, step: 0.1, kind: "speed" },
  { key: "windBearingDeg", label: "Wind from", min: 0, max: 359, step: 1, kind: "bearing" },
  { key: "cloudCoverage", label: "Cloud cover", min: 0, max: 100, step: 1, kind: "percent" },
  {
    key: "visibilityKm", label: "Visibility", min: 0, max: 1, step: 0.005, kind: "distance",
    toSlider: (km) => Math.log(Math.max(km, VISIBILITY_MIN_KM) / VISIBILITY_MIN_KM) / Math.log(VISIBILITY_RANGE),
    fromSlider: (t) => VISIBILITY_MIN_KM * VISIBILITY_RANGE ** t
  },
  { key: "humidity", label: "Humidity", min: 0, max: 100, step: 1, kind: "percent" },
  { key: "temperatureC", label: "Temperature", min: -15, max: 35, step: 0.5, kind: "temperature" },
  { key: "precipMmPerHour", label: "Rain mm/h", min: 0, max: 20, step: 0.1, kind: "precip" },
  { key: "surfaceWetness", label: "Ground wet", min: 0, max: 1, step: 0.01, kind: "fraction", surface: "wetness" },
  { key: "surfaceSnow", label: "Snow cover", min: 0, max: 1, step: 0.01, kind: "fraction", surface: "snowCover" }
];

export const weatherDebugMethods = {
  isDebugPanelOpen() {
    if (typeof this._debugPanelOpen === "boolean") return this._debugPanelOpen;
    return this._config.show_debug_controls === true || this._config.show_debug_controls === "true";
  },
  setDebugPanelOpen(open) {
    this._debugPanelOpen = Boolean(open);
    this.applyDebugPanelVisibility();
  },
  applyDebugPanelVisibility() {
    const panel = this.shadowRoot?.getElementById("scene-debug-controls");
    if (!panel) return;
    const open = this.isDebugPanelOpen();
    panel.classList.toggle("is-open", open);
    if (open) {
      this.updateWeatherDebugPanel();
      this.updateDebugTimeMeta();
    }
  },
  // Long-press on the weather panel toggles the debug panel; a normal tap still opens more-info.
  attachWeatherLongPress() {
    const panel = this.shadowRoot?.getElementById("weather-panel");
    if (!panel) return;
    const cancel = () => {
      clearTimeout(this._weatherLongPressTimer);
      this._weatherLongPressTimer = null;
    };
    panel.addEventListener("pointerdown", () => {
      cancel();
      this._weatherLongPressTimer = setTimeout(() => {
        this._weatherLongPressTimer = null;
        this._suppressWeatherClick = true;
        setTimeout(() => { this._suppressWeatherClick = false; }, 1e3);
        this.setDebugPanelOpen(!this.isDebugPanelOpen());
      }, LONG_PRESS_MS);
    });
    for (const type of ["pointerup", "pointercancel", "pointerleave"]) panel.addEventListener(type, cancel);
  },
  buildWeatherDebugRows() {
    const container = this.shadowRoot?.getElementById("debug-weather-rows");
    if (!container) return;
    const rows = WEATHER_DEBUG_CONTROLS.map((control) => {
      const row = document.createElement("div");
      row.className = "debug-row";
      const id = `debug-${control.key}`;
      const label = document.createElement("label");
      label.htmlFor = id;
      label.textContent = control.label;
      const slider = document.createElement("input");
      slider.type = "range";
      slider.id = id;
      slider.min = String(control.min);
      slider.max = String(control.max);
      slider.step = String(control.step);
      slider.addEventListener("input", () => {
        const raw = Number(slider.value);
        this.getDebugWeatherInputs()[control.key] = control.fromSlider ? control.fromSlider(raw) : raw;
        this.handleWeatherDebugChange();
      });
      const value = document.createElement("button");
      value.type = "button";
      value.className = "debug-value";
      value.id = `${id}-value`;
      value.title = "Tap to return to auto";
      value.addEventListener("click", () => {
        delete this.getDebugWeatherInputs()[control.key];
        this.handleWeatherDebugChange();
      });
      row.append(label, slider, value);
      return row;
    });
    container.replaceChildren(...rows);
  },
  // Wires the static debug controls (header buttons, day-time reset).
  attachDebugPanelControls() {
    const root = this.shadowRoot;
    const panel = root?.getElementById("scene-debug-controls");
    if (!panel) return;
    // Keep debug interaction from reaching the card's own click handlers.
    panel.addEventListener("click", (event) => event.stopPropagation());
    root.getElementById("debug-close")?.addEventListener("click", () => this.setDebugPanelOpen(false));
    root.getElementById("debug-reset")?.addEventListener("click", () => this.resetDebugOverrides());
    root.getElementById("debug-daytime-value")?.addEventListener("click", () => this.resetDebugDayTime());
  },
  resetDebugDayTime() {
    this._debugDayTimeOverride = null;
    this.applySceneControlConfig();
    this.updateDaySimulationControl();
  },
  resetDebugOverrides() {
    this._debugWeatherInputs = {};
    this._debugWeatherOverride = "";
    this.syncDebugWeatherSelect();
    this.resetDebugDayTime();
    this.updateWeatherDisplay();
  },
  handleWeatherDebugChange() {
    this.applyWeatherInputs();
    this.updateWeatherDebugPanel();
  },
  formatWeatherDebugValue(control, value, units) {
    if (value == null || !Number.isFinite(value)) return "";
    switch (control.kind) {
      case "speed": return `${round(msToSpeed(value, units.speed), 1)} ${units.speed}`;
      case "distance": {
        const distance = kmToDistance(value, units.distance);
        return `${round(distance, distance < 1 ? 2 : distance < 10 ? 1 : 0)} ${units.distance}`;
      }
      case "temperature": return `${round(cToTemperature(value, units.temperature), 1)}${units.temperature}`;
      case "precip": return `${round(mmToPrecip(value, units.precipitation), 1)} ${units.precipitation}/h`;
      case "percent": return `${round(value)}%`;
      case "bearing": return `${round(value)}° ${degToCompass(value)}`;
      case "fraction": return `${round(value * 100)}%`;
      default: return String(round(value, 2));
    }
  },
  // Refreshes slider positions, value labels and the derived-state readout.
  updateWeatherDebugPanel() {
    if (!this.isDebugPanelOpen()) return;
    const root = this.shadowRoot;
    if (!root?.getElementById("debug-weather-rows")?.childElementCount) return;
    const overrides = this.getDebugWeatherInputs();
    const measured = this.getMeasuredWeatherInputs();
    const sceneState = this._scene?.getWeatherDebugState?.() || null;
    const units = this.getWeatherUnits();
    for (const control of WEATHER_DEBUG_CONTROLS) {
      const slider = root.getElementById(`debug-${control.key}`);
      const valueNode = root.getElementById(`debug-${control.key}-value`);
      if (!slider || !valueNode) continue;
      const override = overrides[control.key];
      const autoValue = control.surface ? sceneState?.[control.surface] ?? null : measured[control.key];
      const isOverride = override != null;
      const shown = isOverride ? override : autoValue;
      if (shown != null && Number.isFinite(shown) && root.activeElement !== slider) {
        slider.value = String(control.toSlider ? control.toSlider(shown) : shown);
      }
      const text = this.formatWeatherDebugValue(control, shown, units);
      valueNode.textContent = isOverride ? text : text ? `AUTO · ${text}` : "AUTO";
      valueNode.classList.toggle("is-override", isOverride);
    }
    const meta = root.getElementById("debug-weather-meta");
    if (meta && sceneState) {
      const f = (value, digits = 2) => (Number.isFinite(value) ? value.toFixed(digits) : "-");
      meta.textContent = `SCENE ${sceneState.condition} | WIND ${f(sceneState.wind)} | CLOUD ${f(sceneState.cloud)} | FOG ${f(sceneState.fog, 4)}\n` +
        `RAIN ${f(sceneState.precipRate)} | WET ${f(sceneState.wetness)} | SNOW ${f(sceneState.snowCover)} | FROST ${f(sceneState.frost)} | CLOUD DRIFT ${f(sceneState.cloudMotionSpeed, 2)} u/s | FORECAST ${(this._hourlyForecast || []).length}h`;
    }
  }
};
