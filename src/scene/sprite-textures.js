import { CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial } from "vendor:three";
import { clamp, mix } from "./math.js";

export function buildSunSpriteTexture() {
  const canvas2 = document.createElement("canvas");
  canvas2.width = 256;
  canvas2.height = 256;
  const ctx = canvas2.getContext("2d");
  if (!ctx) return null;
  const cx = canvas2.width * 0.5;
  const cy = canvas2.height * 0.5;
  const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, canvas2.width * 0.5);
  glow.addColorStop(0, "rgba(255,250,220,1)");
  glow.addColorStop(0.2, "rgba(255,236,178,0.98)");
  glow.addColorStop(0.45, "rgba(255,208,132,0.62)");
  glow.addColorStop(0.75, "rgba(255,188,116,0.24)");
  glow.addColorStop(1, "rgba(255,170,98,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas2.width, canvas2.height);
  const texture = new CanvasTexture(canvas2);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function buildWeatherSpriteTexture(drawMode = "cloud") {
  const size = 96;
  const canvas2 = document.createElement("canvas");
  canvas2.width = size;
  canvas2.height = size;
  const ctx = canvas2.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, size, size);
  const center = size / 2;
  if (drawMode === "rain") {
    const gradient = ctx.createLinearGradient(center, 10, center, size - 10);
    gradient.addColorStop(0, "rgba(210,225,255,0)");
    gradient.addColorStop(0.4, "rgba(210,225,255,0.66)");
    gradient.addColorStop(1, "rgba(210,225,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(center - 2, 8, 4, size - 16);
  } else if (drawMode === "hail") {
    const gradient = ctx.createLinearGradient(center, 28, center, size - 28);
    gradient.addColorStop(0, "rgba(225,235,255,0)");
    gradient.addColorStop(0.45, "rgba(225,235,255,0.92)");
    gradient.addColorStop(1, "rgba(225,235,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(center - 6, 24, 12, size - 48);
  } else if (drawMode === "snow") {
    const gradient = ctx.createRadialGradient(center, center, 2, center, center, center * 0.62);
    gradient.addColorStop(0, "rgba(245,250,255,0.95)");
    gradient.addColorStop(0.55, "rgba(235,245,255,0.65)");
    gradient.addColorStop(1, "rgba(235,245,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center, center, center * 0.62, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;
    function hash2(x, y) {
      const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
      return s - Math.floor(s);
    }
    function valueNoise(x, y) {
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const sx = x - x0;
      const sy = y - y0;
      const ix0 = mix(hash2(x0, y0), hash2(x1, y0), sx * sx * (3 - 2 * sx));
      const ix1 = mix(hash2(x0, y1), hash2(x1, y1), sx * sx * (3 - 2 * sx));
      return mix(ix0, ix1, sy * sy * (3 - 2 * sy));
    }
    function fbm(x, y) {
      let sum = 0;
      let amp = 0.6;
      let freq = 1;
      for (let o = 0; o < 4; o++) {
        sum += valueNoise(x * freq, y * freq) * amp;
        freq *= 2.03;
        amp *= 0.52;
      }
      return sum;
    }
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = x / (size - 1) - 0.5;
        const ny = y / (size - 1) - 0.5;
        const radial = 1 - Math.sqrt(nx * nx * 1.2 + ny * ny * 1.75) * 1.62;
        const n1 = fbm((x + 17.3) * 0.085, (y - 23.1) * 0.072);
        const n2 = fbm((x - 41.7) * 0.15, (y + 9.9) * 0.13);
        const wisps = n1 * 0.78 + n2 * 0.42;
        const edgeBreak = valueNoise(x * 0.22 + 11.7, y * 0.21 - 19.3) * 0.18;
        const alpha = clamp((radial + wisps * 0.72 - edgeBreak - 0.35) * 1.48, 0, 1);
        // Fade to zero at the texture border so denser clouds never show square sprite edges.
        const borderDist = 0.5 - Math.max(Math.abs(nx), Math.abs(ny));
        const borderT = clamp(borderDist / 0.16, 0, 1);
        const borderMask = borderT * borderT * (3 - 2 * borderT);
        const softAlpha = Math.pow(alpha, 1.22) * borderMask;
        const index = (y * size + x) * 4;
        const brightness = clamp(0.88 + wisps * 0.18, 0.76, 1);
        data[index] = Math.round(255 * brightness);
        data[index + 1] = Math.round(255 * (brightness * 0.99));
        data[index + 2] = Math.round(255 * (brightness * 0.98));
        data[index + 3] = Math.round(255 * softAlpha);
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }
  const texture = new CanvasTexture(canvas2);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function drawLabel(entry) {
  const ctx = entry.canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, entry.canvas.width, entry.canvas.height);
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.font = "900 76px Inter, Arial, sans-serif";
  ctx.fillText(entry.lines[0] || "\u2014", entry.canvas.width / 2 + 8, 94 + 8);
  ctx.font = "800 56px Inter, Arial, sans-serif";
  ctx.fillText(entry.lines[1] || "\u2014", entry.canvas.width / 2 + 6, 168 + 6);
  ctx.fillText(entry.lines[2] || "\u2014", entry.canvas.width / 2 + 6, 232 + 6);
  ctx.fillStyle = "rgba(255,255,255,0.68)";
  ctx.font = "700 22px Inter, Arial, sans-serif";
  ctx.fillText(entry.title, entry.canvas.width / 2, 278);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 76px Inter, Arial, sans-serif";
  ctx.fillText(entry.lines[0] || "\u2014", entry.canvas.width / 2, 94);
  ctx.font = "800 56px Inter, Arial, sans-serif";
  ctx.fillText(entry.lines[1] || "\u2014", entry.canvas.width / 2, 168);
  ctx.fillText(entry.lines[2] || "\u2014", entry.canvas.width / 2, 232);
  entry.texture.needsUpdate = true;
}

export function createCompassLabelSprite(text) {
  const canvas2 = document.createElement("canvas");
  canvas2.width = 128;
  canvas2.height = 128;
  const ctx = canvas2.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas2.width, canvas2.height);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "700 72px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas2.width / 2, canvas2.height / 2 + 2);
  const texture = new CanvasTexture(canvas2);
  texture.colorSpace = SRGBColorSpace;
  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false
  });
  return new Sprite(material);
}
