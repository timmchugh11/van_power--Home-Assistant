// Weather panel, weather-driven sky colours and the weather debug override.
// Mixed into VanPowerCard.prototype; methods run with `this` = the card.
export const weatherMethods = {
  getWeatherRawIcon() {
    const debugOverride = this.getDebugWeatherOverride();
    if (debugOverride) return debugOverride;
    const weatherEntityId = String(this._config.weather_entity || "").trim();
    if (!weatherEntityId) return "";
    const weatherState = this.lookup(weatherEntityId);
    if (!weatherState) return "";
    const attrIcon = String(weatherState.attributes?.icon || "").trim();
    if (attrIcon && attrIcon !== "unknown" && attrIcon !== "unavailable") {
      return attrIcon;
    }
    const stateText = String(weatherState.state || "").trim();
    if (!stateText || stateText === "unknown" || stateText === "unavailable") return "";
    return stateText;
  },
  getDebugWeatherOverride() {
    return String(this._debugWeatherOverride || "").trim().toLowerCase();
  },
  handleDebugWeatherSelectChange(event) {
    const selected = String(event?.target?.value || "").trim().toLowerCase();
    this._debugWeatherOverride = selected;
    this.updateWeatherDisplay();
  },
  syncDebugWeatherSelect() {
    const select = this.shadowRoot?.getElementById("debug-weather-select");
    if (!select) return;
    select.value = this.getDebugWeatherOverride();
  },
  resolveWeatherVisual(rawIcon) {
    const rawText = String(rawIcon || "").trim().toLowerCase();
    if (!rawText) return null;
    let normalized = rawText.startsWith("mdi:weather-") ? rawText.slice("mdi:weather-".length) : rawText;
    normalized = normalized.replace(/_/g, "-");
    const alias = {
      "clear-day": "sunny",
      "partly-cloudy-day": "partlycloudy",
      "partly-cloudy-night": "partlycloudy",
      "partly-cloudy": "partlycloudy",
      rain: "rainy",
      snow: "snowy",
      sleet: "snowy-rainy",
      wind: "windy"
    };
    normalized = alias[normalized] || normalized;
    const map = {
      "clear-night": { key: "clear-night", condition: "clear-night", label: "Clear Night", variant: "night" },
      "sunny": { key: "sunny", condition: "sunny", label: "Sunny", variant: "day" },
      "partlycloudy": { key: "partlycloudy", condition: "partlycloudy", label: "Partly Cloudy", variant: null },
      "cloudy": { key: "cloudy", condition: "cloudy", label: "Cloudy", variant: null },
      "fog": { key: "fog", condition: "fog", label: "Fog", variant: null },
      "rainy": { key: "rainy", condition: "rainy", label: "Rain", variant: null },
      "pouring": { key: "rainy", condition: "pouring", label: "Pouring", variant: null },
      "snowy": { key: "snowy", condition: "snowy", label: "Snow", variant: null },
      "snowy-rainy": { key: "snowyrainy", condition: "snowy-rainy", label: "Snow/Rain", variant: null },
      "hail": { key: "hail", condition: "hail", label: "Hail", variant: null },
      "lightning": { key: "lightning", condition: "lightning", label: "Lightning", variant: null },
      "lightning-rainy": { key: "lightningrain", condition: "lightning-rainy", label: "Lightning Rain", variant: null },
      "windy": { key: "windy", condition: "windy", label: "Windy", variant: null },
      "windy-variant": { key: "windyvariant", condition: "windy-variant", label: "Windy Cloudy", variant: null },
      "exceptional": { key: "exceptional", condition: "exceptional", label: "Exceptional", variant: null }
    };
    const base = map[normalized];
    if (!base) return null;
    return {
      ...base,
      candidates: [base.key]
    };
  },
  getDayWeatherGrayness(conditionRaw) {
    const condition = String(conditionRaw || "").trim().toLowerCase();
    const map = {
      sunny: 0,
      "clear-night": 0,
      partlycloudy: 0.25,
      cloudy: 0.62,
      fog: 0.68,
      rainy: 0.94,
      pouring: 1,
      snowy: 0.74,
      "snowy-rainy": 0.96,
      hail: 0.97,
      lightning: 0.86,
      "lightning-rainy": 1,
      windy: 0.34,
      "windy-variant": 0.7,
      exceptional: 1
    };
    return Math.max(0, Math.min(1, map[condition] ?? 0.2));
  },
  applyDayWeatherBackground(conditionRaw) {
    const card = this.shadowRoot?.getElementById("dynamic-card");
    const stage = this.shadowRoot?.querySelector(".stage");
    if (!card || !stage) return;
    const grayness = this.getDayWeatherGrayness(conditionRaw);
    const gloom = Math.max(0, Math.min(1, (grayness - 0.72) / 0.28));
    const gloomDarken = 1 - gloom * 0.22;
    const mixChannel = (a, b, t) => Math.round(a + (b - a) * t);
    const cardTop = [
      mixChannel(181, 152, grayness),
      mixChannel(205, 156, grayness),
      mixChannel(228, 161, grayness)
    ];
    const cardMid = [
      mixChannel(106, 112, grayness),
      mixChannel(135, 117, grayness),
      mixChannel(164, 122, grayness)
    ];
    const cardBot = [
      mixChannel(42, 60, grayness),
      mixChannel(59, 64, grayness),
      mixChannel(77, 69, grayness)
    ];
    const stageTop = [
      mixChannel(151, 164, grayness),
      mixChannel(192, 170, grayness),
      mixChannel(236, 176, grayness)
    ];
    const stageMid = [
      mixChannel(73, 103, grayness),
      mixChannel(111, 109, grayness),
      mixChannel(156, 115, grayness)
    ];
    const stageLow = [
      mixChannel(16, 54, grayness),
      mixChannel(30, 58, grayness),
      mixChannel(48, 64, grayness)
    ];
    const darkenTriplet = (triplet, mul) => triplet.map((value) => Math.max(0, Math.min(255, Math.round(value * mul))));
    const cardTopDark = darkenTriplet(cardTop, gloomDarken * 0.96);
    const cardMidDark = darkenTriplet(cardMid, gloomDarken * 0.9);
    const cardBotDark = darkenTriplet(cardBot, gloomDarken * 0.84);
    const stageTopDark = darkenTriplet(stageTop, gloomDarken * 0.94);
    const stageMidDark = darkenTriplet(stageMid, gloomDarken * 0.88);
    const stageLowDark = darkenTriplet(stageLow, gloomDarken * 0.82);
    stage.style.setProperty("--day-stage-top", `rgba(${stageTopDark[0]}, ${stageTopDark[1]}, ${stageTopDark[2]}, ${(0.28 + gloom * 0.06).toFixed(3)})`);
    stage.style.setProperty("--day-stage-mid", `rgba(${stageMidDark[0]}, ${stageMidDark[1]}, ${stageMidDark[2]}, ${(0.18 + gloom * 0.08).toFixed(3)})`);
    stage.style.setProperty("--day-stage-low", `rgba(${stageLowDark[0]}, ${stageLowDark[1]}, ${stageLowDark[2]}, ${(0.08 + gloom * 0.1).toFixed(3)})`);
    card.style.setProperty("--day-card-top", `rgb(${cardTopDark[0]}, ${cardTopDark[1]}, ${cardTopDark[2]})`);
    card.style.setProperty("--day-card-mid", `rgb(${cardMidDark[0]}, ${cardMidDark[1]}, ${cardMidDark[2]})`);
    card.style.setProperty("--day-card-bottom", `rgb(${cardBotDark[0]}, ${cardBotDark[1]}, ${cardBotDark[2]})`);
  },
  getWeatherTemperatureText() {
    const weatherEntityId = String(this._config.weather_entity || "").trim();
    if (!weatherEntityId) return "";
    const weatherState = this.lookup(weatherEntityId);
    if (!weatherState) return "";
    const tempValue = Number(weatherState.attributes?.temperature);
    if (!Number.isFinite(tempValue)) return "";
    const unit = String(weatherState.attributes?.temperature_unit || weatherState.attributes?.unit_of_measurement || "°").trim();
    const rounded = Math.round(tempValue);
    return `${rounded}${unit}`;
  },
  getInsideTemperatureText() {
    const entityId = String(this._config.inside_temp_entity || "").trim();
    if (!entityId) return "";
    const state = this.lookup(entityId);
    if (!state) return "";
    const raw = String(state.state ?? "").trim();
    if (!raw || raw === "unknown" || raw === "unavailable") return "\u2014";
    const unit = String(state.attributes?.unit_of_measurement || "").trim();
    return `${raw}${unit}`;
  },
  handleWeatherClick() {
    if (this._suppressWeatherClick) {
      // The click that ends a long-press (which toggles the debug panel).
      this._suppressWeatherClick = false;
      return;
    }
    const entityId = String(this._config.weather_entity || "").trim();
    if (!entityId) return;
    this.openMoreInfo(entityId);
  },
  updateWeatherDisplay() {
    const panel = this.shadowRoot?.getElementById("weather-panel");
    const textNode = this.shadowRoot?.getElementById("weather-label");
    const insideTextNode = this.shadowRoot?.getElementById("weather-inside-label");
    if (!panel || !textNode || !insideTextNode) return;
    const rawIcon = this.getWeatherRawIcon();
    const visual = this.resolveWeatherVisual(rawIcon);
    this._scene?.setWeatherState?.(visual?.condition || rawIcon || "sunny");
    this.ensureForecastSubscription();
    this.applyWeatherInputs();
    this.updateForecastDisplay();
    this.updateWeatherDebugPanel();
    this.applyDayWeatherBackground(visual?.condition || rawIcon || "sunny");
    if (!visual) {
      panel.classList.add("is-hidden");
      panel.classList.remove("is-night");
      textNode.textContent = "";
      insideTextNode.textContent = "";
      insideTextNode.classList.add("is-hidden");
      return;
    }
    panel.classList.remove("is-hidden");
    panel.classList.toggle("is-night", visual.variant === "night");
    const temperatureText = this.getWeatherTemperatureText();
    textNode.textContent = `${visual.label}${temperatureText ? ` | ${temperatureText}` : ""}`;
    const insideTemperatureText = this.getInsideTemperatureText();
    if (insideTemperatureText) {
      insideTextNode.textContent = `INSIDE | ${insideTemperatureText}`;
      insideTextNode.classList.remove("is-hidden");
    } else {
      insideTextNode.textContent = "";
      insideTextNode.classList.add("is-hidden");
    }
  },
  showForecast() {
    return this._config.show_forecast !== false && this._config.show_forecast !== "false";
  },
  getForecastHourCount() {
    const count = Math.round(Number(this._config.forecast_hours));
    return Number.isFinite(count) && count > 0 ? Math.min(count, 12) : 5;
  },
  getForecastIcon(condition, isDaytime) {
    const night = isDaytime === false;
    const icons = {
      "clear-night": "mdi:weather-night",
      sunny: night ? "mdi:weather-night" : "mdi:weather-sunny",
      partlycloudy: night ? "mdi:weather-night-partly-cloudy" : "mdi:weather-partly-cloudy",
      cloudy: "mdi:weather-cloudy",
      fog: "mdi:weather-fog",
      rainy: "mdi:weather-rainy",
      pouring: "mdi:weather-pouring",
      snowy: "mdi:weather-snowy",
      "snowy-rainy": "mdi:weather-snowy-rainy",
      hail: "mdi:weather-hail",
      lightning: "mdi:weather-lightning",
      "lightning-rainy": "mdi:weather-lightning-rainy",
      windy: "mdi:weather-windy",
      "windy-variant": "mdi:weather-windy-variant",
      exceptional: "mdi:alert-circle-outline"
    };
    return icons[String(condition || "").toLowerCase()] || "mdi:weather-cloudy";
  },
  // Next few hours from the hourly forecast, shown above the weather label.
  updateForecastDisplay() {
    const container = this.shadowRoot?.getElementById("weather-forecast");
    if (!container) return;
    const now = Date.now();
    const hours = this.showForecast() ? this.getHourlyForecast().filter((entry) => entry.timeMs > now).slice(0, this.getForecastHourCount()) : [];
    container.classList.toggle("is-hidden", hours.length === 0);
    const signature = JSON.stringify(hours.map((entry) => [entry.timeMs, entry.condition, entry.temperature, entry.precipitation_probability, entry.is_daytime]));
    if (signature === this._forecastSignature) return;
    this._forecastSignature = signature;
    const make = (className, text) => {
      const node = document.createElement("div");
      node.className = className;
      if (text != null) node.textContent = text;
      return node;
    };
    container.replaceChildren(...hours.map((entry) => {
      const item = make("forecast-hour");
      const icon = document.createElement("ha-icon");
      icon.className = "forecast-icon";
      icon.setAttribute("icon", this.getForecastIcon(entry.condition, entry.is_daytime));
      const temperature = Number(entry.temperature);
      const probability = Number(entry.precipitation_probability);
      const rain = make("forecast-rain", Number.isFinite(probability) && probability >= 10 ? `${Math.round(probability)}%` : "");
      item.append(
        make("forecast-time", this.formatClockTime(entry.timeMs)),
        icon,
        make("forecast-temp", Number.isFinite(temperature) ? `${Math.round(temperature)}°` : "--"),
        rain
      );
      return item;
    }));
  }
};
