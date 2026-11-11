// Weather measurements for the 3D scene: reads the weather entity's attributes,
// converts them to SI units, adds rainfall from the hourly forecast, and applies
// any debug-panel overrides. Also owns the hourly forecast subscription.
// Mixed into VanPowerCard.prototype; methods run with `this` = the card.

const SPEED_TO_MS = { "m/s": 1, "km/h": 1 / 3.6, kmh: 1 / 3.6, mph: 0.44704, kn: 0.514444, kt: 0.514444, knots: 0.514444, "ft/s": 0.3048 };
const DISTANCE_TO_KM = { km: 1, mi: 1.609344, m: 0.001, ft: 0.0003048 };
const PRECIP_TO_MM = { mm: 1, in: 25.4, cm: 10 };

const finite = (value) => {
  const number = typeof value === "string" ? Number(value.trim()) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : null;
};
const unitKey = (unit, fallback) => String(unit || fallback).trim().toLowerCase();

const COMPASS_POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

// Wind bearing in degrees from a number or a compass point ("NE", "SSW", ...).
export function bearingToDeg(value) {
  const number = finite(value);
  if (number != null) return ((number % 360) + 360) % 360;
  const index = COMPASS_POINTS.indexOf(String(value || "").trim().toUpperCase());
  return index >= 0 ? index * 22.5 : null;
}
export function degToCompass(deg) {
  return COMPASS_POINTS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

export function speedToMs(value, unit) {
  const factor = SPEED_TO_MS[unitKey(unit, "km/h")];
  return value != null && factor ? value * factor : null;
}
export function msToSpeed(valueMs, unit) {
  const factor = SPEED_TO_MS[unitKey(unit, "km/h")] || 1;
  return valueMs / factor;
}
export function distanceToKm(value, unit) {
  const factor = DISTANCE_TO_KM[unitKey(unit, "km")];
  return value != null && factor ? value * factor : null;
}
export function kmToDistance(valueKm, unit) {
  return valueKm / (DISTANCE_TO_KM[unitKey(unit, "km")] || 1);
}
export function temperatureToC(value, unit) {
  if (value == null) return null;
  const key = unitKey(unit, "°c");
  if (key === "°f" || key === "f") return (value - 32) * 5 / 9;
  if (key === "k") return value - 273.15;
  return value;
}
export function cToTemperature(valueC, unit) {
  const key = unitKey(unit, "°c");
  if (key === "°f" || key === "f") return valueC * 9 / 5 + 32;
  if (key === "k") return valueC + 273.15;
  return valueC;
}
export function precipToMm(value, unit) {
  const factor = PRECIP_TO_MM[unitKey(unit, "mm")];
  return value != null && factor ? value * factor : null;
}
export function mmToPrecip(valueMm, unit) {
  return valueMm / (PRECIP_TO_MM[unitKey(unit, "mm")] || 1);
}

export const weatherInputMethods = {
  getWeatherEntityState() {
    const entityId = String(this._config.weather_entity || "").trim();
    return entityId ? this.lookup(entityId) : null;
  },
  // Display units of the weather entity, used by the debug panel.
  getWeatherUnits() {
    const attrs = this.getWeatherEntityState()?.attributes || {};
    return {
      speed: attrs.wind_speed_unit || "km/h",
      distance: attrs.visibility_unit || "km",
      temperature: attrs.temperature_unit || this._hass?.config?.unit_system?.temperature || "°C",
      precipitation: attrs.precipitation_unit || "mm"
    };
  },
  // Measurements from the weather entity (SI units; null when not reported).
  getMeasuredWeatherInputs() {
    const attrs = this.getWeatherEntityState()?.attributes || {};
    const units = this.getWeatherUnits();
    return {
      windSpeedMs: speedToMs(finite(attrs.wind_speed), units.speed),
      windGustMs: speedToMs(finite(attrs.wind_gust_speed), units.speed),
      visibilityKm: distanceToKm(finite(attrs.visibility), units.distance),
      humidity: finite(attrs.humidity),
      temperatureC: temperatureToC(finite(attrs.temperature), units.temperature),
      precipMmPerHour: this.getCurrentForecastPrecipMm(),
      windBearingDeg: bearingToDeg(attrs.wind_bearing),
      cloudCoverage: finite(attrs.cloud_coverage)
    };
  },
  getDebugWeatherInputs() {
    if (!this._debugWeatherInputs) this._debugWeatherInputs = {};
    return this._debugWeatherInputs;
  },
  // Measured values with debug overrides applied on top.
  getWeatherInputs() {
    const measured = this.getMeasuredWeatherInputs();
    const overrides = this.getDebugWeatherInputs();
    const merged = { ...measured };
    for (const [key, value] of Object.entries(overrides)) {
      if (value != null && key in merged) merged[key] = value;
    }
    return merged;
  },
  applyWeatherInputs() {
    this._scene?.setWeatherInputs?.(this.getWeatherInputs());
    const overrides = this.getDebugWeatherInputs();
    this._scene?.setSurfaceOverrides?.({ wetness: overrides.surfaceWetness ?? null, snowCover: overrides.surfaceSnow ?? null });
  },

  // ---- hourly forecast ----
  ensureForecastSubscription() {
    const entityId = String(this._config.weather_entity || "").trim();
    const connection = this._hass?.connection;
    const key = entityId && connection ? entityId : "";
    if (key === this._forecastKey) return;
    this.stopForecastSubscription();
    this._forecastKey = key;
    if (!key || typeof connection.subscribeMessage !== "function") return;
    const subscriptionKey = key;
    connection
      .subscribeMessage((message) => {
        if (this._forecastKey !== subscriptionKey) return;
        this._hourlyForecast = Array.isArray(message?.forecast) ? message.forecast : [];
        this.applyWeatherInputs();
        this.updateForecastDisplay();
        this.updateWeatherDebugPanel?.();
      }, { type: "weather/subscribe_forecast", entity_id: entityId, forecast_type: "hourly" })
      .then((unsubscribe) => {
        if (this._forecastKey === subscriptionKey) this._forecastUnsubscribe = unsubscribe;
        else unsubscribe?.();
      })
      .catch((error) => {
        // The entity may not provide an hourly forecast; the card works without it.
        console.warn("van-power-card: hourly forecast unavailable", error?.message || error);
      });
  },
  stopForecastSubscription() {
    const unsubscribe = this._forecastUnsubscribe;
    this._forecastUnsubscribe = null;
    this._forecastKey = "";
    this._hourlyForecast = [];
    if (typeof unsubscribe === "function") {
      Promise.resolve().then(unsubscribe).catch(() => {});
    }
  },
  // Forecast entries sorted by time, with parsed timestamps.
  getHourlyForecast() {
    return (this._hourlyForecast || [])
      .map((entry) => ({ ...entry, timeMs: new Date(entry?.datetime).getTime() }))
      .filter((entry) => Number.isFinite(entry.timeMs))
      .sort((a, b) => a.timeMs - b.timeMs);
  },
  // Rainfall (mm/h) for the forecast hour covering now, or the next hour if close.
  getCurrentForecastPrecipMm() {
    const now = Date.now();
    const entries = this.getHourlyForecast();
    const current = entries.find((entry) => entry.timeMs <= now && now < entry.timeMs + 36e5) || entries.find((entry) => entry.timeMs > now && entry.timeMs - now < 36e5);
    const value = finite(current?.precipitation);
    return value == null ? null : precipToMm(value, this.getWeatherUnits().precipitation);
  }
};
