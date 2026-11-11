import { BackSide, BufferGeometry, CanvasTexture, Float32BufferAttribute, Mesh, MeshBasicMaterial, SRGBColorSpace } from "vendor:three";
import { clamp, mix } from "./math.js";

export function createSkyDomeComponent(parent) {
  function createDomeGeometry(radius = 120, widthSegments = 52, heightSegments = 28) {
    const vertices = [];
    const uvs = [];
    const indices = [];
    for (let y = 0; y <= heightSegments; y++) {
      const v = y / heightSegments;
      const theta = v * Math.PI * 0.72;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      for (let x = 0; x <= widthSegments; x++) {
        const u = x / widthSegments;
        const phi = u * Math.PI * 2;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);
        const px = radius * sinTheta * cosPhi;
        const py = radius * cosTheta - radius * 0.08;
        const pz = radius * sinTheta * sinPhi;
        vertices.push(px, py, pz);
        uvs.push(u, 1 - v);
      }
    }
    for (let y = 0; y < heightSegments; y++) {
      for (let x = 0; x < widthSegments; x++) {
        const a = y * (widthSegments + 1) + x;
        const b = a + widthSegments + 1;
        const c = b + 1;
        const d = a + 1;
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    return geometry;
  }
  const canvas2 = document.createElement("canvas");
  canvas2.width = 1024;
  canvas2.height = 512;
  const texture = new CanvasTexture(canvas2);
  texture.colorSpace = SRGBColorSpace;
  const material = new MeshBasicMaterial({
    map: texture,
    side: BackSide,
    fog: false,
    depthWrite: false,
    toneMapped: false
  });
  const geometry = createDomeGeometry();
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = -1000;
  parent.add(mesh);
  function drawSky(params = {}) {
    const ctx = canvas2.getContext("2d");
    if (!ctx) return;
    const dayFactor = clamp(Number(params.dayFactor), 0, 1);
    const cloudAmount = clamp(Number(params.cloudAmount), 0, 1);
    const fogDensity = clamp(Number(params.fogDensity), 0, 0.03);
    const stormLevel = clamp(Number(params.stormLevel), 0, 1);
    const sunX = Number(params.sunX) || 0;
    const sunY = Number(params.sunY) || 0;
    const sunZ = Number(params.sunZ) || 0;
    const sunLen = Math.max(1e-3, Math.hypot(sunX, sunY, sunZ));
    const sunNx = sunX / sunLen;
    const sunNy = sunY / sunLen;
    const topBaseR = mix(16, 132, dayFactor);
    const topBaseG = mix(26, 174, dayFactor);
    const topBaseB = mix(40, 232, dayFactor);
    const horizonBaseR = mix(22, 206, dayFactor);
    const horizonBaseG = mix(30, 224, dayFactor);
    const horizonBaseB = mix(48, 243, dayFactor);
    const cloudDarken = 1 - cloudAmount * 0.38 - stormLevel * 0.42;
    const fogLift = clamp(fogDensity * 22, 0, 0.42);
    const topR = clamp(Math.round(topBaseR * cloudDarken + fogLift * 80), 0, 255);
    const topG = clamp(Math.round(topBaseG * cloudDarken + fogLift * 90), 0, 255);
    const topB = clamp(Math.round(topBaseB * cloudDarken + fogLift * 100), 0, 255);
    const horizonR = clamp(Math.round(horizonBaseR * cloudDarken + fogLift * 120), 0, 255);
    const horizonG = clamp(Math.round(horizonBaseG * cloudDarken + fogLift * 125), 0, 255);
    const horizonB = clamp(Math.round(horizonBaseB * cloudDarken + fogLift * 130), 0, 255);
    ctx.clearRect(0, 0, canvas2.width, canvas2.height);
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas2.height);
    skyGrad.addColorStop(0, `rgb(${topR},${topG},${topB})`);
    skyGrad.addColorStop(0.55, `rgb(${horizonR},${horizonG},${horizonB})`);
    // Below the horizon: dark, but fading to the horizon colour in fog so the far
    // edge of the fogged ground doesn't show as a bright line against it.
    const belowFog = clamp(fogDensity * 60, 0, 0.95);
    const belowR = Math.round(mix(Math.max(6, topR * 0.4), horizonR, belowFog));
    const belowG = Math.round(mix(Math.max(10, topG * 0.45), horizonG, belowFog));
    const belowB = Math.round(mix(Math.max(16, topB * 0.5), horizonB, belowFog));
    skyGrad.addColorStop(1, `rgb(${belowR},${belowG},${belowB})`);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas2.width, canvas2.height);
    const sunPx = canvas2.width * (0.5 + sunNx * 0.28);
    const sunPy = canvas2.height * (0.54 - sunNy * 0.44);
    const sunGlow = ctx.createRadialGradient(sunPx, sunPy, 12, sunPx, sunPy, canvas2.height * 0.5);
    const glowStrength = clamp(dayFactor * (1 - cloudAmount * 0.68) + 0.12, 0, 1);
    sunGlow.addColorStop(0, `rgba(255,234,188,${(0.38 * glowStrength).toFixed(3)})`);
    sunGlow.addColorStop(0.35, `rgba(255,214,156,${(0.2 * glowStrength).toFixed(3)})`);
    sunGlow.addColorStop(1, "rgba(255,210,150,0)");
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, canvas2.width, canvas2.height);
    const vignet = ctx.createRadialGradient(canvas2.width * 0.5, canvas2.height * 0.55, canvas2.height * 0.2, canvas2.width * 0.5, canvas2.height * 0.55, canvas2.height * 0.95);
    vignet.addColorStop(0, "rgba(0,0,0,0)");
    vignet.addColorStop(1, `rgba(4,8,14,${(0.16 + cloudAmount * 0.16 + stormLevel * 0.18).toFixed(3)})`);
    ctx.fillStyle = vignet;
    ctx.fillRect(0, 0, canvas2.width, canvas2.height);
    texture.needsUpdate = true;
    // Horizon colour as rendered (after the vignette), used as the scene fog colour.
    const vignetteMul = 1 - (0.16 + cloudAmount * 0.16 + stormLevel * 0.18) * 0.45;
    return { r: horizonR * vignetteMul, g: horizonG * vignetteMul, b: horizonB * vignetteMul };
  }
  function destroyComponent() {
    mesh.removeFromParent();
    geometry.dispose();
    material.dispose();
    texture.dispose();
  }
  return { drawSky, destroy: destroyComponent };
}
