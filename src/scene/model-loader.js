import { createGLTFLoader } from "vendor:gltf-loader";

export const MODEL_GLTF_CACHE = /* @__PURE__ */ new Map();
export function createGltfLoader() {
  return createGLTFLoader();
}
export const MODEL_TEXTURE_SLOTS = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "lightMap", "displacementMap", "alphaMap"];
export function isTextureBad(tex) {
  if (!tex) return false;
  if (tex.image == null) return true;
  return tex.image.width === 0 || tex.image.height === 0;
}
export function repairClonedModelTextures(model) {
  let foundBad = false;
  const seenMaterials = /* @__PURE__ */ new Set();
  model.traverse((child) => {
    if (!child?.isMesh || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    let needNewArray = false;
    for (let i = 0; i < mats.length; i++) {
      const mat = mats[i];
      if (!mat || seenMaterials.has(mat)) continue;
      let hasBad = false;
      for (let s = 0; s < MODEL_TEXTURE_SLOTS.length; s++) {
        if (isTextureBad(mat[MODEL_TEXTURE_SLOTS[s]])) { hasBad = true; break; }
      }
      if (!hasBad) { seenMaterials.add(mat); continue; }
      foundBad = true;
      const repaired = mat.clone();
      for (let s = 0; s < MODEL_TEXTURE_SLOTS.length; s++) {
        const slot = MODEL_TEXTURE_SLOTS[s];
        if (isTextureBad(repaired[slot])) repaired[slot] = null;
      }
      repaired.needsUpdate = true;
      seenMaterials.add(repaired);
      if (Array.isArray(child.material)) {
        if (!needNewArray) { child.material = child.material.slice(); needNewArray = true; }
        child.material[i] = repaired;
      } else {
        child.material = repaired;
      }
    }
  });
  return foundBad;
}
export async function parseCachedModel(loader, modelUrl) {
  const gltf = await loader.loadAsync(modelUrl);
  return gltf.scene;
}
export function cloneCachedModelInstance(sourceModel) {
  const model = sourceModel.clone(true);
  model.traverse((child) => {
    if (!child.isMesh || !child.morphTargetInfluences) return;
    child.morphTargetInfluences = child.morphTargetInfluences.slice();
  });
  return model;
}
export async function loadModelAsset(loader, modelUrl, cacheKey = modelUrl) {
  let cached = MODEL_GLTF_CACHE.get(cacheKey);
  if (!cached) {
    cached = parseCachedModel(loader, modelUrl).catch((error22) => {
      MODEL_GLTF_CACHE.delete(cacheKey);
      throw error22;
    });
    MODEL_GLTF_CACHE.set(cacheKey, cached);
  }
  const sourceModel = await cached;
  const clone = cloneCachedModelInstance(sourceModel);
  if (repairClonedModelTextures(clone)) {
    MODEL_GLTF_CACHE.delete(cacheKey);
  }
  return clone;
}
