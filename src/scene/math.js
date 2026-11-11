export function clamp(value, min, max2) {
  return Math.max(min, Math.min(max2, value));
}

export function mix(from, to, alpha) {
  return from + (to - from) * alpha;
}

export function wrapDegrees(value) {
  return (value % 360 + 360) % 360;
}

export function degToRad(value) {
  return value * Math.PI / 180;
}

export function radToDeg(value) {
  return value * 180 / Math.PI;
}

export function getRelativeBearingDeg(worldBearingDeg, vanBearingDeg) {
  return wrapDegrees(worldBearingDeg - (Number.isFinite(vanBearingDeg) ? vanBearingDeg : 0));
}

export function bearingDegToXZ(bearingDeg, radius) {
  const rad = degToRad(wrapDegrees(bearingDeg));
  return {
    x: Math.sin(rad) * radius,
    z: -Math.cos(rad) * radius
  };
}

export function legacyAzimuthRadToBearingDeg(azimuthRad) {
  return wrapDegrees(180 - radToDeg(azimuthRad));
}

export function getSolarPositionFromLatLon(date, latitudeDeg, longitudeDeg) {
  const lat = Number(latitudeDeg);
  const lon = Number(longitudeDeg);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const clampedLat = clamp(lat, -90, 90);
  const dt = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(dt.getTime())) return null;
  const startOfYear = new Date(dt.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((dt - startOfYear) / 864e5) + 1;
  const minutes = dt.getHours() * 60 + dt.getMinutes() + dt.getSeconds() / 60 + dt.getMilliseconds() / 6e4;
  const gamma = 2 * Math.PI / 365 * (dayOfYear - 1 + (minutes - 720) / 1440);
  const eqTime = 229.18 * (75e-6 + 1868e-6 * Math.cos(gamma) - 32077e-6 * Math.sin(gamma) - 14615e-6 * Math.cos(2 * gamma) - 40849e-6 * Math.sin(2 * gamma));
  const decl = 6918e-6 - 399912e-6 * Math.cos(gamma) + 70257e-6 * Math.sin(gamma) - 6758e-6 * Math.cos(2 * gamma) + 907e-6 * Math.sin(2 * gamma) - 2697e-6 * Math.cos(3 * gamma) + 1480e-6 * Math.sin(3 * gamma);
  const timeOffset = eqTime + 4 * lon + dt.getTimezoneOffset();
  const trueSolarTime = (minutes + timeOffset) % 1440;
  const tst = trueSolarTime < 0 ? trueSolarTime + 1440 : trueSolarTime;
  const hourAngle = degToRad(tst / 4 - 180);
  const latRad = degToRad(clampedLat);
  const cosZenith = clamp(Math.sin(latRad) * Math.sin(decl) + Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngle), -1, 1);
  const zenith = Math.acos(cosZenith);
  const elevationRad = Math.PI / 2 - zenith;
  const azimuthRad = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(latRad) - Math.tan(decl) * Math.cos(latRad)) + Math.PI;
  return {
    azimuthDeg: wrapDegrees(radToDeg(azimuthRad)),
    elevationDeg: radToDeg(elevationRad),
    elevationRad
  };
}

export function normalizeProgress(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return clamp(parsed, 0, 1);
}

export function clampModelLightsLevel(value) {
  return Math.max(0, Math.min(2, Number(value) || 0));
}

export function clampUnit(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export function shortestAngleDelta(from, to) {
  return wrapAngle(to - from);
}
