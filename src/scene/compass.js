import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineLoop, LineSegments } from "vendor:three";
import { bearingDegToXZ, degToRad } from "./math.js";
import { createCompassLabelSprite } from "./sprite-textures.js";

// Compass ring drawn on the ground under the van, rotated to the van's bearing.
export function createCompass({ compassGroup, getVanBearingDeg }) {
  function clearCompass() {
    for (let i = compassGroup.children.length - 1; i >= 0; i--) {
      const child = compassGroup.children[i];
      compassGroup.remove(child);
      child.traverse?.((node) => {
        if (node.material) {
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach((material) => {
            material.map?.dispose?.();
            material.dispose?.();
          });
        }
        node.geometry?.dispose?.();
      });
    }
  }
  function createCompassUnderModel(radius, y) {
    clearCompass();
    const ringRadius = Math.max(2.8, radius);
    const majorTickLen = ringRadius * 0.1;
    const minorTickLen = ringRadius * 0.05;
    const ringSegments = 96;
    const ringVerts = [];
    for (let i = 0; i <= ringSegments; i++) {
      const bearingDeg = i / ringSegments * 360;
      const pos = bearingDegToXZ(bearingDeg, ringRadius);
      ringVerts.push(pos.x, y, pos.z);
    }
    const ringGeometry = new BufferGeometry();
    ringGeometry.setAttribute("position", new Float32BufferAttribute(ringVerts, 3));
    const ringMaterial = new LineBasicMaterial({ color: 13421772, transparent: true, opacity: 0.55 });
    const ring = new LineLoop(ringGeometry, ringMaterial);
    compassGroup.add(ring);
    const tickVerts = [];
    for (let deg = 0; deg < 360; deg += 10) {
      const tickLen = deg % 30 === 0 ? majorTickLen : minorTickLen;
      const inner = ringRadius - tickLen;
      const innerPos = bearingDegToXZ(deg, inner);
      const outerPos = bearingDegToXZ(deg, ringRadius);
      tickVerts.push(
        innerPos.x, y, innerPos.z,
        outerPos.x, y, outerPos.z
      );
    }
    const tickGeometry = new BufferGeometry();
    tickGeometry.setAttribute("position", new Float32BufferAttribute(tickVerts, 3));
    const tickMaterial = new LineBasicMaterial({ color: 11184810, transparent: true, opacity: 0.45 });
    const ticks = new LineSegments(tickGeometry, tickMaterial);
    compassGroup.add(ticks);
    const cardinals = [
      { text: "N", bearingDeg: 0 },
      { text: "E", bearingDeg: 90 },
      { text: "S", bearingDeg: 180 },
      { text: "W", bearingDeg: 270 }
    ];
    const labelRadius = ringRadius + ringRadius * 0.13;
    const labelY = y + 0.03;
    for (let i = 0; i < cardinals.length; i++) {
      const entry = cardinals[i];
      const sprite = createCompassLabelSprite(entry.text);
      if (!sprite) continue;
      const pos = bearingDegToXZ(entry.bearingDeg, labelRadius);
      sprite.position.set(
        pos.x,
        labelY,
        pos.z
      );
      const labelScale = Math.max(0.6, ringRadius * 0.15);
      sprite.scale.set(labelScale, labelScale, 1);
      compassGroup.add(sprite);
    }
    updateCompassOrientation();
  }
  function updateCompassOrientation() {
    const headingRotationDeg = getVanBearingDeg() ?? 0;
    compassGroup.rotation.y = degToRad(headingRotationDeg);
  }
  return { createCompassUnderModel, updateCompassOrientation };
}
