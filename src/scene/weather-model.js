import { clamp, mix } from "./math.js";

// Turns real weather measurements into the 0..1 scene parameters the weather
// recipes use. Functions return null when their input is unknown, so callers can
// fall back to the recipe value for the current condition.

const isNum = (value) => typeof value === "number" && Number.isFinite(value);

// Wind speed (m/s) at which the scene shows full wind (about 25 mph).
export const FULL_WIND_MS = 11;

export function windAmountFromSpeed(speedMs) {
  return isNum(speedMs) ? clamp(speedMs / FULL_WIND_MS, 0, 1.2) : null;
}

// 0 = steady wind, 1 = gusts double the mean speed.
export function gustinessFromSpeeds(speedMs, gustMs) {
  if (!isNum(gustMs)) return null;
  const mean = isNum(speedMs) ? speedMs : gustMs * 0.6;
  return clamp((gustMs - mean) / Math.max(mean, 2), 0, 1);
}

// Slowly varying gust envelope in [0, 1] built from incommensurate sines.
export function gustEnvelope(nowMs) {
  const t = nowMs * 1e-3;
  return clamp(0.5 + 0.35 * Math.sin(t * 0.53) * Math.sin(t * 0.21 + 0.7) + 0.15 * Math.sin(t * 1.7 + 2.1), 0, 1);
}

// Fog density from visibility (km) plus a little haze for very humid air.
// 20 km -> 0, 7 km -> ~0.0015, 1 km -> ~0.015 (the "fog" recipe), 0.5 km -> 0.03.
export function fogFromVisibility(visibilityKm, humidity) {
  const hasVisibility = isNum(visibilityKm);
  const hasHumidity = isNum(humidity);
  if (!hasVisibility && !hasHumidity) return null;
  const visibilityFog = hasVisibility ? clamp(0.016 / Math.max(visibilityKm, 0.2) - 8e-4, 0, 0.03) : 0;
  const humidHaze = hasHumidity ? clamp((humidity - 85) / 15, 0, 1) * 15e-4 : 0;
  return clamp(visibilityFog + humidHaze, 0, 0.03);
}

// Precipitation rate (0.2..1) from forecast rainfall in mm/h.
// 0.2 mm/h drizzle -> ~0.3, 1 mm/h -> ~0.49, 3 mm/h -> ~0.72, 8+ mm/h -> 1.
export function precipRateFromMm(mmPerHour) {
  if (!isNum(mmPerHour)) return null;
  return clamp(0.25 + 0.75 * Math.log1p(Math.max(0, mmPerHour)) / Math.log1p(8), 0.2, 1);
}

// Fraction of full wetness that evaporates per second once rain stops.
// Base: about 45 minutes; faster with wind and sun, slower when humid or cold.
export function dryingPerSecond({ windAmount = 0, dayFactor = 0, humidity = null, temperatureC = null } = {}) {
  let rate = 1 / (45 * 60);
  rate *= 1 + clamp(windAmount, 0, 1.2) * 1.5;
  rate *= 1 + clamp(dayFactor, 0, 1) * 1.2;
  if (isNum(humidity)) rate *= humidity >= 90 ? 0.5 : humidity >= 75 ? 0.8 : 1;
  if (isNum(temperatureC) && temperatureC <= 2) rate *= 0.5;
  return rate;
}

// Fraction of snow cover that melts per second once snowfall stops.
// Unknown temperature: about 3 hours. Above 0 C: 2 hours at 1 C, quicker when warmer or sunny.
// At or below 0 C the snow stays.
export function snowMeltPerSecond({ temperatureC = null, dayFactor = 0 } = {}) {
  if (!isNum(temperatureC)) return 1 / (3 * 3600);
  if (temperatureC <= 0) return 0;
  return (Math.min(temperatureC, 10) / 7200) * (1 + clamp(dayFactor, 0, 1) * 0.5);
}

// Seconds for snow to build up to the condition's full cover.
export const SNOW_BUILD_SECONDS = 180;

// Ground frost 0..1: starts at 1 C, full by -2 C, needs moist air.
export function frostAmount(temperatureC, humidity) {
  if (!isNum(temperatureC)) return 0;
  const cold = clamp((1 - temperatureC) / 3, 0, 1);
  const moist = isNum(humidity) ? clamp((humidity - 55) / 25, 0, 1) : 1;
  return cold * moist;
}

// Prevailing UK wind direction (degrees the wind blows FROM) when no bearing is reported.
export const DEFAULT_WIND_FROM_DEG = 225;

// Linear scene fog range (scene units) for a weather fog value (0..0.03).
// The van is ~15 units from the camera: light haze (0.002) -> far 300, barely visible;
// rain haze (0.0095) -> far ~63; 1 km visibility (0.016) -> far ~38; under 500 m (0.03) -> far 20.
export function sceneFogRange(weatherFog) {
  const fog = Math.max(Number(weatherFog) || 0, 1e-4);
  const far = clamp(0.6 / fog, 20, 5000);
  // three.js blends fog with a smoothstep between near and far. In real fog, start the
  // curve behind the camera so nearby ground is hazy too; in clear air keep near ahead
  // of the camera so close objects stay crisp.
  const thick = clamp((fog - 0.006) / 0.01, 0, 1);
  return { near: far * mix(0.04, -0.3, thick), far };
}
