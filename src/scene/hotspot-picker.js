import { Box3, Vector3 } from "vendor:three";
import { getBaseGeometryBox } from "./model-bounds.js";

// Screen-space hit testing for the tappable parts of the van model (lights, cameras, Starlink dish, grills, awning).
export function createHotspotPicker({ awningPickMeshes, camera, cameraPickAnchors, canvas, grillPickMeshes, modelLights, starlinkPickAnchors }) {
  const modelLightPickLocal = new Vector3();
  const modelLightPickWorldCenter = new Vector3();
  const modelLightPickDefaultCenter = new Vector3(0, 0, 0);
  const cameraPickLocal = new Vector3();
  const cameraPickWorldCenter = new Vector3();
  const cameraPickDefaultCenter = new Vector3(0, 0, 0);
  const cameraPickProjected = new Vector3();
  const starlinkPickLocal = new Vector3();
  const starlinkPickWorldCenter = new Vector3();
  const starlinkPickDefaultCenter = new Vector3(0, 0, 0);
  const starlinkPickProjected = new Vector3();
  const anchorBoundsWorldCenter = new Vector3();
  const anchorBoundsWorldBox = new Box3();
  const anchorBoundsCorners = [
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3()
  ];
  const awningPickWorldBox = new Box3();
  const awningPickCorners = [
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3()
  ];
  const awningPickProjected = new Vector3();
  const grillPickWorldBox = new Box3();
  const grillPickProjected = new Vector3();
  const grillPickUpperWorldCenter = new Vector3();
  const grillPickLowerWorldCenter = new Vector3();
  function getAnchorLocalCenter(anchorObject) {
    const center = new Vector3(0, 0, 0);
    if (!anchorObject) return center;
    anchorBoundsWorldBox.makeEmpty();
    anchorObject.updateMatrixWorld(true);
    anchorObject.traverse((child) => {
      if (!child?.isMesh || !child.geometry) return;
      const baseBox = getBaseGeometryBox(child.geometry);
      if (!baseBox || baseBox.isEmpty()) return;
      const min = baseBox.min;
      const max2 = baseBox.max;
      anchorBoundsCorners[0].set(min.x, min.y, min.z).applyMatrix4(child.matrixWorld);
      anchorBoundsCorners[1].set(min.x, min.y, max2.z).applyMatrix4(child.matrixWorld);
      anchorBoundsCorners[2].set(min.x, max2.y, min.z).applyMatrix4(child.matrixWorld);
      anchorBoundsCorners[3].set(min.x, max2.y, max2.z).applyMatrix4(child.matrixWorld);
      anchorBoundsCorners[4].set(max2.x, min.y, min.z).applyMatrix4(child.matrixWorld);
      anchorBoundsCorners[5].set(max2.x, min.y, max2.z).applyMatrix4(child.matrixWorld);
      anchorBoundsCorners[6].set(max2.x, max2.y, min.z).applyMatrix4(child.matrixWorld);
      anchorBoundsCorners[7].set(max2.x, max2.y, max2.z).applyMatrix4(child.matrixWorld);
      for (let i = 0; i < anchorBoundsCorners.length; i++) {
        anchorBoundsWorldBox.expandByPoint(anchorBoundsCorners[i]);
      }
    });
    if (anchorBoundsWorldBox.isEmpty()) return center;
    anchorBoundsWorldBox.getCenter(anchorBoundsWorldCenter);
    return anchorObject.worldToLocal(anchorBoundsWorldCenter.clone());
  }
  const lightPickProjected = new Vector3();
  function getModelLightPickIndex(clientX, clientY) {
    if (!modelLights.length) return -1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return -1;
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const pickRadiusPx = 40;
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let index = 0; index < modelLights.length; index++) {
      const light = modelLights[index];
      if (!light || !light.parent) continue;
      modelLightPickLocal.copy(light.userData?.__pickLocalCenter || modelLightPickDefaultCenter);
      modelLightPickWorldCenter.copy(modelLightPickLocal).applyMatrix4(light.matrixWorld);
      lightPickProjected.copy(modelLightPickWorldCenter).project(camera);
      if (lightPickProjected.z < -1 || lightPickProjected.z > 1) continue;
      const screenX = (lightPickProjected.x * 0.5 + 0.5) * rect.width;
      const screenY = (-lightPickProjected.y * 0.5 + 0.5) * rect.height;
      const distance = Math.hypot(screenX - localX, screenY - localY);
      if (distance <= pickRadiusPx && distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    return bestIndex;
  }
  function getCameraPickIndex(clientX, clientY) {
    if (!cameraPickAnchors.length) return -1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return -1;
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const pickRadiusPx = 28;
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let index = 0; index < cameraPickAnchors.length; index++) {
      const anchor = cameraPickAnchors[index];
      if (!anchor || !anchor.parent) continue;
      cameraPickLocal.copy(anchor.userData?.__pickLocalCenter || cameraPickDefaultCenter);
      cameraPickWorldCenter.copy(cameraPickLocal).applyMatrix4(anchor.matrixWorld);
      cameraPickProjected.copy(cameraPickWorldCenter).project(camera);
      if (cameraPickProjected.z < -1 || cameraPickProjected.z > 1) continue;
      const screenX = (cameraPickProjected.x * 0.5 + 0.5) * rect.width;
      const screenY = (-cameraPickProjected.y * 0.5 + 0.5) * rect.height;
      const distance = Math.hypot(screenX - localX, screenY - localY);
      if (distance <= pickRadiusPx && distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    return bestIndex;
  }
  function getStarlinkPickIndex(clientX, clientY) {
    if (!starlinkPickAnchors.length) return -1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return -1;
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const pickRadiusPx = 30;
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let index = 0; index < starlinkPickAnchors.length; index++) {
      const anchor = starlinkPickAnchors[index];
      if (!anchor || !anchor.parent) continue;
      starlinkPickLocal.copy(anchor.userData?.__pickLocalCenter || starlinkPickDefaultCenter);
      starlinkPickWorldCenter.copy(starlinkPickLocal).applyMatrix4(anchor.matrixWorld);
      starlinkPickProjected.copy(starlinkPickWorldCenter).project(camera);
      if (starlinkPickProjected.z < -1 || starlinkPickProjected.z > 1) continue;
      const screenX = (starlinkPickProjected.x * 0.5 + 0.5) * rect.width;
      const screenY = (-starlinkPickProjected.y * 0.5 + 0.5) * rect.height;
      const distance = Math.hypot(screenX - localX, screenY - localY);
      if (distance <= pickRadiusPx && distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    return bestIndex;
  }
  function getGrillPickCenters(rect) {
    if (!grillPickMeshes.length) return null;
    grillPickWorldBox.makeEmpty();
    for (let i = 0; i < grillPickMeshes.length; i++) {
      const mesh = grillPickMeshes[i];
      if (!mesh?.isMesh || !mesh.geometry) continue;
      const baseBox = getBaseGeometryBox(mesh.geometry);
      if (!baseBox || baseBox.isEmpty()) continue;
      const min = baseBox.min;
      const max2 = baseBox.max;
      anchorBoundsCorners[0].set(min.x, min.y, min.z).applyMatrix4(mesh.matrixWorld);
      anchorBoundsCorners[1].set(min.x, min.y, max2.z).applyMatrix4(mesh.matrixWorld);
      anchorBoundsCorners[2].set(min.x, max2.y, min.z).applyMatrix4(mesh.matrixWorld);
      anchorBoundsCorners[3].set(min.x, max2.y, max2.z).applyMatrix4(mesh.matrixWorld);
      anchorBoundsCorners[4].set(max2.x, min.y, min.z).applyMatrix4(mesh.matrixWorld);
      anchorBoundsCorners[5].set(max2.x, min.y, max2.z).applyMatrix4(mesh.matrixWorld);
      anchorBoundsCorners[6].set(max2.x, max2.y, min.z).applyMatrix4(mesh.matrixWorld);
      anchorBoundsCorners[7].set(max2.x, max2.y, max2.z).applyMatrix4(mesh.matrixWorld);
      for (let j = 0; j < anchorBoundsCorners.length; j++) {
        grillPickWorldBox.expandByPoint(anchorBoundsCorners[j]);
      }
    }
    if (grillPickWorldBox.isEmpty()) return null;
    const min = grillPickWorldBox.min;
    const max2 = grillPickWorldBox.max;
    const centerX = (min.x + max2.x) * 0.5;
    const centerZ = (min.z + max2.z) * 0.5;
    const grillHeight = max2.y - min.y;
    const upperGrillYOffset = 0.9;
    const lowerGrillYOffset = 0.1;
    grillPickUpperWorldCenter.set(centerX, min.y + grillHeight * upperGrillYOffset, centerZ);
    grillPickLowerWorldCenter.set(centerX, min.y + grillHeight * lowerGrillYOffset, centerZ);
    grillPickProjected.copy(grillPickUpperWorldCenter).project(camera);
    if (grillPickProjected.z < -1 || grillPickProjected.z > 1) return null;
    const upper = {
      x: (grillPickProjected.x * 0.5 + 0.5) * rect.width,
      y: (-grillPickProjected.y * 0.5 + 0.5) * rect.height
    };
    grillPickProjected.copy(grillPickLowerWorldCenter).project(camera);
    if (grillPickProjected.z < -1 || grillPickProjected.z > 1) return null;
    const lower = {
      x: (grillPickProjected.x * 0.5 + 0.5) * rect.width,
      y: (-grillPickProjected.y * 0.5 + 0.5) * rect.height
    };
    return { upper, lower };
  }
  function getGrillPickIndex(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return -1;
    const centers = getGrillPickCenters(rect);
    if (!centers) return -1;
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const pickRadiusPx = 22;
    const upperDistance = Math.hypot(localX - centers.upper.x, localY - centers.upper.y);
    const lowerDistance = Math.hypot(localX - centers.lower.x, localY - centers.lower.y);
    const upperHit = upperDistance <= pickRadiusPx;
    const lowerHit = lowerDistance <= pickRadiusPx;
    if (upperHit && lowerHit) {
      return upperDistance <= lowerDistance ? 0 : 1;
    }
    if (upperHit) return 0;
    if (lowerHit) return 1;
    return -1;
  }
  function getAwningPickBounds(rect) {
    if (!awningPickMeshes.length) return null;
    awningPickWorldBox.makeEmpty();
    for (let i = 0; i < awningPickMeshes.length; i++) {
      const mesh = awningPickMeshes[i];
      if (!mesh?.isMesh || !mesh.geometry) continue;
      const baseBox = getBaseGeometryBox(mesh.geometry);
      if (!baseBox || baseBox.isEmpty()) continue;
      const min = baseBox.min;
      const max2 = baseBox.max;
      awningPickCorners[0].set(min.x, min.y, min.z).applyMatrix4(mesh.matrixWorld);
      awningPickCorners[1].set(min.x, min.y, max2.z).applyMatrix4(mesh.matrixWorld);
      awningPickCorners[2].set(min.x, max2.y, min.z).applyMatrix4(mesh.matrixWorld);
      awningPickCorners[3].set(min.x, max2.y, max2.z).applyMatrix4(mesh.matrixWorld);
      awningPickCorners[4].set(max2.x, min.y, min.z).applyMatrix4(mesh.matrixWorld);
      awningPickCorners[5].set(max2.x, min.y, max2.z).applyMatrix4(mesh.matrixWorld);
      awningPickCorners[6].set(max2.x, max2.y, min.z).applyMatrix4(mesh.matrixWorld);
      awningPickCorners[7].set(max2.x, max2.y, max2.z).applyMatrix4(mesh.matrixWorld);
      for (let j = 0; j < awningPickCorners.length; j++) {
        awningPickWorldBox.expandByPoint(awningPickCorners[j]);
      }
    }
    if (awningPickWorldBox.isEmpty()) return null;
    const min = awningPickWorldBox.min;
    const max2 = awningPickWorldBox.max;
    awningPickCorners[0].set(min.x, min.y, min.z);
    awningPickCorners[1].set(min.x, min.y, max2.z);
    awningPickCorners[2].set(min.x, max2.y, min.z);
    awningPickCorners[3].set(min.x, max2.y, max2.z);
    awningPickCorners[4].set(max2.x, min.y, min.z);
    awningPickCorners[5].set(max2.x, min.y, max2.z);
    awningPickCorners[6].set(max2.x, max2.y, min.z);
    awningPickCorners[7].set(max2.x, max2.y, max2.z);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let visibleCorners = 0;
    for (let i = 0; i < awningPickCorners.length; i++) {
      awningPickProjected.copy(awningPickCorners[i]).project(camera);
      if (awningPickProjected.z < -1 || awningPickProjected.z > 1) continue;
      const screenX = (awningPickProjected.x * 0.5 + 0.5) * rect.width;
      const screenY = (-awningPickProjected.y * 0.5 + 0.5) * rect.height;
      minX = Math.min(minX, screenX);
      minY = Math.min(minY, screenY);
      maxX = Math.max(maxX, screenX);
      maxY = Math.max(maxY, screenY);
      visibleCorners++;
    }
    if (!visibleCorners) return null;
    const padding = 10;
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding
    };
  }
  function getModelLightScreenPoint(index, rect) {
    if (index < 0 || index >= modelLights.length) return null;
    const light = modelLights[index];
    if (!light || !light.parent) return null;
    modelLightPickLocal.copy(light.userData?.__pickLocalCenter || modelLightPickDefaultCenter);
    modelLightPickWorldCenter.copy(modelLightPickLocal).applyMatrix4(light.matrixWorld);
    lightPickProjected.copy(modelLightPickWorldCenter).project(camera);
    if (lightPickProjected.z < -1 || lightPickProjected.z > 1) return null;
    return {
      x: (lightPickProjected.x * 0.5 + 0.5) * rect.width,
      y: (-lightPickProjected.y * 0.5 + 0.5) * rect.height
    };
  }
  function getAwningTapTarget(rect) {
    const awningTargetOffsetYPx = - 30;
    const frontPoint = getModelLightScreenPoint(0, rect);
    const rearPoint = getModelLightScreenPoint(1, rect);
    if (frontPoint && rearPoint) {
      return {
        x: (frontPoint.x + rearPoint.x) * 0.5,
        y: (frontPoint.y + rearPoint.y) * 0.5 + awningTargetOffsetYPx
      };
    }
    const bounds = getAwningPickBounds(rect);
    if (!bounds) return null;
    return {
      x: (bounds.minX + bounds.maxX) * 0.5,
      y: (bounds.minY + bounds.maxY) * 0.5 + awningTargetOffsetYPx
    };
  }
  function isAwningClick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const target = getAwningTapTarget(rect);
    if (!target) return false;
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const awningRadiusPx = 28;
    return Math.hypot(localX - target.x, localY - target.y) <= awningRadiusPx;
  }
  function isHotspotAt(clientX, clientY) {
    if (isAwningClick(clientX, clientY)) return true;
    if (getGrillPickIndex(clientX, clientY) >= 0) return true;
    if (getCameraPickIndex(clientX, clientY) >= 0) return true;
    if (getStarlinkPickIndex(clientX, clientY) >= 0) return true;
    if (getModelLightPickIndex(clientX, clientY) >= 0) return true;
    return false;
  }
  return { getAnchorLocalCenter, getModelLightPickIndex, getCameraPickIndex, getStarlinkPickIndex, getGrillPickIndex, isAwningClick, isHotspotAt };
}
