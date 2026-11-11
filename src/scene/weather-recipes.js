export const WEATHER_RECIPES = {
  sunny: { label: "Sunny", cloud: 0.08, fog: 4e-4, precipType: "none", precipRate: 0, wind: 0.3, storm: 0, wetness: 0, snow: 0 },
  "clear-night": { label: "Clear Night", cloud: 0.04, fog: 8e-4, precipType: "none", precipRate: 0, wind: 0.2, storm: 0, wetness: 0, snow: 0 },
  partlycloudy: { label: "Partly Cloudy", cloud: 0.42, fog: 18e-4, precipType: "none", precipRate: 0, wind: 0.42, storm: 0, wetness: 0.04, snow: 0 },
  cloudy: { label: "Cloudy", cloud: 0.95, fog: 52e-4, precipType: "none", precipRate: 0, wind: 0.48, storm: 0, wetness: 0.08, snow: 0 },
  fog: { label: "Fog", cloud: 1, fog: 0.016, precipType: "none", precipRate: 0, wind: 0.18, storm: 0, wetness: 0.12, snow: 0 },
  rainy: { label: "Rain", cloud: 0.98, fog: 95e-4, precipType: "rain", precipRate: 0.58, wind: 0.58, storm: 0, wetness: 0.62, snow: 0 },
  pouring: { label: "Pouring", cloud: 1, fog: 0.015, precipType: "rain", precipRate: 1, wind: 0.82, storm: 0, wetness: 1, snow: 0 },
  snowy: { label: "Snow", cloud: 0.9, fog: 0.011, precipType: "snow", precipRate: 0.58, wind: 0.5, storm: 0, wetness: 0.2, snow: 0.72 },
  "snowy-rainy": { label: "Snow/Rain", cloud: 0.96, fog: 0.013, precipType: "sleet", precipRate: 0.72, wind: 0.62, storm: 0, wetness: 0.64, snow: 0.36 },
  hail: { label: "Hail", cloud: 1, fog: 0.016, precipType: "hail", precipRate: 0.74, wind: 0.88, storm: 0, wetness: 0.84, snow: 0.08 },
  lightning: { label: "Lightning", cloud: 1, fog: 0.016, precipType: "none", precipRate: 0, wind: 0.82, storm: 0.95, wetness: 0.18, snow: 0 },
  "lightning-rainy": { label: "Lightning Rain", cloud: 1, fog: 0.014, precipType: "rain", precipRate: 0.86, wind: 0.92, storm: 1, wetness: 0.94, snow: 0 },
  windy: { label: "Windy", cloud: 0.28, fog: 17e-4, precipType: "none", precipRate: 0, wind: 1, storm: 0, wetness: 0.04, snow: 0 },
  "windy-variant": { label: "Windy Cloudy", cloud: 0.92, fog: 45e-4, precipType: "none", precipRate: 0, wind: 1, storm: 0, wetness: 0.08, snow: 0 },
  exceptional: { label: "Exceptional", cloud: 1, fog: 0.014, precipType: "rain", precipRate: 0.9, wind: 1, storm: 0, wetness: 1, snow: 0.12 }
};

export function normalizeWeatherCondition(raw) {
  const text = String(raw || "").trim().toLowerCase();
  if (!text) return "sunny";
  let normalized = text.startsWith("mdi:weather-") ? text.slice("mdi:weather-".length) : text;
  normalized = normalized.replace(/_/g, "-");
  const aliasMap = {
    "clear-day": "sunny",
    "partly-cloudy-day": "partlycloudy",
    "partly-cloudy-night": "partlycloudy",
    "clear-night": "clear-night",
    rain: "rainy",
    sleet: "snowy-rainy",
    snow: "snowy",
    wind: "windy",
    "windy-variant": "windy-variant",
    "partly-cloudy": "partlycloudy"
  };
  const aliased = aliasMap[normalized] || normalized;
  return WEATHER_RECIPES[aliased] ? aliased : "sunny";
}
