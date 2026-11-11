import { AmbientLight, Box3, DirectionalLight, Group, PerspectiveCamera, SRGBColorSpace, Scene, Vector3, WebGLRenderer } from "vendor:three";
import { createGltfLoader, loadModelAsset } from "./model-loader.js";
import { MOON_MODEL_URL } from "../assets.js";

export function createMoonIconScene(container, options = {}) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  const loader = createGltfLoader();
  const root = new Group();
  let destroyed = false;
  let frameId = 0;
  let isDocumentVisible = document.visibilityState !== "hidden";
  let isCardVisible = true;
  let lastRenderedMs = 0;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  container.innerHTML = "";
  container.appendChild(renderer.domElement);
  scene.add(root);
  const ambient = new AmbientLight(16777215, 0.07);
  const key = new DirectionalLight(16777215, 2.4);
  key.position.set(1.6, 2.2, 3);
  scene.add(ambient);
  scene.add(key);
  camera.position.set(0, 0, 4.6);
  camera.lookAt(0, 0, 0);
  function clearRoot() {
    for (let i = root.children.length - 1; i >= 0; i--) {
      const child = root.children[i];
      root.remove(child);
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
  function fitObject(object) {
    const box = new Box3().setFromObject(object);
    if (box.isEmpty()) return;
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2.3 / maxDim;
    object.scale.setScalar(scale);
    object.position.sub(center.multiplyScalar(scale));
  }
  async function loadMoon() {
    const modelUrl = options.modelUrl || MOON_MODEL_URL;
    const moon = await loadModelAsset(loader, modelUrl);
    if (destroyed) return;
    clearRoot();
    fitObject(moon);
    root.add(moon);
  }
  function setLightFromAzimuthElevation(azimuthDeg, elevationDeg) {
    const az = Number(azimuthDeg);
    const el = Number(elevationDeg);
    if (!Number.isFinite(az) || !Number.isFinite(el)) return false;
    const azRad = (az % 360 + 360) % 360 * Math.PI / 180;
    const elRad = Math.max(-90, Math.min(90, el)) * Math.PI / 180;
    const horizontal = Math.cos(elRad);
    const x = Math.sin(azRad) * horizontal;
    const y = -Math.sin(elRad);
    const z = -Math.cos(azRad) * horizontal;
    key.position.set(x * 3.2, y * 3.2, z * 3.2);
    key.intensity = Math.max(1.4, 2 + Math.max(0, y) * 1.2);
    return true;
  }
  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const onDocumentVisibilityChange = () => {
    isDocumentVisible = document.visibilityState !== "hidden";
  };
  document.addEventListener("visibilitychange", onDocumentVisibilityChange);
  let visibilityObserver = null;
  if (typeof IntersectionObserver !== "undefined") {
    visibilityObserver = new IntersectionObserver((entries) => {
      isCardVisible = entries[0]?.isIntersecting !== false;
    }, { threshold: 0.01 });
    visibilityObserver.observe(container);
  }
  resize();
  setLightFromAzimuthElevation(
    options.initialMoonAzimuthDegrees,
    options.initialMoonElevationDegrees
  );
  loadMoon().catch((error) => {
    console.error("Failed to load moon icon scene", error);
  });
  function render(nowMs = performance.now()) {
    if (destroyed) return;
    frameId = requestAnimationFrame(render);
    if (!isDocumentVisible || !isCardVisible || nowMs - lastRenderedMs < 1000 / 30) return;
    lastRenderedMs = nowMs;
    const t = nowMs * 1e-3;
    root.rotation.y = t * Math.PI * 2 * 0.012;
    renderer.render(scene, camera);
  }
  render();
  return {
    setLightFromAzimuthElevation,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      visibilityObserver?.disconnect?.();
      document.removeEventListener("visibilitychange", onDocumentVisibilityChange);
      clearRoot();
      renderer.dispose();
      container.innerHTML = "";
    }
  };
}
