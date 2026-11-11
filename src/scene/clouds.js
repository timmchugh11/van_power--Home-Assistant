import { Object3D, Sprite, SpriteMaterial } from "vendor:three";
import { buildWeatherSpriteTexture } from "./sprite-textures.js";
import { clamp, mix } from "./math.js";

// Clouds drift across a circular field along the wind. A cloud that leaves the
// downwind edge re-enters at the upwind edge, fading out and in at the rim.
// Clouds never move to dodge the camera; instead puffs fade out when they are
// close to the camera, between the camera and the van, or passing through the van.
const FIELD_RADIUS = 26;
const EDGE_FADE_START = FIELD_RADIUS * 0.72;
const VAN_TARGET = { x: 0, y: 1.2, z: 0 };

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Drift speed (scene units/s) for a smoothed wind amount (0..1.2):
// ~0.1 calm, ~0.3 at 6 mph, ~1.2 at 25 mph.
export function cloudDriftSpeed(windAmount) {
  return 0.06 + 1.1 * Math.pow(clamp(windAmount, 0, 1.2), 1.4);
}

export function createCloudComponent(parent, { options, camera, requestRender }) {
  // More clouds for overcast skies; low-power mode keeps the original count to limit overdraw.
  const lowPower = options.lowPowerMode === true || options.lowPowerMode === "true";
  const clusterCount = lowPower ? 56 : 84;
  const cloudTexture = buildWeatherSpriteTexture("cloud");
  const clusterData = [];
  let cloudsVisible = options.cloudsVisible !== false;
  const bandConfig = [
    { yMin: 2, ySpan: 1.5, radiusMin: 6.5, radiusSpan: 11, driftMul: 1.08, scaleMul: 1.08 },
    { yMin: 3.6, ySpan: 2, radiusMin: 9.8, radiusSpan: 13.5, driftMul: 0.82, scaleMul: 0.96 },
    { yMin: 5.4, ySpan: 2.6, radiusMin: 12.5, radiusSpan: 16.5, driftMul: 0.58, scaleMul: 0.9 }
  ];
  for (let i = 0; i < clusterCount; i++) {
    const anchor = new Object3D();
    const bandIndex = i % bandConfig.length;
    const band = bandConfig[bandIndex];
    const angle = Math.random() * Math.PI * 2;
    const radiusCloud = FIELD_RADIUS * Math.sqrt(Math.random());
    const baseX = Math.cos(angle) * radiusCloud;
    const baseZ = Math.sin(angle) * radiusCloud;
    const baseY = band.yMin + Math.random() * band.ySpan;
    const phase = Math.random() * Math.PI * 2;
    const drift = 0.25 + Math.random() * 0.95;
    const bob = 0.05 + Math.random() * 0.16;
    const puffCount = 6 + Math.floor(Math.random() * 5);
    const puffs = [];
    for (let p = 0; p < puffCount; p++) {
      const material = new SpriteMaterial({
        map: cloudTexture,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        depthTest: true,
        opacity: 0
      });
      const sprite = new Sprite(material);
      const puffScale = (1.6 + Math.random() * 3.5) * band.scaleMul;
      const scaleX = puffScale * (0.72 + Math.random() * 0.84);
      const scaleY = puffScale * (0.42 + Math.random() * 0.64);
      sprite.scale.set(scaleX, scaleY, 1);
      material.rotation = (Math.random() * 2 - 1) * 0.38;
      const puffAngle = Math.random() * Math.PI * 2;
      const puffRadius = Math.pow(Math.random(), 0.78) * 3.9;
      const puffLift = (Math.random() * 2 - 1) * (0.18 + puffRadius * 0.11);
      sprite.position.set(
        Math.cos(puffAngle) * puffRadius * (1.05 + Math.random() * 0.7),
        puffLift,
        Math.sin(puffAngle) * puffRadius * (0.74 + Math.random() * 0.62)
      );
      anchor.add(sprite);
      puffs.push({
        sprite,
        material,
        size: Math.max(scaleX, scaleY),
        baseScaleX: scaleX,
        baseScaleY: scaleY,
        opacitySeed: 0.74 + Math.random() * 0.38,
        scaleSeed: 0.86 + Math.random() * 0.28
      });
    }
    anchor.position.set(baseX, baseY, baseZ);
    anchor.visible = false;
    parent.add(anchor);
    clusterData.push({
      anchor,
      x: baseX,
      z: baseZ,
      baseY,
      phase,
      drift,
      bob,
      puffs,
      bandDrift: band.driftMul
    });
  }
  let activeCount = 0;
  let activeOpacity = 0;
  let activeHeavy = 0;
  let activeDayFactor = 0.5;
  let activeWindStrength = 0;
  let activeGrayness = 0;
  let lastDriftSpeed = 0;
  function applyVisibility() {
    for (let i = 0; i < clusterData.length; i++) {
      const cluster = clusterData[i];
      cluster.anchor.visible = cloudsVisible && i < activeCount && activeOpacity > 0.01;
    }
    requestRender();
  }
  function setVisible(enabled) {
    const nextVisible = Boolean(enabled);
    if (cloudsVisible === nextVisible) return cloudsVisible;
    cloudsVisible = nextVisible;
    applyVisibility();
    return cloudsVisible;
  }
  function setState(nextCoverage, dayFactor, windStrength, grayness = 0) {
    const coverage = clamp(nextCoverage, 0, 1);
    // Partly cloudy stays close to before; above ~60% cover clouds get more numerous,
    // denser and larger so overcast skies read as solid rather than wispy.
    const heavy = smoothstep(0.6, 1, coverage);
    activeHeavy = heavy;
    activeCount = Math.max(0, Math.min(clusterCount, Math.floor(clusterCount * 0.95 * Math.pow(coverage, 1.5))));
    activeOpacity = (0.03 + 0.33 * coverage + 0.22 * heavy) * mix(0.74, 1.02, 1 - dayFactor);
    activeDayFactor = clamp(dayFactor, 0, 1);
    activeWindStrength = clamp(windStrength, 0, 1.4);
    activeGrayness = clamp(grayness, 0, 1);
    const r = mix(0.54, 0.95, activeDayFactor);
    const g = mix(0.58, 0.97, activeDayFactor);
    const b = mix(0.63, 0.99, activeDayFactor);
    for (let i = 0; i < clusterData.length; i++) {
      const cluster = clusterData[i];
      const visible = cloudsVisible && i < activeCount && activeOpacity > 0.01;
      cluster.anchor.visible = visible;
      if (!visible) continue;
      for (let p = 0; p < cluster.puffs.length; p++) {
        const puff = cluster.puffs[p];
        puff.material.color.setRGB(r, g, b);
      }
    }
  }
  function update(nowMs, dtSec, windDirX, windDirZ, sunPos, dayFactor, weatherCondition = "sunny", sunElevationDeg = NaN) {
    if (!cloudsVisible || activeCount <= 0) return;
    // Gentle motion (bob/sway/turn) runs on real time; only travel speed follows the wind.
    const t = nowMs * 1e-3;
    const clampedDt = Math.max(1 / 240, Math.min(1 / 20, Number(dtSec) || 1 / 60));
    const nightFactor = 1 - dayFactor;
    const dirLen = Math.hypot(windDirX, windDirZ);
    const dirX = dirLen > 1e-6 ? windDirX / dirLen : 1;
    const dirZ = dirLen > 1e-6 ? windDirZ / dirLen : 0;
    const driftSpeed = cloudDriftSpeed(activeWindStrength);
    lastDriftSpeed = driftSpeed;
    const camX = camera.position.x;
    const camY = camera.position.y;
    const camZ = camera.position.z;
    const segX = VAN_TARGET.x - camX;
    const segY = VAN_TARGET.y - camY;
    const segZ = VAN_TARGET.z - camZ;
    const segLenSq = Math.max(1e-6, segX * segX + segY * segY + segZ * segZ);
    const sunX = Number(sunPos?.x) || 0;
    const sunY = Number(sunPos?.y) || 0;
    const sunZ = Number(sunPos?.z) || 0;
    const sunLen = Math.max(1e-3, Math.hypot(sunX, sunY, sunZ));
    const sunNx = sunX / sunLen;
    const sunNy = sunY / sunLen;
    const sunNz = sunZ / sunLen;
    const sunriseWarmth = clamp((1 - Math.abs(sunNy - 0.08) / 0.34) * (0.25 + dayFactor * 0.75), 0, 1);
    const duskCoolness = clamp((1 - dayFactor) * (0.45 + Math.max(0, -sunNy) * 0.55), 0, 1);
    const allowSunsetTint = weatherCondition === "sunny" || weatherCondition === "partlycloudy";
    const elevation = Number(sunElevationDeg);
    const sunsetTintStrength = allowSunsetTint && Number.isFinite(elevation) ? clamp((11.5 - elevation) / 17.5, 0, 1) : 0;
    for (let i = 0; i < activeCount; i++) {
      const cluster = clusterData[i];
      // Travel along the wind; wrap from the downwind rim back to the upwind rim.
      const speed = driftSpeed * (0.6 + cluster.drift * 0.6) * cluster.bandDrift;
      cluster.x += dirX * speed * clampedDt;
      cluster.z += dirZ * speed * clampedDt;
      const along = cluster.x * dirX + cluster.z * dirZ;
      if (along > 0 && Math.hypot(cluster.x, cluster.z) > FIELD_RADIUS) {
        cluster.x -= 2 * along * dirX;
        cluster.z -= 2 * along * dirZ;
        // Shift sideways a little so clouds don't repeat the same track.
        const jitter = (Math.random() * 2 - 1) * 4;
        cluster.x += -dirZ * jitter;
        cluster.z += dirX * jitter;
        const r = Math.hypot(cluster.x, cluster.z);
        if (r > FIELD_RADIUS) {
          cluster.x *= FIELD_RADIUS / r;
          cluster.z *= FIELD_RADIUS / r;
        }
      }
      const radial = Math.hypot(cluster.x, cluster.z);
      const edgeFade = 1 - smoothstep(EDGE_FADE_START, FIELD_RADIUS, radial);
      // Small sway around the travelling position (visual only).
      cluster.anchor.position.x = cluster.x + Math.sin(t * (0.05 + cluster.drift * 0.03) + cluster.phase) * 0.35;
      cluster.anchor.position.z = cluster.z + Math.cos(t * (0.045 + cluster.drift * 0.03) + cluster.phase * 1.4) * 0.35;
      cluster.anchor.position.y = cluster.baseY + Math.sin(t * (0.21 + cluster.drift * 0.08) + cluster.phase * 0.5) * cluster.bob;
      cluster.anchor.rotation.y = Math.sin(t * 0.09 + cluster.phase) * 0.1;
      const ax = cluster.anchor.position.x;
      const ay = cluster.anchor.position.y;
      const az = cluster.anchor.position.z;
      for (let p = 0; p < cluster.puffs.length; p++) {
        const puff = cluster.puffs[p];
        const wx = ax + puff.sprite.position.x;
        const wy = ay + puff.sprite.position.y;
        const wz = az + puff.sprite.position.z;
        const halfSize = puff.size * 0.5;
        // Fade when close to the camera.
        const camDist = Math.hypot(wx - camX, wy - camY, wz - camZ);
        const nearFade = smoothstep(2.5 + halfSize, 7 + halfSize, camDist);
        // Fade when between the camera and the van.
        const along01 = ((wx - camX) * segX + (wy - camY) * segY + (wz - camZ) * segZ) / segLenSq;
        let sightFade = 1;
        if (along01 > 0 && along01 < 1) {
          const cx = camX + segX * along01;
          const cy = camY + segY * along01;
          const cz = camZ + segZ * along01;
          const perp = Math.hypot(wx - cx, wy - cy, wz - cz);
          const clearance = smoothstep(1.5 + halfSize * 0.6, 4.5 + halfSize * 0.6, perp);
          const ends = smoothstep(0, 0.12, along01) * (1 - smoothstep(0.85, 1, along01));
          sightFade = mix(1, clearance, ends);
        }
        // Fade low puffs passing through the van.
        const vanFade = Math.max(smoothstep(4 + halfSize * 0.5, 7.5 + halfSize * 0.5, Math.hypot(wx, wz)), smoothstep(4.2, 5.8, wy - halfSize * 0.3));
        puff.material.opacity = clamp(activeOpacity * puff.opacitySeed, 0, 0.78) * edgeFade * nearFade * sightFade * vanFade;
      }
      const posLen = Math.max(1e-3, Math.hypot(cluster.anchor.position.x, cluster.anchor.position.y, cluster.anchor.position.z));
      const px = cluster.anchor.position.x / posLen;
      const py = cluster.anchor.position.y / posLen;
      const pz = cluster.anchor.position.z / posLen;
      const facingSun = clamp((px * sunNx + py * sunNy + pz * sunNz) * 0.5 + 0.5, 0, 1);
      const lightness = clamp(0.54 + dayFactor * 0.42 + facingSun * 0.2 - activeWindStrength * 0.05, 0.36, 1);
      for (let p = 0; p < cluster.puffs.length; p++) {
        const puff = cluster.puffs[p];
        const baseShade = 0.9 + (p / Math.max(1, cluster.puffs.length - 1)) * 0.08;
        const shade = clamp(lightness * baseShade, 0.3, 1);
        const grayMul = mix(1, 0.9, activeGrayness);
        const rMul = mix(0.96, grayMul, activeGrayness);
        const gMul = mix(0.98, grayMul, activeGrayness);
        const bMul = mix(1, grayMul, activeGrayness);
        let r = shade * rMul;
        let g = shade * gMul;
        let b = shade * bMul;
        const warmInfluence = sunriseWarmth * (0.35 + facingSun * 0.65) * (1 - activeGrayness * 0.6);
        r = mix(r, r * 1.14, warmInfluence);
        g = mix(g, g * 0.95, warmInfluence);
        b = mix(b, b * 0.84, warmInfluence);
        const coolInfluence = duskCoolness * (0.42 + nightFactor * 0.58);
        r = mix(r, r * 0.84, coolInfluence);
        g = mix(g, g * 0.9, coolInfluence);
        b = mix(b, b * 1.08, coolInfluence);
        if (sunsetTintStrength > 0) {
          const sunsetHueInfluence = sunsetTintStrength * (0.45 + facingSun * 0.55) * (1 - activeGrayness * 0.55);
          r = mix(r, r * 1.3, sunsetHueInfluence);
          g = mix(g, g * 0.82, sunsetHueInfluence);
          b = mix(b, b * 0.9, sunsetHueInfluence);
        }
        const weatherNightBoost = clamp(activeGrayness * 0.45 + activeWindStrength * 0.16, 0, 0.6);
        const nightDarken = clamp(Math.pow(nightFactor, 0.66) * (0.9 + weatherNightBoost), 0, 1);
        const nightLift = mix(1, 0.06, nightDarken);
        r *= nightLift * 0.9;
        g *= nightLift * 0.84;
        b *= nightLift * 0.8;
        puff.material.color.setRGB(clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1));
        const scaleMul = (0.96 + activeWindStrength * 0.08) * puff.scaleSeed * (1 + 0.35 * activeHeavy);
        puff.sprite.scale.set(puff.baseScaleX * scaleMul, puff.baseScaleY * scaleMul, 1);
      }
    }
  }
  function destroyComponent() {
    for (let i = 0; i < clusterData.length; i++) {
      const cluster = clusterData[i];
      for (let p = 0; p < cluster.puffs.length; p++) {
        cluster.puffs[p].material.dispose();
      }
      cluster.anchor.removeFromParent();
    }
    cloudTexture?.dispose?.();
  }
  return { setState, setVisible, update, getDriftSpeed: () => lastDriftSpeed, destroy: destroyComponent };
}
