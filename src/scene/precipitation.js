import { BufferGeometry, Float32BufferAttribute, Points, PointsMaterial } from "vendor:three";
import { buildWeatherSpriteTexture } from "./sprite-textures.js";
import { clamp, mix } from "./math.js";

export function createPrecipComponent(parent, { getWeatherCondition }) {
  const baseParticles = 2200;
  const maxParticles = 12000;
  const positions = new Float32Array(maxParticles * 3);
  const velocity = new Float32Array(maxParticles);
  const jitter = new Float32Array(maxParticles);
  const originX = new Float32Array(maxParticles);
  const originZ = new Float32Array(maxParticles);
  const phaseY = new Float32Array(maxParticles);
  const wrapRadius = 24;
  const baseTop = 16;
  const baseBottom = -1.8;
  const spawnTopJitter = 10;
  const fallSpan = baseTop - baseBottom + spawnTopJitter;
  for (let i = 0; i < maxParticles; i++) {
    originX[i] = (Math.random() * 2 - 1) * wrapRadius;
    originZ[i] = (Math.random() * 2 - 1) * wrapRadius;
    phaseY[i] = Math.random() * fallSpan;
    positions[i * 3] = originX[i];
    positions[i * 3 + 1] = baseBottom + Math.random() * fallSpan;
    positions[i * 3 + 2] = originZ[i];
    velocity[i] = 11 + Math.random() * 18;
    jitter[i] = Math.random() * Math.PI * 2;
  }
  const geometry = new BufferGeometry();
  const attribute = new Float32BufferAttribute(positions, 3);
  geometry.setAttribute("position", attribute);
  geometry.setDrawRange(0, 0);
  const rainTexture = buildWeatherSpriteTexture("rain");
  const hailTexture = buildWeatherSpriteTexture("hail");
  const snowTexture = buildWeatherSpriteTexture("snow");
  const material = new PointsMaterial({
    color: 14540253,
    size: 0.18,
    map: rainTexture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
    sizeAttenuation: true
  });
  const points = new Points(geometry, material);
  points.visible = false;
  parent.add(points);
  let activeCount = 0;
  let precipType = "none";
  function resetParticle(index) {
    const angle = Math.random() * Math.PI * 2;
    const radiusPrecip = Math.random() * wrapRadius;
    originX[index] = Math.cos(angle) * radiusPrecip;
    originZ[index] = Math.sin(angle) * radiusPrecip;
    phaseY[index] = Math.random() * fallSpan;
    positions[index * 3] = originX[index];
    positions[index * 3 + 1] = baseBottom + Math.random() * fallSpan;
    positions[index * 3 + 2] = originZ[index];
  }
  function setState(type, rate, dayFactor) {
    precipType = type || "none";
    const normalizedRate = clamp(rate, 0, 1);
    const rainCountMul = precipType === "rain" ? getWeatherCondition() === "pouring" ? 8 : getWeatherCondition() === "rainy" ? 5 : 1 : 1;
    const nextActive = Math.max(0, Math.min(maxParticles, Math.floor(baseParticles * normalizedRate * rainCountMul)));
    if (nextActive > activeCount) {
      for (let i = activeCount; i < nextActive; i++) {
        resetParticle(i);
      }
    }
    activeCount = nextActive;
    geometry.setDrawRange(0, activeCount);
    if (precipType === "none" || activeCount <= 0) {
      points.visible = false;
      material.opacity = 0;
      return;
    }
    points.visible = true;
    const nightBoost = mix(0.85, 1.15, 1 - dayFactor);
    if (precipType === "snow") {
      if (material.map !== snowTexture) {
        material.map = snowTexture;
        material.needsUpdate = true;
      }
      material.size = 0.44;
      material.opacity = 0.62 * nightBoost;
      material.color.setRGB(0.93, 0.95, 1);
    } else if (precipType === "sleet") {
      if (material.map !== rainTexture) {
        material.map = rainTexture;
        material.needsUpdate = true;
      }
      material.size = 0.26;
      material.opacity = 0.66 * nightBoost;
      material.color.setRGB(0.84, 0.9, 1);
    } else if (precipType === "hail") {
      if (material.map !== hailTexture) {
        material.map = hailTexture;
        material.needsUpdate = true;
      }
      material.size = 0.4;
      material.opacity = 0.78 * nightBoost;
      material.color.setRGB(0.88, 0.93, 1);
    } else {
      if (material.map !== rainTexture) {
        material.map = rainTexture;
        material.needsUpdate = true;
      }
      material.size = getWeatherCondition() === "pouring" ? 0.26 : 0.22;
      material.opacity = (getWeatherCondition() === "pouring" ? 0.82 : 0.72) * nightBoost;
      material.color.setRGB(0.72, 0.84, 1);
    }
  }
  function randomizeOrigin(index) {
    const angle = Math.random() * Math.PI * 2;
    const radiusPrecip = Math.random() * wrapRadius;
    originX[index] = Math.cos(angle) * radiusPrecip;
    originZ[index] = Math.sin(angle) * radiusPrecip;
  }
  function update(nowMs, dtSec, windX, windZ, windStrength) {
    if (activeCount <= 0 || precipType === "none") return;
    const isSnow = precipType === "snow";
    const isSleet = precipType === "sleet";
    const rainSpeedMul = precipType === "rain" && getWeatherCondition() === "pouring" ? 1.35 : 1;
    const typeSpeedFactor = isSnow ? 1 : isSleet ? 1 : precipType === "hail" ? 2 : 2 * rainSpeedMul;
    const lateralFactor = isSnow ? 0.12 : isSleet ? 0.25 : 1.25;
    const t = nowMs * 1e-3 * (isSnow ? 0.02 : isSleet ? 0.05 : 1);
    const fieldX = Math.sin(t * (isSnow ? 0.04 : isSleet ? 0.1 : 0.36)) * (isSnow ? 0.28 : isSleet ? 0.5 : 2.2);
    const fieldZ = Math.cos(t * (isSnow ? 0.03 : isSleet ? 0.09 : 0.31)) * (isSnow ? 0.2 : isSleet ? 0.36 : 1.6);
    const clampedDt = Math.max(1 / 240, Math.min(1 / 20, Number(dtSec) || 1 / 60));
    for (let i = 0; i < activeCount; i++) {
      const fallRate = isSnow ? 0.34 + windStrength * 0.08 : isSleet ? 0.62 + windStrength * 0.16 : velocity[i] * typeSpeedFactor * (0.68 + windStrength * 0.44);
      phaseY[i] += fallRate * clampedDt;
      if (phaseY[i] >= fallSpan) {
        phaseY[i] -= fallSpan;
        randomizeOrigin(i);
      }
      const yCycle = phaseY[i];
      const y = baseTop + spawnTopJitter - yCycle;
      const jitterWave = Math.sin(t * (isSnow ? 0.08 : isSleet ? 0.22 : 1.4) + i * 0.03 + jitter[i]) * (isSnow ? 0.015 : isSleet ? 0.04 : 0.35);
      const swirlWave = Math.cos(t * (isSnow ? 0.06 : isSleet ? 0.16 : 0.95) + i * 0.02 + jitter[i] * 1.3) * (isSnow ? 0.01 : isSleet ? 0.025 : 0.22);
      const spread = isSnow ? 0.12 + windStrength * 0.08 : isSleet ? 0.32 + windStrength * 0.28 : 2.8 + windStrength * 4.8;
      const x = originX[i] + fieldX + (windX * lateralFactor + jitterWave) * spread;
      const z = originZ[i] + fieldZ + (windZ * lateralFactor + swirlWave) * spread;
      attribute.setXYZ(i, x, y, z);
    }
    attribute.needsUpdate = true;
    points.rotation.y = isSnow || isSleet ? 0 : Math.sin(t * 0.12) * 0.08;
  }
  function destroyComponent() {
    rainTexture?.dispose?.();
    hailTexture?.dispose?.();
    snowTexture?.dispose?.();
    geometry.dispose();
    material.dispose();
    points.removeFromParent();
  }
  return { setState, update, destroy: destroyComponent };
}
