import { CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial } from "vendor:three";
import { drawLabel } from "./sprite-textures.js";

// Floating metric labels anchored to nodes in the van model.
export function createSceneLabels({ getLabelsSpinWithModel, getRotationY, labelGroup, labelSpecs, requestSceneRender }) {
  const labelEntries = /* @__PURE__ */ new Map();
  function createLabelEntry(name, spec) {
    const canvas2 = document.createElement("canvas");
    canvas2.width = 512;
    canvas2.height = 320;
    const texture = new CanvasTexture(canvas2);
    texture.colorSpace = SRGBColorSpace;
    const material = new SpriteMaterial({
      map: texture,
      fog: false,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
      sizeAttenuation: true
    });
    const sprite = new Sprite(material);
    sprite.scale.set(spec.scale * 1.6, spec.scale, 1);
    labelGroup.add(sprite);
    const entry = {
      name,
      spec,
      canvas: canvas2,
      texture,
      sprite,
      title: spec.title || name.toUpperCase(),
      lines: ["\u2014", "\u2014", "\u2014"]
    };
    labelEntries.set(name, entry);
    return entry;
  }
  function ensureLabel(name) {
    return labelEntries.get(name) || createLabelEntry(name, labelSpecs[name] || {
      angle: 0,
      radius: 3,
      y: 0.22,
      scale: 1.45,
      title: name.toUpperCase()
    });
  }
  function setLabel(name, payload = {}) {
    const entry = ensureLabel(name);
    const nextTitle = payload.title || entry.spec.title || entry.title;
    const nextLines = Array.isArray(payload.lines) && payload.lines.length ? payload.lines.slice(0, 3).map((line) => String(line)) : ["\u2014", "\u2014", "\u2014"];
    if (entry.title === nextTitle && entry.lines.length === nextLines.length && entry.lines.every((line, index) => line === nextLines[index])) return;
    entry.title = nextTitle;
    entry.lines = nextLines;
    drawLabel(entry);
    requestSceneRender();
  }
  function setLabels(labels = {}) {
    Object.entries(labels).forEach(([name, payload]) => setLabel(name, payload));
  }
  function updateLabelPositions() {
    labelEntries.forEach((entry) => {
      const orbit = getLabelsSpinWithModel() ? getRotationY() : 0;
      const angle = entry.spec.angle + orbit;
      entry.sprite.position.set(
        Math.cos(angle) * entry.spec.radius,
        entry.spec.y,
        Math.sin(angle) * entry.spec.radius
      );
    });
  }
  return { createLabelEntry, setLabels, updateLabelPositions };
}
