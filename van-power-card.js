import {
  AmbientLight2,
  BackSide2,
  Box32,
  BufferGeometry2,
  CanvasTexture2,
  Color2,
  DirectionalLight2,
  Float32BufferAttribute2,
  GLTFLoader,
  Group2,
  LineBasicMaterial2,
  LineLoop2,
  LineSegments2,
  Mesh2,
  MeshBasicMaterial2,
  MeshStandardMaterial2,
  Object3D2,
  PerspectiveCamera2,
  PlaneGeometry2,
  Points2,
  PointsMaterial2,
  RepeatWrapping2,
  Scene2,
  SpotLight2,
  Sprite2,
  SpriteMaterial2,
  SRGBColorSpace2,
  TextureLoader2,
  Vector32,
  WebGLRenderer
} from "./van-power-card-deps.js";
if (typeof window !== "undefined" && typeof window.createImageBitmap === "function") {
  const _origCIB = window.createImageBitmap;
  const _cibLimit = /Android/i.test(navigator?.userAgent || "") ? 1 : 3;
  let _cibActive = 0;
  const _cibQueue = [];
  function _drainCIB() {
    while (_cibActive < _cibLimit && _cibQueue.length) _cibQueue.shift()();
  }
  window.createImageBitmap = function() {
    const args = arguments;
    return new Promise(function(resolve, reject) {
      function run() {
        _cibActive++;
        _origCIB.apply(window, args).then(
          function(r) { _cibActive--; _drainCIB(); resolve(r); },
          function(e) { _cibActive--; _drainCIB(); reject(e); }
        );
      }
      if (_cibActive < _cibLimit) { run(); } else { _cibQueue.push(run); }
    });
  };
}
var MODEL_GLTF_CACHE = /* @__PURE__ */ new Map();
var VAN_MODEL_URL = new URL("./van.glb", import.meta.url).toString();
var GROUND_GRASS_ALBEDO_URL = new URL("./ground/albedo.png", import.meta.url).toString();
var GROUND_GRASS_AO_URL = new URL("./ground/ao.png", import.meta.url).toString();
var GROUND_GRASS_HEIGHT_URL = new URL("./ground/height.png", import.meta.url).toString();
var GROUND_GRASS_NORMAL_URL = new URL("./ground/normal-ogl.png", import.meta.url).toString();
var MODEL_TEXTURE_SLOTS = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "lightMap", "displacementMap", "alphaMap"];
function isTextureBad(tex) {
  if (!tex) return false;
  if (tex.image == null) return true;
  return tex.image.width === 0 || tex.image.height === 0;
}
function repairClonedModelTextures(model) {
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
async function parseCachedModel(loader, modelUrl) {
  const gltf = await loader.loadAsync(modelUrl);
  return gltf.scene;
}
function cloneCachedModelInstance(sourceModel) {
  const model = sourceModel.clone(true);
  model.traverse((child) => {
    if (!child.isMesh || !child.morphTargetInfluences) return;
    child.morphTargetInfluences = child.morphTargetInfluences.slice();
  });
  return model;
}
async function loadModelAsset(loader, modelUrl, cacheKey = modelUrl) {
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
function createVanScene(container, options = {}) {
  const lowPowerMode = options.lowPowerMode === true || options.lowPowerMode === "true";
  const configuredMaxPixelRatio = Number(options.maxPixelRatio);
  const maxPixelRatio = Math.max(0.5, Math.min(2, Number.isFinite(configuredMaxPixelRatio) ? configuredMaxPixelRatio : lowPowerMode ? 1 : 1.5));
  const configuredFpsLimit = Number(options.fpsLimit);
  const fpsLimit = Math.max(1, Math.min(60, Number.isFinite(configuredFpsLimit) && configuredFpsLimit > 0 ? configuredFpsLimit : lowPowerMode ? 15 : 30));
  const renderer = new WebGLRenderer({
    antialias: !lowPowerMode,
    alpha: true,
    powerPreference: lowPowerMode ? "low-power" : "high-performance"
  });
  const scene = new Scene2();
  const camera = new PerspectiveCamera2(34, 1, 0.1, 100);
  const loader = new GLTFLoader();
  const modelUrl = options.modelUrl || VAN_MODEL_URL;
  const morphTargetName = options.morphTargetName || "Key 1";
  const canvas = renderer.domElement;
  let destroyed = false;
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    cancelAnimationFrame(frameId);
    destroyed = true;
    options.onContextLost?.();
  }, false);
  canvas.addEventListener("webglcontextrestored", () => {
    options.onContextRestored?.();
  }, false);
  const rootGroup = new Group2();
  const modelGroup = new Group2();
  const labelGroup = new Group2();
  const compassGroup = new Group2();
  let rotationY = options.initialRotationY ?? 0.6034306640624976;
  let targetRotationY = rotationY;
  let targetPitch = options.initialPitch ?? -0.7;
  let pitch = targetPitch;
  const minPitch = -0.7;
  const maxPitch = 1.5;
  let radius = options.initialRadius ?? 14.876033057851238;
  const minRadius = options.minRadius ?? 7;
  const maxRadius = options.maxRadius ?? 18;
  let lookAtY = options.lookAtY ?? 1.22;
  let labelsSpinWithModel = Boolean(options.labelsSpinWithModel);
  let frameId = 0;
  let pointerId = null;
  let pointerDown = false;
  let pointerDownAtMs = 0;
  const activePointers = /* @__PURE__ */ new Map();
  let pinchStartDistance = 0;
  let pinchStartRadius = 0;
  let hadPinchGesture = false;
  let lastX = 0;
  let lastY = 0;
  let pointerDownX = 0;
  let pointerDownY = 0;
  let yawVel = 0;
  let baseYawVel = (options.autoRotateSpeed ?? 0.2) / 60;
  let spinEnabled = lowPowerMode ? options.autoRotate === true : options.autoRotate !== false;
  let velHistory = [];
  let renderDirty = true;
  let isCardVisible = true;
  let isDocumentVisible = document.visibilityState !== "hidden";
  let visibilityObserver = null;
  const morphTargets = [];
  const modelLights = [];
  const modelSpotLights = [];
  const awningPickMeshes = [];
  const grillPickMeshes = [];
  const cameraPickAnchors = [];
  const starlinkPickAnchors = [];
  let modelLightsEnabled = options.initialModelLightsEnabled !== false;
  let modelLightsLevel = options.initialModelLightsLevel ?? 1;
  let modelLightLevels = [];
  const modelSpotConeDegrees = Number(options.modelLightConeDegrees);
  const modelSpotFullConeDegrees = Number.isFinite(modelSpotConeDegrees) ? modelSpotConeDegrees : 160;
  const modelSpotHalfAngle = Math.max(0, Math.min(Math.PI / 2, modelSpotFullConeDegrees * Math.PI / 360));
  const modelSpotDistance = Math.max(0, Number(options.modelLightDistance) || 26);
  const modelSpotPenumbra = Math.max(0, Math.min(1, Number(options.modelLightPenumbra) || 0.45));
  const modelSpotIntensityBoost = Math.max(0, Number(options.modelLightIntensityBoost) || 6);
  const modelLightAnchorNames = Array.isArray(options.modelLightAnchorNames) && options.modelLightAnchorNames.length ? options.modelLightAnchorNames.map((name) => String(name)) : ["Front Light", "Rear Light"];
  const cameraAnchorNames = Array.isArray(options.cameraAnchorNames) && options.cameraAnchorNames.length ? options.cameraAnchorNames.map((name) => String(name)) : ["CameraLeft", "CameraRight"];
  const starlinkAnchorNames = Array.isArray(options.starlinkAnchorNames) && options.starlinkAnchorNames.length ? options.starlinkAnchorNames.map((name) => String(name)) : ["Starlink"];
  const modelLightPickLocal = new Vector32();
  const modelLightPickWorldCenter = new Vector32();
  const modelLightPickDefaultCenter = new Vector32(0, 0, 0);
  const cameraPickLocal = new Vector32();
  const cameraPickWorldCenter = new Vector32();
  const cameraPickDefaultCenter = new Vector32(0, 0, 0);
  const cameraPickProjected = new Vector32();
  const starlinkPickLocal = new Vector32();
  const starlinkPickWorldCenter = new Vector32();
  const starlinkPickDefaultCenter = new Vector32(0, 0, 0);
  const starlinkPickProjected = new Vector32();
  const anchorBoundsWorldCenter = new Vector32();
  const anchorBoundsWorldBox = new Box32();
  const anchorBoundsCorners = [
    new Vector32(),
    new Vector32(),
    new Vector32(),
    new Vector32(),
    new Vector32(),
    new Vector32(),
    new Vector32(),
    new Vector32()
  ];
  const awningPickWorldBox = new Box32();
  const awningPickCorners = [
    new Vector32(),
    new Vector32(),
    new Vector32(),
    new Vector32(),
    new Vector32(),
    new Vector32(),
    new Vector32(),
    new Vector32()
  ];
  const awningPickProjected = new Vector32();
  const grillPickWorldBox = new Box32();
  const grillPickProjected = new Vector32();
  const grillPickUpperWorldCenter = new Vector32();
  const grillPickLowerWorldCenter = new Vector32();
  function getAnchorLocalCenter(anchorObject) {
    const center = new Vector32(0, 0, 0);
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
  function clearModelSpotLights() {
    for (let i = 0; i < modelSpotLights.length; i++) {
      const entry = modelSpotLights[i];
      const spot = entry?.spot;
      const target = entry?.target;
      spot?.removeFromParent?.();
      target?.removeFromParent?.();
    }
    modelSpotLights.length = 0;
  }
  function createModelSpotLight(anchorObject) {
    const color = anchorObject?.color?.clone?.() || 16777215;
    const baseIntensity = Number(anchorObject?.intensity);
    const normalizedBaseIntensity = Number.isFinite(baseIntensity) && baseIntensity > 0 ? baseIntensity : 1;
    anchorObject.userData.__baseIntensity = normalizedBaseIntensity;
    const localCenter = getAnchorLocalCenter(anchorObject);
    anchorObject.userData.__pickLocalCenter = localCenter.clone();
    const spot = new SpotLight2(
      color,
      normalizedBaseIntensity,
      modelSpotDistance,
      modelSpotHalfAngle,
      modelSpotPenumbra,
      2
    );
    spot.position.copy(localCenter);
    const target = new Object3D2();
    const sideSign = localCenter.x >= 0 ? 1 : -1;
    const outward = new Vector32(sideSign, -1, 0).normalize();
    target.position.copy(localCenter).addScaledVector(outward, 1);
    anchorObject.add(spot);
    anchorObject.add(target);
    spot.target = target;
    spot.visible = false;
    modelSpotLights.push({ spot, target });
    if (anchorObject.isLight) {
      anchorObject.visible = false;
      anchorObject.intensity = 0;
    }
  }
  const lightPickProjected = new Vector32();
  let morphValue = 0;
  let targetMorphValue = 0;
  const labelEntries = /* @__PURE__ */ new Map();
  const labelSpecs = options.labelSpecs || {
    grid: { angle: -2.72, radius: 3.55, y: -0.22, scale: 1.45, title: "HOOKUP" },
    battery: { angle: -0.78, radius: 3.45, y: -0.22, scale: 1.45, title: "BATTERY" },
    alternator: { angle: 2.45, radius: 3.1, y: -0.22, scale: 1.45, title: "ALTERNATOR" },
    solar: { angle: 0.62, radius: 2.85, y: -0.22, scale: 1.55, title: "SOLAR" }
  };
  function requestSceneRender() {
    renderDirty = true;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
  renderer.outputColorSpace = SRGBColorSpace2;
  renderer.setClearColor(0, 0);
  container.innerHTML = "";
  container.appendChild(canvas);
  scene.add(rootGroup);
  scene.add(labelGroup);
  labelGroup.visible = options.labelsVisible !== false;
  rootGroup.add(modelGroup);
  rootGroup.add(compassGroup);
  compassGroup.visible = options.compassVisible !== false;
  const lightingModes = ["studio", "spotlight"];
  const lightingPresets = options.lightingPresets || {
    studio: { ambient: 2.2, front: 1.6, rear: 1.3, side: 0.9, env: 1 },
    spotlight: { ambient: 0.18, front: 0.28, rear: 0.18, side: 0.1, env: 0.12 }
  };
  let lightingMode = lightingModes.includes(options.initialLightingMode) ? options.initialLightingMode : "studio";
  let currentLightingPreset = lightingPresets[lightingMode] || lightingPresets.studio;
  const ambientLight = new AmbientLight2(16777215, 2.2);
  scene.add(ambientLight);
  const frontLight = new DirectionalLight2(16777215, 1.6);
  frontLight.position.set(8, 9, 10);
  scene.add(frontLight);
  const rearLight = new DirectionalLight2(16777215, 1.3);
  rearLight.position.set(-8, 7, -10);
  scene.add(rearLight);
  const sideLight = new DirectionalLight2(16777215, 0.9);
  sideLight.position.set(0, 6, -12);
  scene.add(sideLight);
  const sunLight = new DirectionalLight2(16777215, 0);
  sunLight.position.set(0, 26, 18);
  scene.add(sunLight);
  function buildSunSpriteTexture() {
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
    const texture = new CanvasTexture2(canvas2);
    texture.colorSpace = SRGBColorSpace2;
    texture.needsUpdate = true;
    return texture;
  }
  const sunSpriteTexture = buildSunSpriteTexture();
  const sunSpriteMaterial = new SpriteMaterial2({
    map: sunSpriteTexture,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    opacity: 0
  });
  const sunSprite = new Sprite2(sunSpriteMaterial);
  sunSprite.scale.set(4.6, 4.6, 1);
  sunSprite.visible = false;
  scene.add(sunSprite);
  const STAR_COUNT = 3600;
  const STAR_MIN_RADIUS = 56;
  const STAR_MAX_RADIUS = 76;
  const STAR_MIN_Y = -0.06;
  const STAR_GROUP_COUNT = 14;
  const starPositionGroups = Array.from({ length: STAR_GROUP_COUNT }, () => []);
  for (let i = 0; i < STAR_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const y = STAR_MIN_Y + Math.random() * (1 - STAR_MIN_Y);
    const planar = Math.sqrt(Math.max(0, 1 - y * y));
    const radius = STAR_MIN_RADIUS + Math.random() * (STAR_MAX_RADIUS - STAR_MIN_RADIUS);
    const group = starPositionGroups[Math.floor(Math.random() * STAR_GROUP_COUNT)];
    group.push(
      Math.cos(theta) * planar * radius,
      y * radius,
      Math.sin(theta) * planar * radius
    );
  }
  const starFields = [];
  for (let i = 0; i < STAR_GROUP_COUNT; i++) {
    const positions = starPositionGroups[i];
    if (!positions.length) continue;
    const starsGeometry = new BufferGeometry2();
    starsGeometry.setAttribute("position", new Float32BufferAttribute2(new Float32Array(positions), 3));
    const starsMaterial = new PointsMaterial2({
      color: 16777215,
      size: 0.24,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false
    });
    const stars = new Points2(starsGeometry, starsMaterial);
    stars.visible = false;
    scene.add(stars);
    starFields.push({
      geometry: starsGeometry,
      material: starsMaterial,
      points: stars,
      phase: Math.random() * Math.PI * 2,
      speed: 1.1 + Math.random() * 2.4,
      amplitude: 0.55 + Math.random() * 0.45
    });
  }
  let starsBaseOpacity = 0;
  let starsWeatherVisibility = 1;
  let sunIntensityScale = Math.max(0, Math.min(5, Number(options.initialSunIntensityScale) || 2.45));
  let sunriseTimeMs = null;
  let sunsetTimeMs = null;
  let sunSimulationProgress = null;
  let sunLatitude = null;
  let sunLongitude = null;
  let currentSunElevationDeg = NaN;
  let forcedNight = Boolean(options.initialNightMode);
  let sunBelowHorizon = true;
  let sunNightByTimes = null;
  let nightBackgroundActive = null;
  let vanHeadingDeg = null;
  let vanHeadingOffsetDeg = Number.isFinite(Number(options.initialVanHeadingOffsetDegrees)) ? Number(options.initialVanHeadingOffsetDegrees) : 0;
  let lastEnvironmentIntensity = null;
  const SUN_DISTANCE = 6;
  const SUN_HORIZON_Y = 1.8;
  const SUN_ELEVATION_TAN_SCALE = 7.2;
  function clamp(value, min, max2) {
    return Math.max(min, Math.min(max2, value));
  }
  function mix(from, to, alpha) {
    return from + (to - from) * alpha;
  }
  const weatherGroup = new Group2();
  scene.add(weatherGroup);
  const WEATHER_RECIPES = {
    sunny: { label: "Sunny", cloud: 0.08, fog: 4e-4, precipType: "none", precipRate: 0, wind: 0.3, storm: 0, wetness: 0, snow: 0 },
    "clear-night": { label: "Clear Night", cloud: 0.04, fog: 8e-4, precipType: "none", precipRate: 0, wind: 0.2, storm: 0, wetness: 0, snow: 0 },
    partlycloudy: { label: "Partly Cloudy", cloud: 0.42, fog: 18e-4, precipType: "none", precipRate: 0, wind: 0.42, storm: 0, wetness: 0.04, snow: 0 },
    cloudy: { label: "Cloudy", cloud: 0.95, fog: 52e-4, precipType: "none", precipRate: 0, wind: 0.48, storm: 0, wetness: 0.08, snow: 0 },
    fog: { label: "Fog", cloud: 1, fog: 0.016, precipType: "none", precipRate: 0, wind: 0.18, storm: 0, wetness: 0.12, snow: 0 },
    rainy: { label: "Rain", cloud: 0.98, fog: 95e-4, precipType: "rain", precipRate: 0.58, wind: 0.58, storm: 0, wetness: 0.62, snow: 0 },
    pouring: { label: "Pouring", cloud: 1, fog: 0.015, precipType: "rain", precipRate: 1, wind: 0.82, storm: 0, wetness: 1, snow: 0 },
    snowy: { label: "Snow", cloud: 0.9, fog: 0.011, precipType: "snow", precipRate: 0.58, wind: 0.5, storm: 0, wetness: 0.2, snow: 0.72 },
    "snowy-rainy": { label: "Snow/Rain", cloud: 0.96, fog: 0.013, precipType: "sleet", precipRate: 0.72, wind: 0.62, storm: 0, wetness: 0.64, snow: 0.36 },
    hail: { label: "Hail", cloud: 1, fog: 0.016, precipType: "hail", precipRate: 0.74, wind: 0.88, storm: 0, wetness: 0.84, snow: 0.08 },
    lightning: { label: "Lightning", cloud: 1, fog: 0.016, precipType: "none", precipRate: 0, wind: 0.82, storm: 0.95, wetness: 0.18, snow: 0 },
    "lightning-rainy": { label: "Lightning Rain", cloud: 1, fog: 0.014, precipType: "rain", precipRate: 0.86, wind: 0.92, storm: 1, wetness: 0.94, snow: 0 },
    windy: { label: "Windy", cloud: 0.28, fog: 17e-4, precipType: "none", precipRate: 0, wind: 1, storm: 0, wetness: 0.04, snow: 0 },
    "windy-variant": { label: "Windy Cloudy", cloud: 0.92, fog: 45e-4, precipType: "none", precipRate: 0, wind: 1, storm: 0, wetness: 0.08, snow: 0 },
    exceptional: { label: "Exceptional", cloud: 1, fog: 0.014, precipType: "rain", precipRate: 0.9, wind: 1, storm: 0, wetness: 1, snow: 0.12 }
  };
  function normalizeWeatherCondition(raw) {
    const text = String(raw || "").trim().toLowerCase();
    if (!text) return "sunny";
    let normalized = text.startsWith("mdi:weather-") ? text.slice("mdi:weather-".length) : text;
    normalized = normalized.replace(/_/g, "-");
    const aliasMap = {
      "clear-day": "sunny",
      "partly-cloudy-day": "partlycloudy",
      "partly-cloudy-night": "partlycloudy",
      "clear-night": "clear-night",
      rain: "rainy",
      sleet: "snowy-rainy",
      snow: "snowy",
      wind: "windy",
      "windy-variant": "windy-variant",
      "partly-cloudy": "partlycloudy"
    };
    const aliased = aliasMap[normalized] || normalized;
    return WEATHER_RECIPES[aliased] ? aliased : "sunny";
  }
  function buildWeatherSpriteTexture(drawMode = "cloud") {
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
          const softAlpha = Math.pow(alpha, 1.22);
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
    const texture = new CanvasTexture2(canvas2);
    texture.colorSpace = SRGBColorSpace2;
    texture.needsUpdate = true;
    return texture;
  }
  function createSkyDomeComponent(parent) {
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
      const geometry = new BufferGeometry2();
      geometry.setAttribute("position", new Float32BufferAttribute2(vertices, 3));
      geometry.setAttribute("uv", new Float32BufferAttribute2(uvs, 2));
      geometry.setIndex(indices);
      return geometry;
    }
    const canvas2 = document.createElement("canvas");
    canvas2.width = 1024;
    canvas2.height = 512;
    const texture = new CanvasTexture2(canvas2);
    texture.colorSpace = SRGBColorSpace2;
    const material = new MeshBasicMaterial2({
      map: texture,
      side: BackSide2,
      depthWrite: false,
      toneMapped: false
    });
    const geometry = createDomeGeometry();
    const mesh = new Mesh2(geometry, material);
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
      skyGrad.addColorStop(1, `rgb(${Math.max(6, topR * 0.4)},${Math.max(10, topG * 0.45)},${Math.max(16, topB * 0.5)})`);
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
    }
    function destroyComponent() {
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
      texture.dispose();
    }
    return { drawSky, destroy: destroyComponent };
  }
  function createGroundComponent(parent) {
    const size = 44;
    const geometry = new PlaneGeometry2(size, size, 180, 180);
    const uv = geometry.attributes?.uv;
    if (uv?.array?.slice) {
      geometry.setAttribute("uv2", new Float32BufferAttribute2(uv.array.slice(0), 2));
    }
    const alphaCanvas = document.createElement("canvas");
    alphaCanvas.width = 512;
    alphaCanvas.height = 512;
    const alphaCtx = alphaCanvas.getContext("2d");
    if (alphaCtx) {
      const center = alphaCanvas.width * 0.5;
      const alphaFade = alphaCtx.createRadialGradient(center, center, alphaCanvas.width * 0.31, center, center, alphaCanvas.width * 0.5);
      alphaFade.addColorStop(0, "rgba(255,255,255,1)");
      alphaFade.addColorStop(0.86, "rgba(255,255,255,0.96)");
      alphaFade.addColorStop(1, "rgba(255,255,255,0)");
      alphaCtx.fillStyle = alphaFade;
      alphaCtx.fillRect(0, 0, alphaCanvas.width, alphaCanvas.height);
    }
    const alphaTexture = new CanvasTexture2(alphaCanvas);
    alphaTexture.needsUpdate = true;
    const material = new MeshStandardMaterial2({
      color: new Color2(0.34, 0.47, 0.29),
      roughness: 0.9,
      metalness: 0.02,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      toneMapped: true,
      alphaMap: alphaTexture,
      displacementScale: 0.16,
      displacementBias: -0.03
    });
    const mesh = new Mesh2(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -1.04;
    parent.add(mesh);
    let groundDisposed = false;
    const loadedTextures = [];
    function configureTexture(texture, repeat) {
      if (!texture) return;
      texture.wrapS = RepeatWrapping2;
      texture.wrapT = RepeatWrapping2;
      texture.repeat.set(repeat, repeat);
      texture.needsUpdate = true;
      loadedTextures.push(texture);
    }
    function loadTexture(url) {
      return new Promise((resolve, reject) => {
        const textureLoader = new TextureLoader2();
        textureLoader.load(url, (texture) => {
          if (!texture.image || texture.image.width === 0 || texture.image.height === 0) {
            texture.dispose();
            reject(new Error(`Texture decoded as empty: ${url}`));
            return;
          }
          resolve(texture);
        }, void 0, () => {
          reject(new Error(`Unable to load texture ${url}`));
        });
      });
    }
    Promise.all([
      loadTexture(GROUND_GRASS_ALBEDO_URL),
      loadTexture(GROUND_GRASS_AO_URL),
      loadTexture(GROUND_GRASS_HEIGHT_URL),
      loadTexture(GROUND_GRASS_NORMAL_URL)
    ]).then(([albedoMap, aoMap, heightMap, normalMap]) => {
      if (groundDisposed) {
        albedoMap?.dispose?.();
        aoMap?.dispose?.();
        heightMap?.dispose?.();
        normalMap?.dispose?.();
        return;
      }
      albedoMap.colorSpace = SRGBColorSpace2;
      configureTexture(albedoMap, 14);
      configureTexture(aoMap, 14);
      configureTexture(heightMap, 14);
      configureTexture(normalMap, 14);
      material.map = albedoMap;
      material.aoMap = aoMap;
      material.aoMapIntensity = 1;
      material.displacementMap = heightMap;
      material.normalMap = normalMap;
      material.normalScale.set(1.08, 1.08);
      material.needsUpdate = true;
      requestSceneRender();
    }).catch(() => {
      material.color.setRGB(0.3, 0.42, 0.26);
      material.needsUpdate = true;
      requestSceneRender();
    });
    let lastDayFactor = -1;
    let lastWetness = -1;
    let lastSnow = -1;
    function setState(dayFactor, wetness, snowCover) {
      const day = clamp(dayFactor, 0, 1);
      const wet = clamp(wetness, 0, 1);
      const snow = clamp(snowCover, 0, 1);
      if (Math.abs(day - lastDayFactor) < 0.02 && Math.abs(wet - lastWetness) < 0.03 && Math.abs(snow - lastSnow) < 0.03) return;
      lastDayFactor = day;
      lastWetness = wet;
      lastSnow = snow;
      material.color.setRGB(
        clamp(mix(0.16, 0.38, day) * mix(1, 0.72, wet) * mix(1, 1.22, snow), 0, 1),
        clamp(mix(0.21, 0.56, day) * mix(1, 0.76, wet) * mix(1, 1.18, snow), 0, 1),
        clamp(mix(0.14, 0.33, day) * mix(1, 0.8, wet) * mix(1, 1.14, snow), 0, 1)
      );
      material.roughness = clamp(mix(0.9, 0.34, wet) + snow * 0.08, 0.18, 1);
      material.metalness = clamp(mix(0.02, 0.2, wet) - snow * 0.05, 0, 0.28);
      material.aoMapIntensity = clamp(1 + wet * 0.26 - snow * 0.12, 0.75, 1.3);
      material.displacementScale = clamp(mix(0.16, 0.09, snow) - wet * 0.03, 0.05, 0.24);
      const normalStrength = clamp(mix(3.4, 2.1, snow) * mix(1, 0.96, wet), 1.4, 4.2);
      material.normalScale.set(normalStrength, normalStrength);
      material.opacity = clamp(0.9 + day * 0.08 - wet * 0.08 - snow * 0.05, 0.72, 0.97);
      material.needsUpdate = true;
    }
    function destroyComponent() {
      groundDisposed = true;
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
      alphaTexture.dispose();
      for (let i = 0; i < loadedTextures.length; i++) {
        loadedTextures[i]?.dispose?.();
      }
    }
    return { setState, destroy: destroyComponent };
  }
  function createCloudComponent(parent) {
    const clusterCount = 56;
    const cloudTexture = buildWeatherSpriteTexture("cloud");
    const clusterData = [];
    let cloudsVisible = options.cloudsVisible !== false;
    const bandConfig = [
      { yMin: 2, ySpan: 1.5, radiusMin: 6.5, radiusSpan: 11, driftMul: 1.08, scaleMul: 1.08 },
      { yMin: 3.6, ySpan: 2, radiusMin: 9.8, radiusSpan: 13.5, driftMul: 0.82, scaleMul: 0.96 },
      { yMin: 5.4, ySpan: 2.6, radiusMin: 12.5, radiusSpan: 16.5, driftMul: 0.58, scaleMul: 0.9 }
    ];
    for (let i = 0; i < clusterCount; i++) {
      const anchor = new Object3D2();
      const bandIndex = i % bandConfig.length;
      const band = bandConfig[bandIndex];
      const angle = Math.random() * Math.PI * 2;
      const radiusCloud = band.radiusMin + Math.random() * band.radiusSpan;
      const baseX = Math.cos(angle) * radiusCloud;
      const baseZ = Math.sin(angle) * radiusCloud;
      const baseY = band.yMin + Math.random() * band.ySpan;
      const phase = Math.random() * Math.PI * 2;
      const drift = 0.25 + Math.random() * 0.95;
      const bob = 0.05 + Math.random() * 0.16;
      const puffCount = 6 + Math.floor(Math.random() * 5);
      const puffs = [];
      for (let p = 0; p < puffCount; p++) {
        const material = new SpriteMaterial2({
          map: cloudTexture,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
          depthTest: true,
          opacity: 0
        });
        const sprite = new Sprite2(material);
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
        baseX,
        baseY,
        baseZ,
        phase,
        drift,
        bob,
        puffs,
        bandDrift: band.driftMul,
        windOffsetX: (Math.random() * 2 - 1) * 0.9,
        windOffsetZ: (Math.random() * 2 - 1) * 0.9
      });
    }
    let activeCount = 0;
    let activeOpacity = 0;
    let activeDayFactor = 0.5;
    let activeWindStrength = 0;
    let activeHeightOffset = 0;
    let activeGrayness = 0;
    function applyVisibility() {
      for (let i = 0; i < clusterData.length; i++) {
        const cluster = clusterData[i];
        cluster.anchor.visible = cloudsVisible && i < activeCount && activeOpacity > 0.01;
      }
      requestSceneRender();
    }
    function setVisible(enabled) {
      const nextVisible = Boolean(enabled);
      if (cloudsVisible === nextVisible) return cloudsVisible;
      cloudsVisible = nextVisible;
      applyVisibility();
      return cloudsVisible;
    }
    function setState(nextCoverage, dayFactor, windStrength, heightOffset = 0, opacityBoost = 1, grayness = 0) {
      const coverage = clamp(nextCoverage, 0, 1);
      activeCount = Math.max(0, Math.min(clusterCount, Math.floor(mix(0, clusterCount, coverage * 0.95))));
      activeOpacity = mix(0.03, 0.36, coverage) * mix(0.74, 1.02, 1 - dayFactor) * clamp(opacityBoost, 0.6, 2.2);
      activeDayFactor = clamp(dayFactor, 0, 1);
      activeWindStrength = clamp(windStrength, 0, 1.4);
      activeHeightOffset = clamp(heightOffset, -3.2, 2);
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
          puff.material.opacity = clamp(activeOpacity * puff.opacitySeed, 0, 0.6);
          puff.material.color.setRGB(r, g, b);
        }
      }
    }
    function update(nowMs, dtSec, windX, windZ, sunPos, dayFactor, motionSpeed = 1, weatherCondition = "sunny", sunElevationDeg = NaN) {
      if (!cloudsVisible || activeCount <= 0) return;
      const speed = Math.max(0.4, Number(motionSpeed) || 1);
      const t = nowMs * 1e-3 * speed;
      const clampedDt = Math.max(1 / 240, Math.min(1 / 20, Number(dtSec) || 1 / 60));
      const nightFactor = 1 - dayFactor;
      const minCloudRingRadius = Math.max(9, radius + 0.9);
      const camLenXZ = Math.max(1e-3, Math.hypot(camera.position.x, camera.position.z));
      const camNx = camera.position.x / camLenXZ;
      const camNz = camera.position.z / camLenXZ;
      const maxFrontDot = -0.24;
      const windLen = Math.max(1e-3, Math.hypot(windX, windZ));
      const windDirX = windX / windLen;
      const windDirZ = windZ / windLen;
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
        const driftMul = 1.8 + activeWindStrength * 2.6;
        const windDriftSpeed = (0.35 + activeWindStrength * 1.95) * cluster.drift * cluster.bandDrift * speed;
        cluster.windOffsetX += windDirX * windDriftSpeed * clampedDt;
        cluster.windOffsetZ += windDirZ * windDriftSpeed * clampedDt;
        const maxWindOffset = 2.8 + activeWindStrength * 6.2;
        const windOffsetLen = Math.max(1e-3, Math.hypot(cluster.windOffsetX, cluster.windOffsetZ));
        if (windOffsetLen > maxWindOffset) {
          const shrink = maxWindOffset / windOffsetLen;
          cluster.windOffsetX *= shrink;
          cluster.windOffsetZ *= shrink;
        }
        let nextX = cluster.baseX + Math.sin(t * (0.035 + cluster.drift * 0.035) + cluster.phase) * 0.55 + cluster.windOffsetX * driftMul;
        let nextZ = cluster.baseZ + Math.cos(t * (0.032 + cluster.drift * 0.03) + cluster.phase * 1.4) * 0.55 + cluster.windOffsetZ * driftMul;
        const radialLen = Math.max(1e-3, Math.hypot(nextX, nextZ));
        if (radialLen < minCloudRingRadius) {
          const pushScale = minCloudRingRadius / radialLen;
          nextX *= pushScale;
          nextZ *= pushScale;
        }
        const nextLenXZ = Math.max(minCloudRingRadius, Math.hypot(nextX, nextZ));
        const nextNx = nextX / nextLenXZ;
        const nextNz = nextZ / nextLenXZ;
        const nearCameraDot = nextNx * camNx + nextNz * camNz;
        if (nearCameraDot > maxFrontDot) {
          const pushStrength = clamp((nearCameraDot - maxFrontDot) / (1 - maxFrontDot), 0, 1);
          const backAngle = Math.atan2(-camNz, -camNx);
          const spreadAngle = Math.sin(cluster.phase * 2.13 + cluster.drift * 3.7) * 0.92;
          const targetAngle = backAngle + spreadAngle;
          const targetNx = Math.cos(targetAngle);
          const targetNz = Math.sin(targetAngle);
          let blendedNx = mix(nextNx, targetNx, 0.45 + pushStrength * 0.55);
          let blendedNz = mix(nextNz, targetNz, 0.45 + pushStrength * 0.55);
          const blendedLen = Math.max(1e-3, Math.hypot(blendedNx, blendedNz));
          blendedNx /= blendedLen;
          blendedNz /= blendedLen;
          nextX = blendedNx * nextLenXZ;
          nextZ = blendedNz * nextLenXZ;
        }
        cluster.anchor.position.x = nextX;
        cluster.anchor.position.z = nextZ;
        cluster.anchor.position.y = cluster.baseY + activeHeightOffset + Math.sin(t * (0.21 + cluster.drift * 0.08) + cluster.phase * 0.5) * cluster.bob;
        cluster.anchor.rotation.y = Math.sin(t * 0.09 + cluster.phase) * 0.1;
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
          const scaleMul = (0.96 + activeWindStrength * 0.08) * puff.scaleSeed;
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
    return { setState, setVisible, update, destroy: destroyComponent };
  }
  function createPrecipComponent(parent) {
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
    const geometry = new BufferGeometry2();
    const attribute = new Float32BufferAttribute2(positions, 3);
    geometry.setAttribute("position", attribute);
    geometry.setDrawRange(0, 0);
    const rainTexture = buildWeatherSpriteTexture("rain");
    const hailTexture = buildWeatherSpriteTexture("hail");
    const snowTexture = buildWeatherSpriteTexture("snow");
    const material = new PointsMaterial2({
      color: 14540253,
      size: 0.18,
      map: rainTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
      sizeAttenuation: true
    });
    const points = new Points2(geometry, material);
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
      const rainCountMul = precipType === "rain" ? currentWeatherCondition === "pouring" ? 8 : currentWeatherCondition === "rainy" ? 5 : 1 : 1;
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
        material.size = currentWeatherCondition === "pouring" ? 0.26 : 0.22;
        material.opacity = (currentWeatherCondition === "pouring" ? 0.82 : 0.72) * nightBoost;
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
      const rainSpeedMul = precipType === "rain" && currentWeatherCondition === "pouring" ? 1.35 : 1;
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
  const skyComponent = createSkyDomeComponent(weatherGroup);
  const groundComponent = createGroundComponent(rootGroup);
  const cloudComponent = createCloudComponent(weatherGroup);
  const precipComponent = createPrecipComponent(weatherGroup);
  const materialSurfaceState = [];
  let currentWeatherCondition = "sunny";
  let currentWeatherRecipe = WEATHER_RECIPES.sunny;
  let weatherCloudAmount = currentWeatherRecipe.cloud;
  let weatherFogDensity = currentWeatherRecipe.fog;
  let weatherPrecipRate = currentWeatherRecipe.precipRate;
  let weatherWindAmount = currentWeatherRecipe.wind;
  let weatherWetness = currentWeatherRecipe.wetness;
  let weatherSnowCover = currentWeatherRecipe.snow;
  let weatherStormLevel = currentWeatherRecipe.storm;
  let stormNextFlashMs = 0;
  let stormFlashUntilMs = 0;
  let stormFlashAmount = 0;
  let nextSkyRedrawMs = 0;
  let weatherEnvMultiplier = 1;
  function cacheModelSurfaceMaterials(model) {
    materialSurfaceState.length = 0;
    const seenMaterials = /* @__PURE__ */ new Set();
    model.traverse((child) => {
      if (!child?.isMesh || !child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (let i = 0; i < materials.length; i++) {
        const material = materials[i];
        if (!material || seenMaterials.has(material)) continue;
        seenMaterials.add(material);
        materialSurfaceState.push({
          material,
          baseRoughness: Number.isFinite(material.roughness) ? material.roughness : null,
          baseMetalness: Number.isFinite(material.metalness) ? material.metalness : null,
          baseColor: material.color?.clone?.() || null
        });
      }
    });
  }
  function applyGroundResponse(wetness, snowCover) {
    const wet = clamp(wetness, 0, 1);
    const snow = clamp(snowCover, 0, 1);
    for (let i = 0; i < materialSurfaceState.length; i++) {
      const entry = materialSurfaceState[i];
      const material = entry.material;
      if (material.transparent === true || material.opacity < 0.99) continue;
      if (entry.baseRoughness != null && "roughness" in material) {
        material.roughness = clamp(mix(entry.baseRoughness, 0.24, wet), 0.05, 1);
        material.roughness = clamp(mix(material.roughness, 0.36, snow * 0.4), 0.05, 1);
      }
      if (entry.baseMetalness != null && "metalness" in material) {
        material.metalness = clamp(mix(entry.baseMetalness, Math.max(entry.baseMetalness, 0.18), wet * 0.55), 0, 1);
      }
      if (entry.baseColor && material.color) {
        material.color.copy(entry.baseColor);
        if (wet > 0) {
          material.color.multiplyScalar(mix(1, 0.965, wet * 0.4));
        }
        if (snow > 0) {
          material.color.lerp(new Color2(0.93, 0.94, 0.96), snow * 0.22);
        }
      }
    }
  }
  function setWeatherState(conditionRaw) {
    currentWeatherCondition = normalizeWeatherCondition(conditionRaw);
    currentWeatherRecipe = WEATHER_RECIPES[currentWeatherCondition] || WEATHER_RECIPES.sunny;
    requestSceneRender();
    return currentWeatherCondition;
  }
  function getWeatherState() {
    return currentWeatherCondition;
  }
  function updateWeatherEffects(nowMs, dtSec) {
    const dayFactor = clamp(sunLight.intensity / Math.max(0.001, sunIntensityScale * 1.55), 0, 1);
    const nightFactor = 1 - dayFactor;
    const windPulse = 0.88 + 0.12 * Math.sin(nowMs * 1e-3 * 0.24);
    const fogCloudBonus = currentWeatherCondition === "fog" ? 0.24 : 0;
    const targetCloud = clamp(currentWeatherRecipe.cloud + nightFactor * 0.06 + fogCloudBonus, 0, 1);
    const targetFog = clamp(currentWeatherRecipe.fog + nightFactor * 0.002, 0, 0.03);
    const targetPrecip = currentWeatherRecipe.precipRate;
    const targetWind = clamp(currentWeatherRecipe.wind * windPulse, 0, 1.2);
    const precipActive = currentWeatherRecipe.precipType !== "none" && currentWeatherRecipe.precipRate > 0.02;
    const wetSurfaceActive = precipActive && (currentWeatherRecipe.precipType === "rain" || currentWeatherRecipe.precipType === "sleet");
    const targetWetness = wetSurfaceActive ? 1 : 0;
    const targetSnow = currentWeatherRecipe.snow;
    const targetStorm = currentWeatherRecipe.storm;
    const blend = clamp(dtSec * 1.8, 0, 1);
    weatherCloudAmount = mix(weatherCloudAmount, targetCloud, blend);
    weatherFogDensity = mix(weatherFogDensity, targetFog, blend);
    weatherPrecipRate = mix(weatherPrecipRate, targetPrecip, blend);
    weatherWindAmount = mix(weatherWindAmount, targetWind, blend);
    const wetBlend = wetSurfaceActive ? blend : clamp(dtSec * 4.5, 0, 1);
    weatherWetness = mix(weatherWetness, targetWetness, wetBlend);
    weatherSnowCover = mix(weatherSnowCover, targetSnow, blend);
    weatherStormLevel = mix(weatherStormLevel, targetStorm, blend);
    const windAngle = nowMs * 1e-3 * 0.035;
    const windX = Math.cos(windAngle) * weatherWindAmount;
    const windZ = Math.sin(windAngle * 0.83 + 0.6) * weatherWindAmount;
    if (nowMs >= nextSkyRedrawMs || weatherStormLevel > 0.6) {
      nextSkyRedrawMs = nowMs + 120;
      skyComponent.drawSky({
        dayFactor,
        cloudAmount: weatherCloudAmount,
        fogDensity: weatherFogDensity,
        stormLevel: weatherStormLevel,
        sunX: sunLight.position.x,
        sunY: sunLight.position.y,
        sunZ: sunLight.position.z
      });
    }
    const fogCloudActive = currentWeatherCondition === "fog";
    const cloudHeightOffset = fogCloudActive ? -1.9 : 0;
    const cloudOpacityBoost = fogCloudActive ? 1.55 : 1;
    let cloudGrayness = clamp(weatherCloudAmount * 0.72 + weatherPrecipRate * 0.42 + weatherStormLevel * 0.66 + (fogCloudActive ? 0.18 : 0), 0, 1);
    if (currentWeatherCondition === "sunny" || currentWeatherCondition === "partlycloudy") {
      cloudGrayness = clamp(cloudGrayness * 0.62 - 0.08, 0, 1);
    }
    groundComponent.setState(dayFactor, weatherWetness, weatherSnowCover);
    cloudComponent.setState(weatherCloudAmount, dayFactor, weatherWindAmount, cloudHeightOffset, cloudOpacityBoost, cloudGrayness);
    const cloudMotionSpeed = currentWeatherCondition === "windy" || currentWeatherCondition === "windy-variant" ? 10 : 1;
    cloudComponent.update(nowMs, dtSec, windX, windZ, sunLight.position, dayFactor, cloudMotionSpeed, currentWeatherCondition, currentSunElevationDeg);
    precipComponent.setState(currentWeatherRecipe.precipType, weatherPrecipRate, dayFactor);
    precipComponent.update(nowMs, dtSec, windX, windZ, weatherWindAmount);
    if (weatherStormLevel > 0.2) {
      if (!stormNextFlashMs || nowMs >= stormNextFlashMs) {
        stormNextFlashMs = nowMs + 2200 + Math.random() * 7200 * (1.05 - Math.min(1, weatherStormLevel));
        stormFlashUntilMs = nowMs + 90 + Math.random() * 130;
        stormFlashAmount = 0.65 + Math.random() * 0.35;
      }
    } else {
      stormNextFlashMs = 0;
      stormFlashUntilMs = 0;
      stormFlashAmount = 0;
    }
    const flash = nowMs <= stormFlashUntilMs ? stormFlashAmount * weatherStormLevel : 0;
    const weatherLightMul = clamp(1 - weatherCloudAmount * 0.18 - weatherFogDensity * 11, 0.38, 1.1);
    ambientLight.intensity = currentLightingPreset.ambient * weatherLightMul + flash * 0.55;
    frontLight.intensity = currentLightingPreset.front * weatherLightMul + flash * 0.95;
    rearLight.intensity = currentLightingPreset.rear * weatherLightMul + flash * 0.65;
    sideLight.intensity = currentLightingPreset.side * weatherLightMul + flash * 0.7;
    const sunHeavyWeather = currentWeatherCondition === "cloudy" || currentWeatherCondition === "windy-variant" || currentWeatherRecipe.precipType !== "none" || weatherStormLevel > 0.15;
    const baseSunDim = clamp(1 - weatherCloudAmount * 0.72 - weatherFogDensity * 18 - weatherStormLevel * 0.55, 0.08, 1);
    const heavySunDim = sunHeavyWeather ? clamp(baseSunDim * 0.78, 0.06, 1) : baseSunDim;
    sunLight.intensity *= heavySunDim;
    sunLight.intensity += flash * 0.65;
    const elevationDeg = Number(currentSunElevationDeg);
    const twilightVisibility = Number.isFinite(elevationDeg) ? clamp((elevationDeg + 3.5) / 6.5, 0, 1) : 0;
    const baseVisualDay = Math.max(dayFactor, twilightVisibility * 0.35);
    const sunVisualStrength = clamp(baseVisualDay * heavySunDim * (1 - weatherCloudAmount * 0.7 - weatherStormLevel * 0.55), 0, 1);
    const shouldHideSunByTime = sunNightByTimes === true;
    const shouldHideSunByElevation = sunNightByTimes == null && Number.isFinite(elevationDeg) && elevationDeg < 0;
    sunSprite.visible = !(shouldHideSunByTime || shouldHideSunByElevation);
    if (sunSprite.visible) {
      const sunPosLen = Math.max(1e-3, Math.hypot(sunLight.position.x, sunLight.position.y, sunLight.position.z));
      const sunScale = 3.6 + sunVisualStrength * 4.1;
      sunSprite.position.set(
        sunLight.position.x / sunPosLen * (SUN_DISTANCE + 2),
        sunLight.position.y / sunPosLen * (SUN_DISTANCE + 2),
        sunLight.position.z / sunPosLen * (SUN_DISTANCE + 2)
      );
      sunSprite.scale.set(sunScale, sunScale, 1);
      sunSpriteMaterial.opacity = clamp(0.28 + sunVisualStrength * 0.92, 0, 1);
      sunSpriteMaterial.color.setRGB(
        mix(1, 1, dayFactor),
        mix(0.84, 0.94, dayFactor),
        mix(0.62, 0.82, dayFactor)
      );
    } else {
      sunSpriteMaterial.opacity = 0;
    }
    const envMultiplier = clamp(1 - weatherCloudAmount * 0.25 - weatherFogDensity * 12, 0.34, 1);
    if (Math.abs(envMultiplier - weatherEnvMultiplier) > 0.02) {
      weatherEnvMultiplier = envMultiplier;
      applyEnvironmentIntensity((currentLightingPreset.env || 1) * weatherEnvMultiplier);
    }
    starsWeatherVisibility = clamp(1 - weatherCloudAmount * 0.88 - weatherFogDensity * 14, 0.02, 1);
    applyGroundResponse(weatherWetness, weatherSnowCover);
  }
  function updateNightBackground() {
    const shouldUseNightBackground = forcedNight || sunBelowHorizon;
    if (nightBackgroundActive === shouldUseNightBackground) return;
    nightBackgroundActive = shouldUseNightBackground;
    renderer.setClearColor(shouldUseNightBackground ? 131844 : 1973790, shouldUseNightBackground ? 1 : 0);
  }
  function wrapDegrees(value) {
    return (value % 360 + 360) % 360;
  }
  function degToRad(value) {
    return value * Math.PI / 180;
  }
  function radToDeg(value) {
    return value * 180 / Math.PI;
  }
  function getVanBearingDeg() {
    if (!Number.isFinite(vanHeadingDeg)) return null;
    return wrapDegrees(vanHeadingDeg + vanHeadingOffsetDeg);
  }
  function getRelativeBearingDeg(worldBearingDeg, vanBearingDeg) {
    return wrapDegrees(worldBearingDeg - (Number.isFinite(vanBearingDeg) ? vanBearingDeg : 0));
  }
  function bearingDegToXZ(bearingDeg, radius) {
    const rad = degToRad(wrapDegrees(bearingDeg));
    return {
      x: Math.sin(rad) * radius,
      z: -Math.cos(rad) * radius
    };
  }
  function legacyAzimuthRadToBearingDeg(azimuthRad) {
    return wrapDegrees(180 - radToDeg(azimuthRad));
  }
  function getSolarPositionFromLatLon(date, latitudeDeg, longitudeDeg) {
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
  function elevationRadToSceneY(elevationRad) {
    const el = Number(elevationRad);
    if (!Number.isFinite(el)) return SUN_HORIZON_Y;
    const clampedEl = Math.max(-0.45, Math.min(1.25, el));
    return SUN_HORIZON_Y + Math.tan(clampedEl) * SUN_ELEVATION_TAN_SCALE;
  }
  function setSunLocation(latitude, longitude) {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      sunLatitude = null;
      sunLongitude = null;
      requestSceneRender();
      return false;
    }
    sunLatitude = clamp(lat, -90, 90);
    sunLongitude = clamp(lon, -180, 180);
    requestSceneRender();
    return true;
  }
  function setVanHeading(headingDeg, headingOffsetDeg) {
    const heading = Number(headingDeg);
    vanHeadingDeg = Number.isFinite(heading) ? wrapDegrees(heading) : null;
    const offset = Number(headingOffsetDeg);
    if (Number.isFinite(offset)) {
      vanHeadingOffsetDeg = offset;
    }
    updateCompassOrientation();
    requestSceneRender();
    return {
      headingDeg: vanHeadingDeg,
      headingOffsetDeg: vanHeadingOffsetDeg
    };
  }
  setSunLocation(options.latitude, options.longitude);
  setVanHeading(options.initialVanHeadingDegrees, options.initialVanHeadingOffsetDegrees);
  function applyEnvironmentIntensity(value) {
    if (Number.isFinite(lastEnvironmentIntensity) && Math.abs(lastEnvironmentIntensity - value) < 1e-3) return;
    lastEnvironmentIntensity = value;
    scene.environmentIntensity = value;
    modelGroup.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (material && "envMapIntensity" in material) {
          material.envMapIntensity = value;
        }
      });
    });
  }
  function applyLightingMode(mode) {
    const normalizedMode = lightingModes.includes(mode) ? mode : "studio";
    const preset = lightingPresets[normalizedMode] || lightingPresets.studio;
    lightingMode = normalizedMode;
    currentLightingPreset = preset;
    ambientLight.intensity = preset.ambient;
    frontLight.intensity = preset.front;
    rearLight.intensity = preset.rear;
    sideLight.intensity = preset.side;
    applyEnvironmentIntensity((preset.env || 1) * weatherEnvMultiplier);
    requestSceneRender();
    return lightingMode;
  }
  function setSunTimes(sunriseMs, sunsetMs) {
    const sunrise = Number(sunriseMs);
    const sunset = Number(sunsetMs);
    if (!Number.isFinite(sunrise) || !Number.isFinite(sunset)) {
      sunriseTimeMs = null;
      sunsetTimeMs = null;
      sunLight.intensity = 0;
      requestSceneRender();
      return false;
    }
    sunriseTimeMs = sunrise;
    sunsetTimeMs = sunset > sunrise ? sunset : sunset + 864e5;
    requestSceneRender();
    return true;
  }
  function setSunIntensityScale(value) {
    sunIntensityScale = Math.max(0, Math.min(5, Number(value) || 0));
    requestSceneRender();
    return sunIntensityScale;
  }
  function normalizeProgress(value) {
    if (value == null || value === "") return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return clamp(parsed, 0, 1);
  }
  function progressToNowMs(progress, nowMs = Date.now()) {
    const normalized = normalizeProgress(progress);
    if (!Number.isFinite(normalized)) return nowMs;
    const now = new Date(nowMs);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (Number.isFinite(sunLatitude) && Number.isFinite(sunLongitude)) {
      return startOfDay + normalized * 864e5;
    }
    if (Number.isFinite(sunriseTimeMs) && Number.isFinite(sunsetTimeMs)) {
      const daySpan = sunsetTimeMs - sunriseTimeMs;
      if (daySpan > 0) {
        return sunriseTimeMs + normalized * daySpan;
      }
    }
    return startOfDay + normalized * 864e5;
  }
  function getCurrentDayProgress(nowMs = Date.now()) {
    if (Number.isFinite(sunLatitude) && Number.isFinite(sunLongitude)) {
      const now = new Date(nowMs);
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return clamp((nowMs - startOfDay) / 864e5, 0, 1);
    }
    if (Number.isFinite(sunriseTimeMs) && Number.isFinite(sunsetTimeMs)) {
      const daySpan = sunsetTimeMs - sunriseTimeMs;
      if (daySpan > 0) {
        return clamp((nowMs - sunriseTimeMs) / daySpan, 0, 1);
      }
    }
    const now = new Date(nowMs);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return clamp((nowMs - startOfDay) / 864e5, 0, 1);
  }
  function setSunSimulationProgress(value) {
    sunSimulationProgress = normalizeProgress(value);
    requestSceneRender();
    return sunSimulationProgress;
  }
  function setNightMode(enabled) {
    forcedNight = Boolean(enabled);
    updateNightBackground();
    requestSceneRender();
    return forcedNight;
  }
  function toggleNightMode() {
    forcedNight = !forcedNight;
    updateNightBackground();
    requestSceneRender();
    return forcedNight;
  }
  function getSunSimulationProgress() {
    return sunSimulationProgress;
  }
  function getEffectiveSunNowMs(nowMs = Date.now()) {
    if (!Number.isFinite(sunSimulationProgress)) return nowMs;
    return progressToNowMs(sunSimulationProgress, nowMs);
  }
  function getNightFromSunTimes(nowMs) {
    if (!Number.isFinite(sunriseTimeMs) || !Number.isFinite(sunsetTimeMs)) return null;
    const dayMs = 864e5;
    let sunrise = sunriseTimeMs;
    let sunset = sunsetTimeMs;
    while (nowMs - sunrise > dayMs) {
      sunrise += dayMs;
      sunset += dayMs;
    }
    while (sunrise - nowMs > dayMs) {
      sunrise -= dayMs;
      sunset -= dayMs;
    }
    return nowMs < sunrise || nowMs >= sunset;
  }
  function setStarsOpacity(value) {
    const opacity = Math.max(0, Math.min(1, Number(value) || 0));
    starsBaseOpacity = opacity;
    const visible = opacity > 0.01;
    for (let i = 0; i < starFields.length; i++) {
      const field = starFields[i];
      field.material.opacity = opacity;
      field.points.visible = visible;
    }
  }
  function updateStarsTwinkle(nowMs) {
    if (starsBaseOpacity <= 0) {
      for (let i = 0; i < starFields.length; i++) {
        const field = starFields[i];
        field.material.opacity = 0;
        field.points.visible = false;
      }
      return;
    }
    const t = nowMs * 1e-3;
    for (let i = 0; i < starFields.length; i++) {
      const field = starFields[i];
      const twinkle = 0.72 + 0.16 * Math.sin(t * field.speed + field.phase) + 0.1 * Math.sin(t * (field.speed * 2.17) + field.phase * 1.9);
      const boosted = Math.max(0.2, Math.min(1.35, twinkle * field.amplitude));
      field.material.opacity = Math.max(0, Math.min(1, starsBaseOpacity * boosted * starsWeatherVisibility));
      field.points.visible = field.material.opacity > 0.01;
    }
  }
  function setNightVisualsFromElevationSin(elevationSin, nowMs) {
    const sinValue = Number(elevationSin);
    const nightFromTimes = getNightFromSunTimes(nowMs);
    if (nightFromTimes != null) {
      if (nightFromTimes) {
        setStarsOpacity(0.95);
        sunBelowHorizon = true;
      } else {
        setStarsOpacity(0);
        sunBelowHorizon = false;
      }
      updateNightBackground();
      return;
    }
    if (!Number.isFinite(sinValue) || sinValue <= 0) {
      const darkness = Number.isFinite(sinValue) ? Math.max(0.2, Math.min(1, -sinValue * 1.6 + 0.2)) : 1;
      setStarsOpacity(darkness * 0.95);
      sunBelowHorizon = true;
      updateNightBackground();
      return;
    }
    setStarsOpacity(0);
    sunBelowHorizon = false;
    updateNightBackground();
  }
  function updateSunLight(nowMs) {
    sunNightByTimes = getNightFromSunTimes(nowMs);
    const solarPosition = Number.isFinite(sunLatitude) && Number.isFinite(sunLongitude) ? getSolarPositionFromLatLon(new Date(nowMs), sunLatitude, sunLongitude) : null;
    if (solarPosition) {
      const worldBearingDeg = wrapDegrees(solarPosition.azimuthDeg);
      const relativeBearingDeg = getRelativeBearingDeg(worldBearingDeg, getVanBearingDeg());
      const pos = bearingDegToXZ(relativeBearingDeg, SUN_DISTANCE);
      const elevationRad = solarPosition.elevationRad;
      const elevationSin = Math.sin(elevationRad);
      sunLight.position.set(
        pos.x,
        elevationRadToSceneY(elevationRad),
        pos.z
      );
      if (elevationSin > 0) {
        sunLight.intensity = (0.06 + elevationSin * 1.55) * sunIntensityScale;
      } else {
        sunLight.intensity = 0;
      }
      currentSunElevationDeg = solarPosition.elevationDeg;
      setNightVisualsFromElevationSin(elevationSin, nowMs);
      return;
    }
    if (!Number.isFinite(sunriseTimeMs) || !Number.isFinite(sunsetTimeMs)) {
      sunLight.intensity = 0;
      currentSunElevationDeg = NaN;
      setNightVisualsFromElevationSin(NaN, nowMs);
      return;
    }
    const daySpan = sunsetTimeMs - sunriseTimeMs;
    if (daySpan <= 0) {
      sunLight.intensity = 0;
      currentSunElevationDeg = NaN;
      setNightVisualsFromElevationSin(NaN, nowMs);
      return;
    }
    const progress = (nowMs - sunriseTimeMs) / daySpan;
    const horizonBlendWindow = 0.06;
    if (progress <= -horizonBlendWindow || progress >= 1 + horizonBlendWindow) {
      sunLight.intensity = 0;
      currentSunElevationDeg = -6;
      setNightVisualsFromElevationSin(-1, nowMs);
      return;
    }
    const clampedProgress = clamp(progress, 0, 1);
    const azimuth = -1.12 + clampedProgress * 2.24;
    const worldBearingDeg = legacyAzimuthRadToBearingDeg(azimuth);
    const relativeBearingDeg = getRelativeBearingDeg(worldBearingDeg, getVanBearingDeg());
    const pos = bearingDegToXZ(relativeBearingDeg, SUN_DISTANCE);
    const elevation = Math.sin(clampedProgress * Math.PI);
    const elevationRad = Math.asin(clamp(elevation, -1, 1));
    let horizonFade = 1;
    if (progress < 0) {
      horizonFade = clamp(1 + progress / horizonBlendWindow, 0, 1);
    } else if (progress > 1) {
      horizonFade = clamp(1 - (progress - 1) / horizonBlendWindow, 0, 1);
    }
    sunLight.position.set(
      pos.x,
      elevationRadToSceneY(elevationRad),
      pos.z
    );
    sunLight.intensity = (0.08 + elevation * 1.45) * sunIntensityScale * horizonFade;
    currentSunElevationDeg = radToDeg(elevationRad) - (1 - horizonFade) * 4;
    setNightVisualsFromElevationSin(elevation, nowMs);
  }
  function clampModelLightsLevel(value) {
    return Math.max(0, Math.min(2, Number(value) || 0));
  }
  function clampUnit(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
  function applyModelLights() {
    const level = clampModelLightsLevel(modelLightsLevel);
    modelLightsLevel = level;
    if (!Array.isArray(modelLightLevels)) {
      modelLightLevels = [];
    }
    for (let i = 0; i < modelLights.length; i++) {
      const light = modelLights[i];
      const spotEntry = modelSpotLights[i];
      const baseIntensity = light.userData.__baseIntensity ?? light.intensity ?? 1;
      light.userData.__baseIntensity = baseIntensity;
      const perLightLevel = clampUnit(modelLightLevels[i] == null ? 1 : modelLightLevels[i]);
      const intensity = modelLightsEnabled ? baseIntensity * level * perLightLevel * modelSpotIntensityBoost : 0;
      if (light.isLight) {
        light.visible = false;
        light.intensity = 0;
      }
      if (spotEntry?.spot) {
        if (light.color && spotEntry.spot.color) {
          spotEntry.spot.color.copy(light.color);
        }
        spotEntry.spot.visible = intensity > 0;
        spotEntry.spot.intensity = intensity;
      }
    }
  }
  applyLightingMode(lightingMode);
  function createLabelEntry(name, spec) {
    const canvas2 = document.createElement("canvas");
    canvas2.width = 512;
    canvas2.height = 320;
    const texture = new CanvasTexture2(canvas2);
    texture.colorSpace = SRGBColorSpace2;
    const material = new SpriteMaterial2({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
      sizeAttenuation: true
    });
    const sprite = new Sprite2(material);
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
  function drawLabel(entry) {
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
  function createCompassLabelSprite(text) {
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
    const texture = new CanvasTexture2(canvas2);
    texture.colorSpace = SRGBColorSpace2;
    const material = new SpriteMaterial2({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false
    });
    return new Sprite2(material);
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
    const ringGeometry = new BufferGeometry2();
    ringGeometry.setAttribute("position", new Float32BufferAttribute2(ringVerts, 3));
    const ringMaterial = new LineBasicMaterial2({ color: 13421772, transparent: true, opacity: 0.55 });
    const ring = new LineLoop2(ringGeometry, ringMaterial);
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
    const tickGeometry = new BufferGeometry2();
    tickGeometry.setAttribute("position", new Float32BufferAttribute2(tickVerts, 3));
    const tickMaterial = new LineBasicMaterial2({ color: 11184810, transparent: true, opacity: 0.45 });
    const ticks = new LineSegments2(tickGeometry, tickMaterial);
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
  function updateLabelPositions() {
    labelEntries.forEach((entry) => {
      const orbit = labelsSpinWithModel ? rotationY : 0;
      const angle = entry.spec.angle + orbit;
      entry.sprite.position.set(
        Math.cos(angle) * entry.spec.radius,
        entry.spec.y,
        Math.sin(angle) * entry.spec.radius
      );
    });
  }
  Object.entries(labelSpecs).forEach(([name, spec]) => {
    const entry = createLabelEntry(name, spec);
    drawLabel(entry);
  });
  function updateCamera() {
    camera.position.set(
      Math.sin(rotationY) * radius,
      3.3 + pitch * 6,
      Math.cos(rotationY) * radius
    );
    camera.lookAt(0, lookAtY, 0);
  }
  function fitModel(object) {
    object.updateMatrixWorld(true);
    const box = getBaseModelBox(object);
    const size = new Vector32();
    const center = new Vector32();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 7.4 / maxDim;
    object.scale.setScalar(scale);
    object.updateMatrixWorld(true);
    box.copy(getBaseModelBox(object));
    box.getCenter(center);
    object.position.sub(center);
    object.updateMatrixWorld(true);
    box.copy(getBaseModelBox(object));
    object.position.y -= box.min.y + 1;
    object.updateMatrixWorld(true);
  }
  function getBaseGeometryBox(geometry) {
    if (geometry.userData.__basePositionBox) {
      return geometry.userData.__basePositionBox.clone();
    }
    const position = geometry.attributes?.position;
    const box = new Box32();
    if (!position) {
      box.makeEmpty();
      return box;
    }
    const min = new Vector32(Infinity, Infinity, Infinity);
    const max2 = new Vector32(-Infinity, -Infinity, -Infinity);
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      if (x < min.x) min.x = x;
      if (y < min.y) min.y = y;
      if (z < min.z) min.z = z;
      if (x > max2.x) max2.x = x;
      if (y > max2.y) max2.y = y;
      if (z > max2.z) max2.z = z;
    }
    box.min.copy(min);
    box.max.copy(max2);
    geometry.userData.__basePositionBox = box.clone();
    return box;
  }
  function getBaseModelBox(object) {
    const worldBox = new Box32().makeEmpty();
    const morphTargetName = options.morphTargetName || "Key 1";
    const corners = [
      new Vector32(),
      new Vector32(),
      new Vector32(),
      new Vector32(),
      new Vector32(),
      new Vector32(),
      new Vector32(),
      new Vector32()
    ];
    object.updateMatrixWorld(true);
    object.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;
      if (child.morphTargetDictionary && child.morphTargetDictionary[morphTargetName] != null) {
        return;
      }
      const baseBox = getBaseGeometryBox(child.geometry);
      if (baseBox.isEmpty()) return;
      const { min, max: max2 } = baseBox;
      corners[0].set(min.x, min.y, min.z).applyMatrix4(child.matrixWorld);
      corners[1].set(min.x, min.y, max2.z).applyMatrix4(child.matrixWorld);
      corners[2].set(min.x, max2.y, min.z).applyMatrix4(child.matrixWorld);
      corners[3].set(min.x, max2.y, max2.z).applyMatrix4(child.matrixWorld);
      corners[4].set(max2.x, min.y, min.z).applyMatrix4(child.matrixWorld);
      corners[5].set(max2.x, min.y, max2.z).applyMatrix4(child.matrixWorld);
      corners[6].set(max2.x, max2.y, min.z).applyMatrix4(child.matrixWorld);
      corners[7].set(max2.x, max2.y, max2.z).applyMatrix4(child.matrixWorld);
      for (const corner of corners) {
        worldBox.expandByPoint(corner);
      }
    });
    return worldBox;
  }
  async function loadModel() {
    const model = await loadModelAsset(loader, modelUrl);
    if (destroyed) return;
    fitModel(model);
    const fittedBox = getBaseModelBox(model);
    const fittedSize = new Vector32();
    fittedBox.getSize(fittedSize);
    const compassRadius = Math.max(fittedSize.x, fittedSize.z) * 0.72;
    const compassY = fittedBox.min.y - 0.04;
    createCompassUnderModel(compassRadius, compassY);
    modelGroup.clear();
    modelGroup.add(model);
    cacheModelSurfaceMaterials(model);
    morphTargets.length = 0;
    modelLights.length = 0;
    clearModelSpotLights();
    const discoveredModelLights = [];
    const namedNodeList = [];
    model.traverse((child) => {
      if (child?.name) {
        namedNodeList.push(child.name);
      }
      if (child.isLight) {
        discoveredModelLights.push(child);
      }
      if (!child.isMesh || !child.morphTargetDictionary || !child.morphTargetInfluences) return;
      const morphIndex = child.morphTargetDictionary[morphTargetName];
      if (morphIndex == null) return;
      morphTargets.push({ mesh: child, index: morphIndex });
    });
    console.info("van-power-card runtime node names", namedNodeList);
    const normalizeNodeName = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    awningPickMeshes.length = 0;
    grillPickMeshes.length = 0;
    cameraPickAnchors.length = 0;
    starlinkPickAnchors.length = 0;
    let awningNode = model.getObjectByName("Awning");
    let grillNode = model.getObjectByName("Grill");
    if (!awningNode) {
      const normalizedAwningName = normalizeNodeName("Awning");
      model.traverse((child) => {
        if (awningNode) return;
        if (!child?.name) return;
        if (normalizeNodeName(child.name) === normalizedAwningName) {
          awningNode = child;
        }
      });
    }
    if (!grillNode) {
      const normalizedGrillName = normalizeNodeName("Grill");
      model.traverse((child) => {
        if (grillNode) return;
        if (!child?.name) return;
        if (normalizeNodeName(child.name) === normalizedGrillName) {
          grillNode = child;
        }
      });
    }
    if (awningNode) {
      awningNode.traverse((child) => {
        if (child?.isMesh && child.geometry) {
          awningPickMeshes.push(child);
        }
      });
    }
    if (grillNode) {
      grillNode.traverse((child) => {
        if (child?.isMesh && child.geometry) {
          grillPickMeshes.push(child);
        }
      });
    }
    const cameraAnchorSet = /* @__PURE__ */ new Set();
    for (let i = 0; i < cameraAnchorNames.length; i++) {
      const anchorName = cameraAnchorNames[i];
      let anchor = model.getObjectByName(anchorName);
      if (!anchor) {
        const normalizedWanted = normalizeNodeName(anchorName);
        model.traverse((child) => {
          if (anchor) return;
          if (!child?.name) return;
          if (normalizeNodeName(child.name) === normalizedWanted) {
            anchor = child;
          }
        });
      }
      if (!anchor || cameraAnchorSet.has(anchor)) continue;
      cameraAnchorSet.add(anchor);
      cameraPickAnchors.push(anchor);
    }
    const starlinkAnchorSet = /* @__PURE__ */ new Set();
    for (let i = 0; i < starlinkAnchorNames.length; i++) {
      const anchorName = starlinkAnchorNames[i];
      let anchor = model.getObjectByName(anchorName);
      if (!anchor) {
        const normalizedWanted = normalizeNodeName(anchorName);
        model.traverse((child) => {
          if (anchor) return;
          if (!child?.name) return;
          if (normalizeNodeName(child.name) === normalizedWanted) {
            anchor = child;
          }
        });
      }
      if (!anchor || starlinkAnchorSet.has(anchor)) continue;
      starlinkAnchorSet.add(anchor);
      starlinkPickAnchors.push(anchor);
    }
    const anchorSet = /* @__PURE__ */ new Set();
    for (let i = 0; i < modelLightAnchorNames.length; i++) {
      const anchorName = modelLightAnchorNames[i];
      let anchor = model.getObjectByName(anchorName);
      if (!anchor) {
        const normalizedWanted = normalizeNodeName(anchorName);
        model.traverse((child) => {
          if (anchor) return;
          if (!child?.name) return;
          if (normalizeNodeName(child.name) === normalizedWanted) {
            anchor = child;
          }
        });
      }
      if (!anchor || anchorSet.has(anchor)) continue;
      anchorSet.add(anchor);
      modelLights.push(anchor);
      createModelSpotLight(anchor);
    }
    if (!modelLights.length) {
      for (let i = 0; i < discoveredModelLights.length; i++) {
        const light = discoveredModelLights[i];
        if (anchorSet.has(light)) continue;
        anchorSet.add(light);
        modelLights.push(light);
        createModelSpotLight(light);
      }
    }
    console.info("van-power-card model-light anchors", modelLights.map((anchor) => ({
      name: anchor?.name || "(unnamed)",
      isLight: Boolean(anchor?.isLight),
      pickLocalCenter: anchor?.userData?.__pickLocalCenter ? {
        x: Number(anchor.userData.__pickLocalCenter.x?.toFixed?.(3) ?? anchor.userData.__pickLocalCenter.x),
        y: Number(anchor.userData.__pickLocalCenter.y?.toFixed?.(3) ?? anchor.userData.__pickLocalCenter.y),
        z: Number(anchor.userData.__pickLocalCenter.z?.toFixed?.(3) ?? anchor.userData.__pickLocalCenter.z)
      } : null
    })));
    applyModelLights();
    applyLightingMode(lightingMode);
    applyMorphTargets(targetMorphValue);
  }
  loadModel().catch((error22) => {
    console.error("Failed to load van model", error22);
  });
  function applyMorphTargets(value) {
    morphValue = value;
    for (const target of morphTargets) {
      target.mesh.morphTargetInfluences[target.index] = morphValue;
    }
  }
  function notifyMorphChange(value) {
    if (typeof options.onMorphChange !== "function") return;
    try {
      options.onMorphChange(value);
    } catch (error22) {
      console.error("Failed to handle awning morph change", error22);
    }
  }
  function toggleMorphValue() {
    targetMorphValue = targetMorphValue >= 0.5 ? 0 : 1;
    notifyMorphChange(targetMorphValue);
    return targetMorphValue;
  }
  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestSceneRender();
  }
  function wrapAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }
  function shortestAngleDelta(from, to) {
    return wrapAngle(to - from);
  }
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
  function emitModelLightClick(index, detail = {}) {
    if (index < 0) return false;
    if (typeof options.onModelLightClick === "function") {
      try {
        options.onModelLightClick(index, detail);
      } catch (error22) {
        console.error("Failed to handle model light click", error22);
      }
      return true;
    }
    return false;
  }
  function emitGrillClick(index, detail = {}) {
    if (index < 0) return false;
    if (typeof options.onGrillClick === "function") {
      try {
        options.onGrillClick(index, detail);
      } catch (error22) {
        console.error("Failed to handle grill click", error22);
      }
      return true;
    }
    return false;
  }
  function emitCameraClick(index, detail = {}) {
    if (index < 0) return false;
    if (typeof options.onCameraClick === "function") {
      try {
        options.onCameraClick(index, detail);
      } catch (error22) {
        console.error("Failed to handle camera click", error22);
      }
      return true;
    }
    return false;
  }
  function emitStarlinkClick(index, detail = {}) {
    if (index < 0) return false;
    if (typeof options.onStarlinkClick === "function") {
      try {
        options.onStarlinkClick(index, detail);
      } catch (error22) {
        console.error("Failed to handle starlink click", error22);
      }
      return true;
    }
    return false;
  }
  function isHotspotAt(clientX, clientY) {
    if (isAwningClick(clientX, clientY)) return true;
    if (getGrillPickIndex(clientX, clientY) >= 0) return true;
    if (getCameraPickIndex(clientX, clientY) >= 0) return true;
    if (getStarlinkPickIndex(clientX, clientY) >= 0) return true;
    if (getModelLightPickIndex(clientX, clientY) >= 0) return true;
    return false;
  }
  function updateCanvasCursor(clientX, clientY) {
    if (!options.interactive) {
      canvas.style.cursor = "default";
      return;
    }
    if (pointerDown) {
      canvas.style.cursor = "grabbing";
      return;
    }
    if (Number.isFinite(clientX) && Number.isFinite(clientY) && isHotspotAt(clientX, clientY)) {
      canvas.style.cursor = "pointer";
      return;
    }
    canvas.style.cursor = "grab";
  }
  function getPointerDistance() {
    if (activePointers.size < 2) return 0;
    const entries = Array.from(activePointers.values());
    const a = entries[0];
    const b = entries[1];
    return Math.hypot(b.x - a.x, b.y - a.y);
  }
  function applyPinchZoom() {
    const distance = getPointerDistance();
    if (distance <= 0) return;
    if (pinchStartDistance <= 0) {
      pinchStartDistance = distance;
      pinchStartRadius = radius;
      return;
    }
    const scale = distance / pinchStartDistance;
    if (!Number.isFinite(scale) || scale <= 0) return;
    radius = Math.max(minRadius, Math.min(maxRadius, pinchStartRadius / scale));
  }
  function onPointerDown(event) {
    if (!options.interactive) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.size === 1) {
      pointerDown = true;
      pointerDownAtMs = Date.now();
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      pointerDownX = event.clientX;
      pointerDownY = event.clientY;
      velHistory = [];
      container.classList.add("is-dragging");
    } else if (activePointers.size >= 2) {
      hadPinchGesture = true;
      pointerDown = false;
      pointerId = null;
      pinchStartDistance = getPointerDistance();
      pinchStartRadius = radius;
      velHistory = [];
      container.classList.remove("is-dragging");
    }
    updateCanvasCursor(event.clientX, event.clientY);
    canvas.setPointerCapture(event.pointerId);
    requestSceneRender();
  }
  function onPointerMove(event) {
    if (activePointers.has(event.pointerId)) {
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    updateCanvasCursor(event.clientX, event.clientY);
    if (activePointers.size >= 2) {
      hadPinchGesture = true;
      applyPinchZoom();
      requestSceneRender();
      return;
    }
    if (!pointerDown || event.pointerId !== pointerId) return;
    const dx = (event.clientX - lastX) * 8e-3;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    targetRotationY -= dx;
    yawVel = -dx;
    velHistory.push(-dx);
    if (velHistory.length > 5) velHistory.shift();
    targetPitch = Math.max(minPitch, Math.min(maxPitch, targetPitch + dy * 3e-3));
    requestSceneRender();
  }
  function onPointerUp(event) {
    if (event && activePointers.has(event.pointerId)) {
      activePointers.delete(event.pointerId);
    }
    const wasMultiTouch = activePointers.size >= 1 && (pointerId == null || !pointerDown);
    if (event && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    if (activePointers.size >= 1 && wasMultiTouch) {
      pinchStartDistance = 0;
      const remaining = Array.from(activePointers.entries())[0];
      if (remaining) {
        pointerId = remaining[0];
        pointerDown = true;
        pointerDownAtMs = Date.now();
        lastX = remaining[1].x;
        lastY = remaining[1].y;
        pointerDownX = remaining[1].x;
        pointerDownY = remaining[1].y;
      }
      return;
    }
    pinchStartDistance = 0;
    if (!pointerDown) return;
    if (event && pointerId != null && event.pointerId !== pointerId) return;
    if (hadPinchGesture) {
      pointerDown = false;
      pointerId = null;
      pointerDownAtMs = 0;
      hadPinchGesture = false;
      container.classList.remove("is-dragging");
      updateCanvasCursor(event?.clientX, event?.clientY);
      requestSceneRender();
      return;
    }
    const moved = event ? Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY) : Infinity;
    const pressDurationMs = Math.max(0, Date.now() - pointerDownAtMs);
    const isTap = moved <= 8 && event;
    const isLongPress = isTap && pressDurationMs >= 420;
    const awningClicked = isTap ? isAwningClick(event.clientX, event.clientY) : false;
    const clickedGrillIndex = isTap && !awningClicked ? getGrillPickIndex(event.clientX, event.clientY) : -1;
    const clickedCameraIndex = isTap && !awningClicked && clickedGrillIndex < 0 ? getCameraPickIndex(event.clientX, event.clientY) : -1;
    const clickedStarlinkIndex = isTap && !awningClicked && clickedGrillIndex < 0 && clickedCameraIndex < 0 ? getStarlinkPickIndex(event.clientX, event.clientY) : -1;
    const clickedLightIndex = isTap && !awningClicked && clickedGrillIndex < 0 && clickedCameraIndex < 0 && clickedStarlinkIndex < 0 ? getModelLightPickIndex(event.clientX, event.clientY) : -1;
    pointerDown = false;
    const flick = velHistory.length ? velHistory.reduce((sum, value) => sum + value, 0) / velHistory.length : 0;
    yawVel = flick;
    if (Math.abs(flick) > 1e-4) {
      const speed = Math.abs(baseYawVel);
      baseYawVel = flick > 0 ? speed : -speed;
    }
    pointerId = null;
    pointerDownAtMs = 0;
    hadPinchGesture = false;
    container.classList.remove("is-dragging");
    updateCanvasCursor(event?.clientX, event?.clientY);
    requestSceneRender();
    if (awningClicked) {
      toggleMorphValue();
      return;
    }
    if (emitGrillClick(clickedGrillIndex, { longPress: isLongPress, pressDurationMs })) {
      return;
    }
    if (emitCameraClick(clickedCameraIndex, { longPress: isLongPress, pressDurationMs })) {
      return;
    }
    if (emitStarlinkClick(clickedStarlinkIndex, {
      longPress: isLongPress,
      pressDurationMs,
      clientX: event?.clientX,
      clientY: event?.clientY
    })) {
      return;
    }
    emitModelLightClick(clickedLightIndex, { longPress: isLongPress, pressDurationMs });
  }
  function onPointerLeave(event) {
    if (!pointerDown && !activePointers.has(event?.pointerId)) {
      updateCanvasCursor();
      return;
    }
    velHistory = [];
    onPointerUp(event);
    updateCanvasCursor();
  }
  function onWheel(event) {
    if (!options.interactive) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? 1.1 : 1 / 1.1;
    radius = Math.max(minRadius, Math.min(maxRadius, radius * delta));
    requestSceneRender();
  }
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  function onDocumentVisibilityChange() {
    isDocumentVisible = document.visibilityState !== "hidden";
    if (isDocumentVisible) requestSceneRender();
  }
  document.addEventListener("visibilitychange", onDocumentVisibilityChange);
  if (typeof IntersectionObserver !== "undefined") {
    visibilityObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      isCardVisible = !entry || entry.isIntersecting;
      if (isCardVisible) requestSceneRender();
    }, { threshold: 0.01 });
    visibilityObserver.observe(container);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();
  updateCanvasCursor();
  let lastFrameMs = performance.now();
  let lastRenderedMs = 0;
  function hasActiveSceneMotion() {
    const morphActive = Math.abs(targetMorphValue - morphValue) >= 1e-3;
    const inertiaActive = Math.abs(yawVel) > 1e-5;
    const weatherActive = weatherPrecipRate > 0.01 || weatherCloudAmount > 0.01 || weatherWindAmount > 0.01 || weatherStormLevel > 0.01;
    return pointerDown || spinEnabled || morphActive || inertiaActive || weatherActive;
  }
  function render(nowMs = performance.now()) {
    if (destroyed) return;
    frameId = requestAnimationFrame(render);
    if (!isCardVisible || !isDocumentVisible) {
      lastFrameMs = nowMs;
      return;
    }
    if (nowMs - lastRenderedMs < 1e3 / fpsLimit) return;
    const activeSceneMotion = hasActiveSceneMotion();
    if (!renderDirty && !activeSceneMotion) return;
    lastRenderedMs = nowMs;
    if (!pointerDown && spinEnabled) {
      yawVel *= 0.92;
      targetRotationY += yawVel + baseYawVel;
      targetRotationY = wrapAngle(targetRotationY);
    }
    if (pointerDown) {
      rotationY = wrapAngle(targetRotationY);
      pitch = targetPitch;
    } else {
      rotationY += shortestAngleDelta(rotationY, targetRotationY) * 0.08;
      rotationY = wrapAngle(rotationY);
      pitch += (targetPitch - pitch) * 0.08;
    }
    morphValue += (targetMorphValue - morphValue) * 0.14;
    if (Math.abs(targetMorphValue - morphValue) < 1e-3) {
      morphValue = targetMorphValue;
    }
    applyMorphTargets(morphValue);
    const wallNowMs = Date.now();
    const dtSec = Math.max(1 / 240, Math.min(1 / 20, (nowMs - lastFrameMs) / 1e3 || 1 / 60));
    lastFrameMs = nowMs;
    updateSunLight(getEffectiveSunNowMs(wallNowMs));
    updateWeatherEffects(wallNowMs, dtSec);
    updateStarsTwinkle(wallNowMs);
    updateLabelPositions();
    updateCamera();
    renderer.render(scene, camera);
    renderDirty = false;
  }
  updateLabelPositions();
  render();
  return {
    getRotation() {
      return rotationY;
    },
    getViewState() {
      return {
        rotationY,
        pitch,
        radius
      };
    },
    getMorphValue() {
      return targetMorphValue;
    },
    setMorphValue(value) {
      targetMorphValue = Math.max(0, Math.min(1, Number(value) || 0));
      requestSceneRender();
    },
    toggleMorph() {
      requestSceneRender();
      return toggleMorphValue();
    },
    isSpinEnabled() {
      return spinEnabled;
    },
    setSpinEnabled(enabled) {
      spinEnabled = Boolean(enabled);
      if (!spinEnabled) {
        yawVel = 0;
      }
      requestSceneRender();
      return spinEnabled;
    },
    toggleSpin() {
      spinEnabled = !spinEnabled;
      if (!spinEnabled) {
        yawVel = 0;
      }
      requestSceneRender();
      return spinEnabled;
    },
    getLightingMode() {
      return lightingMode;
    },
    setLightingMode(mode) {
      return applyLightingMode(mode);
    },
    toggleLightingMode() {
      const nextMode = lightingMode === "studio" ? "spotlight" : "studio";
      return applyLightingMode(nextMode);
    },
    isModelLightsEnabled() {
      return modelLightsEnabled;
    },
    setModelLightsEnabled(enabled) {
      modelLightsEnabled = Boolean(enabled);
      applyModelLights();
      requestSceneRender();
      return modelLightsEnabled;
    },
    toggleModelLights() {
      modelLightsEnabled = !modelLightsEnabled;
      applyModelLights();
      requestSceneRender();
      return modelLightsEnabled;
    },
    getModelLightsLevel() {
      return modelLightsLevel;
    },
    setModelLightsLevel(value) {
      modelLightsLevel = clampModelLightsLevel(value);
      applyModelLights();
      requestSceneRender();
      return modelLightsLevel;
    },
    setModelLightLevels(levels) {
      modelLightLevels = Array.isArray(levels) ? levels.map((value) => clampUnit(value)) : [];
      applyModelLights();
      requestSceneRender();
      return modelLightLevels.slice();
    },
    setSunTimes,
    setSunSimulationProgress,
    getSunSimulationProgress,
    getCurrentDayProgress,
    getSunDebugState(nowMs = Date.now()) {
      const effectiveNowMs = getEffectiveSunNowMs(nowMs);
      const effectiveDate = new Date(effectiveNowMs);
      const nightFromTimes = getNightFromSunTimes(effectiveNowMs);
      return {
        nowMs,
        effectiveNowMs,
        effectiveIso: effectiveDate.toISOString(),
        sunSimulationProgress,
        currentDayProgress: getCurrentDayProgress(nowMs),
        usesLatLon: Number.isFinite(sunLatitude) && Number.isFinite(sunLongitude),
        sunriseTimeMs,
        sunsetTimeMs,
        nightFromSunTimes: nightFromTimes,
        sunBelowHorizon,
        currentSunElevationDeg,
        sunSpriteVisible: Boolean(sunSprite?.visible)
      };
    },
    setSunLocation,
    setVanHeading,
    setWeatherState,
    getWeatherState,
    getSunIntensityScale() {
      return sunIntensityScale;
    },
    setSunIntensityScale,
    isNightMode() {
      return forcedNight || sunBelowHorizon;
    },
    isNight() {
      return forcedNight || sunBelowHorizon;
    },
    setNightMode,
    toggleNightMode,
    setLabels,
    setLabelsVisible(enabled) {
      labelGroup.visible = Boolean(enabled);
      requestSceneRender();
    },
    setCloudsVisible(enabled) {
      return cloudComponent.setVisible(Boolean(enabled));
    },
    setCompassVisible(enabled) {
      compassGroup.visible = Boolean(enabled);
      requestSceneRender();
    },
    setLabelsSpinWithModel(enabled) {
      labelsSpinWithModel = Boolean(enabled);
      updateLabelPositions();
      requestSceneRender();
    },
    resize,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frameId);
      clearModelSpotLights();
      resizeObserver.disconnect();
      visibilityObserver?.disconnect?.();
      document.removeEventListener("visibilitychange", onDocumentVisibilityChange);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
      for (let i = 0; i < starFields.length; i++) {
        const field = starFields[i];
        field.geometry.dispose();
        field.material.dispose();
      }
      sunSprite.removeFromParent();
      sunSpriteMaterial.dispose();
      sunSpriteTexture?.dispose?.();
      skyComponent.destroy();
      groundComponent.destroy();
      cloudComponent.destroy();
      precipComponent.destroy();
      renderer.dispose();
      container.innerHTML = "";
    }
  };
}
var DEFAULT_CONFIG = {
  solar_voltage: "sensor.epever_pv_voltage",
  solar_amp: "sensor.epever_pv_current",
  solar_watt: "sensor.epever_pv_power",
  battery_voltage: "sensor.epever_battery_voltage",
  battery_amp: "sensor.battery_current",
  battery_watt: "sensor.battery_wattage",
  grid_voltage: "sensor.charger_hookup_voltage",
  grid_amp: "sensor.charger_hookup_current",
  grid_watt: "sensor.charger_hookup_power",
  alternator_voltage: "sensor.charger_alternator_voltage",
  alternator_amp: "sensor.charger_alternator_current",
  alternator_watt: "sensor.charger_alternator_power",
  battery_percent: "sensor.battery_percentage",
  location_entity: "",
  latitude_attribute: "latitude",
  longitude_attribute: "longitude",
  latitude_entity: "",
  longitude_entity: "",
  latitude: null,
  longitude: null,
  van_heading_entity: "",
  van_heading_offset_degrees: 0,
  sun_entity: "",
  sun_intensity_scale: 2.45,
  spin_enabled: true,
  debug_time_of_day: null,
  light_style: "studio",
  show_compass: true,
  show_floating_metrics: false,
  show_clouds: true,
  fullscreen: false,
  homepage_url: "",
  date_time_scale: 1,
  metrics_scale: 1,
  weather_scale: 1,
  model_light_cone_degrees: 160,
  model_light_distance: 26,
  model_light_penumbra: 0.45,
  model_light_intensity_boost: 6,
  model_light_1_entity: "",
  model_light_2_entity: "",
  camera_left_entity: "",
  camera_right_entity: "",
  upper_grill: "",
  lower_grill: "",
  moon_entity: "",
  weather_entity: "",
  inside_temp_entity: "",
  low_power_mode: "auto",
  max_pixel_ratio: null,
  fps_limit: 30
};
var STORAGE_KEYS = {
  morphOpen: "van-power-card:morph-open",
  viewState: "van-power-card:view-state",
  modelLightsLevel: "van-power-card:model-lights-level"
};
var VanPowerCard = class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = { ...DEFAULT_CONFIG };
    this._rawConfig = {};
    this._scene = null;
    this._morphOpen = this.readStoredBoolean(STORAGE_KEYS.morphOpen, false);
    this._spinEnabled = true;
    this._lightingMode = this.normalizeLightingStyle(this._config.light_style);
    this._sunIntensityScale = 2.45;
    this._sunSimulationProgress = null;
    this._modelLightsLevel = this.readStoredNumber(STORAGE_KEYS.modelLightsLevel, 1);
    this._viewState = this.readStoredViewState(STORAGE_KEYS.viewState, null);
    this._viewSaveTimer = null;
    this._dateTimeTimer = null;
    this._daySimAdjustingTimer = null;
    this._fullscreenApplied = false;
    this._pixelShiftTimer = null;
    this._debugWeatherOverride = "";
    this._debugDayTimeOverride = null;
  }
  connectedCallback() {
    this.render();
    this.applyFullscreenMode();
    this.update();
  }
  setConfig(config) {
    const previousConfig = this._config;
    this._rawConfig = config || {};
    this._config = { ...DEFAULT_CONFIG, ...config || {} };
    if (this._scene && this.performanceSceneConfigChanged(previousConfig, this._config)) {
      this.persistViewState();
      this._scene.destroy();
      this._scene = null;
    }
    const configuredSunScale = Number(this._config.sun_intensity_scale);
    if (Number.isFinite(configuredSunScale)) {
      this._sunIntensityScale = Math.max(0, Math.min(5, configuredSunScale));
    }
    this._lightingMode = this.normalizeLightingStyle(this._config.light_style);
    this._spinEnabled = this.getConfiguredSpinEnabled();
    if (!this.shadowRoot.innerHTML) {
      this.render();
    }
    this._sunIntensityScale = this._scene?.setSunIntensityScale?.(this._sunIntensityScale) ?? this._sunIntensityScale;
    this._lightingMode = this._scene?.setLightingMode?.(this._lightingMode) || this._lightingMode;
    this.applySceneControlConfig();
    this.applyDisplayScales();
    this.updateWeatherDisplay();
    this.updateMoonDisplay();
    this.applyFullscreenMode();
  }
  set hass(hass) {
    this._hass = hass;
    if (!this.shadowRoot.innerHTML) {
      this.render();
    }
    this.update();
  }
  getCardSize() {
    return 6;
  }
  disconnectedCallback() {
    this.persistViewState();
    if (this._viewSaveTimer) {
      clearInterval(this._viewSaveTimer);
      this._viewSaveTimer = null;
    }
    if (this._dateTimeTimer) {
      clearInterval(this._dateTimeTimer);
      this._dateTimeTimer = null;
    }
    if (this._daySimAdjustingTimer) {
      clearTimeout(this._daySimAdjustingTimer);
      this._daySimAdjustingTimer = null;
    }
    this.restoreFullscreenMode();
    this._scene?.destroy();
    this._scene = null;
  }
  lookup(entityId) {
    return this._hass?.states?.[entityId];
  }
  format(entityId, fallbackUnit = "") {
    const state = this.lookup(entityId);
    if (!state) return "\u2014";
    const unit = state.attributes?.unit_of_measurement || fallbackUnit;
    return `${state.state}${unit}`;
  }
  parseLightPercent(entityId) {
    if (!entityId) return 100;
    const state = this.lookup(entityId);
    if (!state) return 0;
    const attributes = state.attributes || {};
    const pctFromAttr = Number(attributes.brightness_pct);
    if (Number.isFinite(pctFromAttr)) {
      return Math.max(0, Math.min(100, pctFromAttr));
    }
    const rawBrightness = Number(attributes.brightness);
    if (Number.isFinite(rawBrightness)) {
      return Math.max(0, Math.min(100, rawBrightness / 255 * 100));
    }
    if (state.state === "on") return 100;
    if (state.state === "off") return 0;
    const numericState = Number(state.state);
    if (Number.isFinite(numericState)) {
      return Math.max(0, Math.min(100, numericState));
    }
    return 0;
  }
  parseStateNumber(entityId) {
    if (!entityId) return null;
    const state = this.lookup(entityId);
    if (!state) return null;
    const raw = String(state.state ?? "").trim();
    if (!raw || raw === "unknown" || raw === "unavailable") return null;
    const direct = Number(raw);
    if (Number.isFinite(direct)) return direct;
    const match = raw.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  parseConfiguredNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  isLowPowerModeEnabled(config = this._config) {
    const setting = config.low_power_mode;
    if (setting === false || setting === "false") return false;
    if (setting === true || setting === "true") return true;
    return /Android/i.test(typeof navigator !== "undefined" ? navigator.userAgent || "" : "");
  }
  getConfiguredMaxPixelRatio(config = this._config) {
    const fallback = this.isLowPowerModeEnabled(config) ? 1 : 1.5;
    const raw = config.max_pixel_ratio;
    const parsed = raw != null ? Number(raw) : NaN;
    return Math.max(0.5, Math.min(2, Number.isFinite(parsed) && parsed > 0 ? parsed : fallback));
  }
  getConfiguredFpsLimit(config = this._config) {
    const fallback = this.isLowPowerModeEnabled(config) ? 15 : 30;
    const parsed = Number(config.fps_limit);
    return Math.max(1, Math.min(60, Number.isFinite(parsed) && parsed > 0 ? parsed : fallback));
  }
  performanceSceneConfigChanged(previousConfig, nextConfig) {
    if (!previousConfig) return false;
    return this.isLowPowerModeEnabled(previousConfig) !== this.isLowPowerModeEnabled(nextConfig) || this.getConfiguredMaxPixelRatio(previousConfig) !== this.getConfiguredMaxPixelRatio(nextConfig) || this.getConfiguredFpsLimit(previousConfig) !== this.getConfiguredFpsLimit(nextConfig);
  }
  parseEntityAttributeNumber(entityId, attributeName) {
    if (!entityId || !attributeName) return null;
    const state = this.lookup(entityId);
    if (!state) return null;
    const raw = state.attributes?.[attributeName];
    if (raw == null) return null;
    const direct = Number(raw);
    if (Number.isFinite(direct)) return direct;
    const text = String(raw).trim();
    if (!text || text === "unknown" || text === "unavailable") return null;
    const match = text.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  getConfiguredLatitude() {
    const fromLocationAttribute = this.parseEntityAttributeNumber(
      this._config.location_entity,
      this._config.latitude_attribute || "latitude"
    );
    if (Number.isFinite(fromLocationAttribute)) return fromLocationAttribute;
    const fromEntity = this.parseStateNumber(this._config.latitude_entity);
    if (Number.isFinite(fromEntity)) return fromEntity;
    const fromConfig = this.parseConfiguredNumber(this._config.latitude);
    if (Number.isFinite(fromConfig)) return fromConfig;
    const hassLatitude = Number(this._hass?.config?.latitude);
    return Number.isFinite(hassLatitude) ? hassLatitude : null;
  }
  getConfiguredLongitude() {
    const fromLocationAttribute = this.parseEntityAttributeNumber(
      this._config.location_entity,
      this._config.longitude_attribute || "longitude"
    );
    if (Number.isFinite(fromLocationAttribute)) return fromLocationAttribute;
    const fromEntity = this.parseStateNumber(this._config.longitude_entity);
    if (Number.isFinite(fromEntity)) return fromEntity;
    const fromConfig = this.parseConfiguredNumber(this._config.longitude);
    if (Number.isFinite(fromConfig)) return fromConfig;
    const hassLongitude = Number(this._hass?.config?.longitude);
    return Number.isFinite(hassLongitude) ? hassLongitude : null;
  }
  parseSunTime(entityId, preferredAttribute = "") {
    if (!entityId) return null;
    const state = this.lookup(entityId);
    if (!state) return null;
    const attributeName = String(preferredAttribute || "").trim();
    if (attributeName) {
      const attrValue = state.attributes?.[attributeName];
      if (typeof attrValue === "string" && attrValue.trim()) {
        const parsedAttrDate = new Date(attrValue.trim());
        if (!Number.isNaN(parsedAttrDate.getTime())) {
          return parsedAttrDate.getTime();
        }
      }
    }
    const raw = String(state.state || "").trim();
    if (!raw || raw === "unknown" || raw === "unavailable") return null;
    const parsedDate = new Date(raw);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.getTime();
    }
    const hhmmss = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!hhmmss) return null;
    const now = new Date();
    const hour = Math.max(0, Math.min(23, Number(hhmmss[1]) || 0));
    const minute = Math.max(0, Math.min(59, Number(hhmmss[2]) || 0));
    const second = Math.max(0, Math.min(59, Number(hhmmss[3]) || 0));
    const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, second, 0);
    return dt.getTime();
  }
  getSunTimes() {
    const sunEntity = String(this._config.sun_entity || "").trim();
    if (!sunEntity) {
      return null;
    }
    let sunriseMs = this.parseSunTime(sunEntity, "next_dawn");
    let sunsetMs = this.parseSunTime(sunEntity, "next_dusk");
    if (!Number.isFinite(sunriseMs) || !Number.isFinite(sunsetMs)) {
      return null;
    }
    if (sunriseMs > sunsetMs) {
      sunriseMs -= 864e5;
    }
    if (sunsetMs <= sunriseMs) {
      sunsetMs += 864e5;
    }
    return { sunriseMs, sunsetMs };
  }
  openMoreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      bubbles: true,
      composed: true,
      detail: { entityId }
    }));
  }
  getHomepageUrl() {
    const raw = String(this._config.homepage_url || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;
    if (/^www\./i.test(raw)) return `https://${raw}`;
    return raw;
  }
  navigateTo(path) {
    if (!path) return;
    if (this._hass?.navigate) {
      this._hass.navigate(path);
      return;
    }
    window.history.pushState(null, "", path);
    window.dispatchEvent(new Event("location-changed"));
  }
  openHomepageUrl() {
    this.restoreFullscreenMode();
    const url = this.getHomepageUrl();
    if (!url) return;
    if (url.startsWith("/")) {
      this.navigateTo(url);
      return;
    }
    if (/^https?:\/\//i.test(url)) {
      try {
        const parsed = new URL(url);
        if (parsed.origin === window.location.origin) {
          this.navigateTo(`${parsed.pathname}${parsed.search}${parsed.hash}`);
          return;
        }
      } catch {
      }
    }
    window.location.assign(url);
  }
  getConfiguredSpinEnabled() {
    if (this.isLowPowerModeEnabled() && !Object.prototype.hasOwnProperty.call(this._rawConfig || {}, "spin_enabled")) {
      return false;
    }
    return this._config.spin_enabled !== false && this._config.spin_enabled !== "false";
  }
  getConfiguredDaySimulationProgress() {
    const raw = this._config.debug_time_of_day;
    if (raw == null || raw === "") return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Math.min(1, parsed));
  }
  applySceneControlConfig() {
    this._spinEnabled = this.getConfiguredSpinEnabled();
    this._scene?.setSpinEnabled?.(this._spinEnabled);
    const configuredProgress = this.getConfiguredDaySimulationProgress();
    const progress = Number.isFinite(this._debugDayTimeOverride) ? this._debugDayTimeOverride : configuredProgress;
    this._sunSimulationProgress = this._scene?.setSunSimulationProgress?.(progress) ?? progress;
  }
  isFullscreenEnabled() {
    return this._config.fullscreen === true || this._config.fullscreen === "true";
  }
  startPixelShift() {
    const card = this.shadowRoot?.getElementById("dynamic-card");
    if (!card) return;
    if (this._pixelShiftTimer) {
      clearInterval(this._pixelShiftTimer);
      this._pixelShiftTimer = null;
    }
    const overscan = 30;
    const step = 5;
    card.style.position = "relative";
    card.style.width = `calc(100% + ${overscan * 2}px)`;
    card.style.height = `calc(100% + ${overscan * 2}px)`;
    card.style.left = `${-overscan}px`;
    card.style.top = `${-overscan}px`;
    card.style.willChange = "transform";
    const updateShift = () => {
      const x = Math.round((Math.random() * 2 - 1) * (overscan / step)) * step;
      const y = Math.round((Math.random() * 2 - 1) * (overscan / step)) * step;
      card.style.transform = `translate(${x}px, ${y}px)`;
    };
    updateShift();
    this._pixelShiftTimer = setInterval(updateShift, 3e4);
  }
  stopPixelShift() {
    if (this._pixelShiftTimer) {
      clearInterval(this._pixelShiftTimer);
      this._pixelShiftTimer = null;
    }
    const card = this.shadowRoot?.getElementById("dynamic-card");
    if (card) {
      card.style.removeProperty("position");
      card.style.removeProperty("width");
      card.style.removeProperty("height");
      card.style.removeProperty("left");
      card.style.removeProperty("top");
      card.style.removeProperty("transform");
      card.style.removeProperty("will-change");
    }
  }
  activateFullscreenMode() {
    const viewDiv = document.querySelector("body > home-assistant")?.shadowRoot?.querySelector("home-assistant-main")?.shadowRoot?.querySelector("ha-drawer > partial-panel-resolver > ha-panel-lovelace")?.shadowRoot?.querySelector("hui-root")?.shadowRoot?.querySelector("#view");
    if (viewDiv) {
      viewDiv.style.setProperty("padding", "0px");
    }
    const haDrawer = document.querySelector("body > home-assistant")?.shadowRoot?.querySelector("home-assistant-main")?.shadowRoot?.querySelector("ha-drawer");
    if (haDrawer) {
      haDrawer.style.setProperty("--mdc-drawer-width", "0px");
    }
    const headerDiv = document.querySelector("body > home-assistant")?.shadowRoot?.querySelector("home-assistant-main")?.shadowRoot?.querySelector("ha-drawer > partial-panel-resolver > ha-panel-lovelace")?.shadowRoot?.querySelector("hui-root")?.shadowRoot?.querySelector("div > div.header");
    if (headerDiv) {
      headerDiv.style.setProperty("display", "none");
    }
    this.startPixelShift();
    this._fullscreenApplied = true;
  }
  restoreFullscreenMode() {
    this.stopPixelShift();
    if (!this._fullscreenApplied) return;
    const ham = document.querySelector("body > home-assistant")?.shadowRoot?.querySelector("home-assistant-main");
    const drawer = ham?.shadowRoot?.querySelector("ha-drawer");
    if (drawer) {
      drawer.style.removeProperty("--mdc-drawer-width");
    }
    const panel = drawer?.querySelector("partial-panel-resolver > ha-panel-lovelace");
    const root = panel?.shadowRoot?.querySelector("hui-root");
    const view = root?.shadowRoot?.querySelector("#view");
    if (view) {
      view.style.removeProperty("padding");
    }
    const header = root?.shadowRoot?.querySelector("div > div.header");
    if (header) {
      header.style.removeProperty("display");
    }
    this._fullscreenApplied = false;
  }
  applyFullscreenMode() {
    if (this.isFullscreenEnabled()) {
      this.activateFullscreenMode();
      return;
    }
    this.restoreFullscreenMode();
  }
  getModelLightEntityId(index) {
    if (index === 0) return this._config.model_light_1_entity || "";
    if (index === 1) return this._config.model_light_2_entity || "";
    return "";
  }
  getCameraEntityId(index) {
    if (index === 0) return this._config.camera_left_entity || "";
    if (index === 1) return this._config.camera_right_entity || "";
    return "";
  }
  getGrillEntityId(index) {
    if (index === 0) return this._config.upper_grill || "";
    if (index === 1) return this._config.lower_grill || "";
    return "";
  }
  handleGrillClick(index) {
    const entityId = this.getGrillEntityId(index);
    if (!entityId) return;
    this.openMoreInfo(entityId);
  }
  handleCameraClick(index) {
    const entityId = this.getCameraEntityId(index);
    if (!entityId) return;
    this.openMoreInfo(entityId);
  }
  getStarlinkCombinedUrl() {
    try {
      const ingressPathRaw = window.localStorage.getItem("starlink_gui.ingress_path");
      const ingressPath = String(ingressPathRaw || "").trim();
      if (!ingressPath) return "";
      const normalized = ingressPath.endsWith("/") ? ingressPath.slice(0, -1) : ingressPath;
      return `${normalized}/combined`;
    } catch {
      return "";
    }
  }
  openStarlinkPanel(detail = {}) {
    const url = this.getStarlinkCombinedUrl();
    if (!url) {
      console.warn("Starlink ingress path not found in localStorage key: starlink_gui.ingress_path");
      return;
    }
    const panel = this.shadowRoot?.getElementById("starlink-panel");
    const frame = this.shadowRoot?.getElementById("starlink-frame");
    if (!panel || !frame) return;
    frame.src = url;
    panel.classList.remove("is-hidden");
    const clientX = Number(detail?.clientX);
    const clientY = Number(detail?.clientY);
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
    const stage = this.shadowRoot?.querySelector(".stage");
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    requestAnimationFrame(() => {
      const panelWidth = panel.offsetWidth || 360;
      const panelHeight = panel.offsetHeight || 260;
      const margin = 10;
      const desiredX = clientX - stageRect.left + 12;
      const desiredY = clientY - stageRect.top + 12;
      const maxX = Math.max(margin, stageRect.width - panelWidth - margin);
      const maxY = Math.max(margin, stageRect.height - panelHeight - margin);
      const clampedX = Math.min(Math.max(margin, desiredX), maxX);
      const clampedY = Math.min(Math.max(margin, desiredY), maxY);
      panel.style.left = `${clampedX}px`;
      panel.style.top = `${clampedY}px`;
    });
  }
  closeStarlinkPanel() {
    const panel = this.shadowRoot?.getElementById("starlink-panel");
    const frame = this.shadowRoot?.getElementById("starlink-frame");
    if (!panel || !frame) return;
    panel.classList.add("is-hidden");
    frame.removeAttribute("src");
  }
  handleStarlinkClick(detail = {}) {
    this.openStarlinkPanel(detail);
  }
  async handleModelLightClick(index, detail = {}) {
    const entityId = this.getModelLightEntityId(index);
    if (!entityId) return;
    const isLongPress = detail?.longPress === true;
    if (isLongPress) {
      this.openMoreInfo(entityId);
      return;
    }
    const domain = entityId.split(".")[0];
    if (domain === "light" && this._hass?.callService) {
      try {
        await this._hass.callService("light", "toggle", { entity_id: entityId });
      } catch (error22) {
        console.error("Failed to toggle light from model click", error22);
      }
    }
  }
  readStoredBoolean(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      if (value === null) return fallback;
      return value === "true";
    } catch {
      return fallback;
    }
  }
  writeStoredBoolean(key, value) {
    try {
      window.localStorage.setItem(key, String(Boolean(value)));
    } catch {
    }
  }
  readStoredNumber(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null) return fallback;
      const value = Number(raw);
      return Number.isFinite(value) ? value : fallback;
    } catch {
      return fallback;
    }
  }
  writeStoredNumber(key, value) {
    try {
      window.localStorage.setItem(key, String(Number(value)));
    } catch {
    }
  }
  sanitizeViewState(value) {
    if (!value || typeof value !== "object") return null;
    const rotationY = Number(value.rotationY);
    const pitch = Number(value.pitch);
    const radius = Number(value.radius);
    if (!Number.isFinite(rotationY) || !Number.isFinite(pitch) || !Number.isFinite(radius)) {
      return null;
    }
    return {
      rotationY,
      pitch: Math.max(-0.7, Math.min(1.5, pitch)),
      radius: Math.max(7, Math.min(18, radius))
    };
  }
  readStoredViewState(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      return this.sanitizeViewState(JSON.parse(raw)) || fallback;
    } catch {
      return fallback;
    }
  }
  writeStoredViewState(key, value) {
    try {
      const state = this.sanitizeViewState(value);
      if (!state) return;
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
    }
  }
  persistViewState() {
    const state = this._scene?.getViewState?.();
    if (!state) return;
    this._viewState = this.sanitizeViewState(state) || this._viewState;
    if (this._viewState) {
      this.writeStoredViewState(STORAGE_KEYS.viewState, this._viewState);
    }
  }
  startViewStatePersistence() {
    if (this._viewSaveTimer) {
      clearInterval(this._viewSaveTimer);
    }
    this._viewSaveTimer = setInterval(() => {
      if (!this._scene || this._spinEnabled) return;
      this.persistViewState();
    }, 1e3);
  }
  buildSceneLabels() {
    const batteryPercent = this.lookup(this._config.battery_percent);
    return {
      solar: {
        title: "SOLAR",
        lines: [
          this.format(this._config.solar_watt, "W"),
          this.format(this._config.solar_amp, "A"),
          this.format(this._config.solar_voltage, "V")
        ]
      },
      grid: {
        title: "HOOKUP",
        lines: [
          this.format(this._config.grid_watt, "W"),
          this.format(this._config.grid_amp, "A"),
          this.format(this._config.grid_voltage, "V")
        ]
      },
      alternator: {
        title: "ALTERNATOR",
        lines: [
          this.format(this._config.alternator_watt, "W"),
          this.format(this._config.alternator_amp, "A"),
          this.format(this._config.alternator_voltage, "V")
        ]
      },
      battery: {
        title: "BATTERY",
        lines: [
          batteryPercent ? `${batteryPercent.state}%` : "\u2014",
          this.format(this._config.battery_amp, "A"),
          this.format(this._config.battery_voltage, "V")
        ]
      }
    };
  }
  useFloatingMetrics() {
    return this._config.show_floating_metrics === true || this._config.show_floating_metrics === "true";
  }
  useCompass() {
    return this._config.show_compass !== false && this._config.show_compass !== "false";
  }
  useClouds() {
    return this._config.show_clouds !== false && this._config.show_clouds !== "false";
  }
  normalizeLightingStyle(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "spotlight" || normalized === "model") return "spotlight";
    return "studio";
  }
  getWeatherRawIcon() {
    const debugOverride = this.getDebugWeatherOverride();
    if (debugOverride) return debugOverride;
    const weatherEntityId = String(this._config.weather_entity || "").trim();
    if (!weatherEntityId) return "";
    const weatherState = this.lookup(weatherEntityId);
    if (!weatherState) return "";
    const attrIcon = String(weatherState.attributes?.icon || "").trim();
    if (attrIcon && attrIcon !== "unknown" && attrIcon !== "unavailable") {
      return attrIcon;
    }
    const stateText = String(weatherState.state || "").trim();
    if (!stateText || stateText === "unknown" || stateText === "unavailable") return "";
    return stateText;
  }
  getDebugWeatherOverride() {
    return String(this._debugWeatherOverride || "").trim().toLowerCase();
  }
  handleDebugWeatherSelectChange(event) {
    const selected = String(event?.target?.value || "").trim().toLowerCase();
    this._debugWeatherOverride = selected;
    this.updateWeatherDisplay();
  }
  syncDebugWeatherSelect() {
    const select = this.shadowRoot?.getElementById("debug-weather-select");
    if (!select) return;
    select.value = this.getDebugWeatherOverride();
  }
  handleDebugDayTimeInput(event) {
    const raw = Number(event?.target?.value);
    const value = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : null;
    this._debugDayTimeOverride = value;
    this._sunSimulationProgress = this._scene?.setSunSimulationProgress?.(value) ?? value;
    this.updateDebugDayTimeDisplay(value);
    this.updateDaySimulationControl();
  }
  updateDebugDayTimeDisplay(progress) {
    const slider = this.shadowRoot?.getElementById("debug-daytime-slider");
    const valueNode = this.shadowRoot?.getElementById("debug-daytime-value");
    if (slider && Number.isFinite(progress)) {
      slider.value = String(Math.max(0, Math.min(1, progress)));
    }
    if (valueNode) {
      if (!Number.isFinite(progress)) {
        valueNode.textContent = "AUTO";
      } else {
        const normalized = Math.max(0, Math.min(1, progress));
        const simulatedMs = this.getSimulatedTimestamp(normalized);
        const simulatedText = Number.isFinite(simulatedMs) ? this.formatClockTime(simulatedMs) : "--:--";
        valueNode.textContent = `${(normalized * 100).toFixed(1)}% ${simulatedText}`;
      }
    }
  }
  resolveWeatherVisual(rawIcon) {
    const rawText = String(rawIcon || "").trim().toLowerCase();
    if (!rawText) return null;
    let normalized = rawText.startsWith("mdi:weather-") ? rawText.slice("mdi:weather-".length) : rawText;
    normalized = normalized.replace(/_/g, "-");
    const alias = {
      "clear-day": "sunny",
      "partly-cloudy-day": "partlycloudy",
      "partly-cloudy-night": "partlycloudy",
      "partly-cloudy": "partlycloudy",
      rain: "rainy",
      snow: "snowy",
      sleet: "snowy-rainy",
      wind: "windy"
    };
    normalized = alias[normalized] || normalized;
    const map = {
      "clear-night": { key: "clear-night", condition: "clear-night", label: "Clear Night", variant: "night" },
      "sunny": { key: "sunny", condition: "sunny", label: "Sunny", variant: "day" },
      "partlycloudy": { key: "partlycloudy", condition: "partlycloudy", label: "Partly Cloudy", variant: null },
      "cloudy": { key: "cloudy", condition: "cloudy", label: "Cloudy", variant: null },
      "fog": { key: "fog", condition: "fog", label: "Fog", variant: null },
      "rainy": { key: "rainy", condition: "rainy", label: "Rain", variant: null },
      "pouring": { key: "rainy", condition: "pouring", label: "Pouring", variant: null },
      "snowy": { key: "snowy", condition: "snowy", label: "Snow", variant: null },
      "snowy-rainy": { key: "snowyrainy", condition: "snowy-rainy", label: "Snow/Rain", variant: null },
      "hail": { key: "hail", condition: "hail", label: "Hail", variant: null },
      "lightning": { key: "lightning", condition: "lightning", label: "Lightning", variant: null },
      "lightning-rainy": { key: "lightningrain", condition: "lightning-rainy", label: "Lightning Rain", variant: null },
      "windy": { key: "windy", condition: "windy", label: "Windy", variant: null },
      "windy-variant": { key: "windyvariant", condition: "windy-variant", label: "Windy Cloudy", variant: null },
      "exceptional": { key: "exceptional", condition: "exceptional", label: "Exceptional", variant: null }
    };
    const base = map[normalized];
    if (!base) return null;
    return {
      ...base,
      candidates: [base.key]
    };
  }
  getDayWeatherGrayness(conditionRaw) {
    const condition = String(conditionRaw || "").trim().toLowerCase();
    const map = {
      sunny: 0,
      "clear-night": 0,
      partlycloudy: 0.25,
      cloudy: 0.62,
      fog: 0.68,
      rainy: 0.94,
      pouring: 1,
      snowy: 0.74,
      "snowy-rainy": 0.96,
      hail: 0.97,
      lightning: 0.86,
      "lightning-rainy": 1,
      windy: 0.34,
      "windy-variant": 0.7,
      exceptional: 1
    };
    return Math.max(0, Math.min(1, map[condition] ?? 0.2));
  }
  applyDayWeatherBackground(conditionRaw) {
    const card = this.shadowRoot?.getElementById("dynamic-card");
    const stage = this.shadowRoot?.querySelector(".stage");
    if (!card || !stage) return;
    const grayness = this.getDayWeatherGrayness(conditionRaw);
    const gloom = Math.max(0, Math.min(1, (grayness - 0.72) / 0.28));
    const gloomDarken = 1 - gloom * 0.22;
    const mixChannel = (a, b, t) => Math.round(a + (b - a) * t);
    const cardTop = [
      mixChannel(181, 152, grayness),
      mixChannel(205, 156, grayness),
      mixChannel(228, 161, grayness)
    ];
    const cardMid = [
      mixChannel(106, 112, grayness),
      mixChannel(135, 117, grayness),
      mixChannel(164, 122, grayness)
    ];
    const cardBot = [
      mixChannel(42, 60, grayness),
      mixChannel(59, 64, grayness),
      mixChannel(77, 69, grayness)
    ];
    const stageTop = [
      mixChannel(151, 164, grayness),
      mixChannel(192, 170, grayness),
      mixChannel(236, 176, grayness)
    ];
    const stageMid = [
      mixChannel(73, 103, grayness),
      mixChannel(111, 109, grayness),
      mixChannel(156, 115, grayness)
    ];
    const stageLow = [
      mixChannel(16, 54, grayness),
      mixChannel(30, 58, grayness),
      mixChannel(48, 64, grayness)
    ];
    const darkenTriplet = (triplet, mul) => triplet.map((value) => Math.max(0, Math.min(255, Math.round(value * mul))));
    const cardTopDark = darkenTriplet(cardTop, gloomDarken * 0.96);
    const cardMidDark = darkenTriplet(cardMid, gloomDarken * 0.9);
    const cardBotDark = darkenTriplet(cardBot, gloomDarken * 0.84);
    const stageTopDark = darkenTriplet(stageTop, gloomDarken * 0.94);
    const stageMidDark = darkenTriplet(stageMid, gloomDarken * 0.88);
    const stageLowDark = darkenTriplet(stageLow, gloomDarken * 0.82);
    stage.style.setProperty("--day-stage-top", `rgba(${stageTopDark[0]}, ${stageTopDark[1]}, ${stageTopDark[2]}, ${(0.28 + gloom * 0.06).toFixed(3)})`);
    stage.style.setProperty("--day-stage-mid", `rgba(${stageMidDark[0]}, ${stageMidDark[1]}, ${stageMidDark[2]}, ${(0.18 + gloom * 0.08).toFixed(3)})`);
    stage.style.setProperty("--day-stage-low", `rgba(${stageLowDark[0]}, ${stageLowDark[1]}, ${stageLowDark[2]}, ${(0.08 + gloom * 0.1).toFixed(3)})`);
    card.style.setProperty("--day-card-top", `rgb(${cardTopDark[0]}, ${cardTopDark[1]}, ${cardTopDark[2]})`);
    card.style.setProperty("--day-card-mid", `rgb(${cardMidDark[0]}, ${cardMidDark[1]}, ${cardMidDark[2]})`);
    card.style.setProperty("--day-card-bottom", `rgb(${cardBotDark[0]}, ${cardBotDark[1]}, ${cardBotDark[2]})`);
  }
  getWeatherTemperatureText() {
    const weatherEntityId = String(this._config.weather_entity || "").trim();
    if (!weatherEntityId) return "";
    const weatherState = this.lookup(weatherEntityId);
    if (!weatherState) return "";
    const tempValue = Number(weatherState.attributes?.temperature);
    if (!Number.isFinite(tempValue)) return "";
    const unit = String(weatherState.attributes?.temperature_unit || weatherState.attributes?.unit_of_measurement || "°").trim();
    const rounded = Math.round(tempValue);
    return `${rounded}${unit}`;
  }
  getInsideTemperatureText() {
    const entityId = String(this._config.inside_temp_entity || "").trim();
    if (!entityId) return "";
    const state = this.lookup(entityId);
    if (!state) return "";
    const raw = String(state.state ?? "").trim();
    if (!raw || raw === "unknown" || raw === "unavailable") return "\u2014";
    const unit = String(state.attributes?.unit_of_measurement || "").trim();
    return `${raw}${unit}`;
  }
  handleWeatherClick() {
    const entityId = String(this._config.weather_entity || "").trim();
    if (!entityId) return;
    this.openMoreInfo(entityId);
  }
  updateWeatherDisplay() {
    const panel = this.shadowRoot?.getElementById("weather-panel");
    const textNode = this.shadowRoot?.getElementById("weather-label");
    const insideTextNode = this.shadowRoot?.getElementById("weather-inside-label");
    if (!panel || !textNode || !insideTextNode) return;
    const rawIcon = this.getWeatherRawIcon();
    const visual = this.resolveWeatherVisual(rawIcon);
    this._scene?.setWeatherState?.(visual?.condition || rawIcon || "sunny");
    this.applyDayWeatherBackground(visual?.condition || rawIcon || "sunny");
    if (!visual) {
      panel.classList.add("is-hidden");
      panel.classList.remove("is-night");
      textNode.textContent = "";
      insideTextNode.textContent = "";
      insideTextNode.classList.add("is-hidden");
      return;
    }
    panel.classList.remove("is-hidden");
    panel.classList.toggle("is-night", visual.variant === "night");
    const temperatureText = this.getWeatherTemperatureText();
    textNode.textContent = `${visual.label}${temperatureText ? ` | ${temperatureText}` : ""}`;
    const insideTemperatureText = this.getInsideTemperatureText();
    if (insideTemperatureText) {
      insideTextNode.textContent = `INSIDE | ${insideTemperatureText}`;
      insideTextNode.classList.remove("is-hidden");
    } else {
      insideTextNode.textContent = "";
      insideTextNode.classList.add("is-hidden");
    }
  }
  getTileMetrics() {
    const batteryPercent = this.lookup(this._config.battery_percent);
    return {
      solar: {
        title: "SOLAR",
        primary: this.format(this._config.solar_watt, "W"),
        detail: `${this.format(this._config.solar_amp, "A")} | ${this.format(this._config.solar_voltage, "V")}`
      },
      hookup: {
        title: "HOOKUP",
        primary: this.format(this._config.grid_watt, "W"),
        detail: `${this.format(this._config.grid_amp, "A")} | ${this.format(this._config.grid_voltage, "V")}`
      },
      alternator: {
        title: "ALTERNATOR",
        primary: this.format(this._config.alternator_watt, "W"),
        detail: `${this.format(this._config.alternator_amp, "A")} | ${this.format(this._config.alternator_voltage, "V")}`
      },
      battery: {
        title: "BATTERY",
        primary: batteryPercent ? `${batteryPercent.state}%` : "\u2014",
        detail: `${this.format(this._config.battery_amp, "A")} | ${this.format(this._config.battery_voltage, "V")}`
      }
    };
  }
  updateMetricTiles() {
    const metrics = this.getTileMetrics();
    const tileKeys = ["solar", "hookup", "alternator", "battery"];
    for (const key of tileKeys) {
      const tile = this.shadowRoot?.querySelector(`[data-tile="${key}"]`);
      if (!tile) continue;
      const tileData = metrics[key];
      const title = tile.querySelector("[data-role='title']");
      const primary = tile.querySelector("[data-role='primary']");
      const detail = tile.querySelector("[data-role='detail']");
      if (title) title.textContent = tileData.title;
      if (primary) primary.textContent = tileData.primary;
      if (detail) detail.textContent = tileData.detail;
    }
  }
  getMoonPhaseLabel() {
    const phase = this.getMoonPhaseState();
    if (!phase) return "";
    const map = {
      new_moon: "New Moon",
      waxing_crescent: "Waxing Crescent",
      first_quarter: "First Quarter",
      waxing_gibbous: "Waxing Gibbous",
      full_moon: "Full Moon",
      waning_gibbous: "Waning Gibbous",
      last_quarter: "Last Quarter",
      waning_crescent: "Waning Crescent"
    };
    if (map[phase]) return map[phase];
    return phase.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()).trim();
  }
  updateMoonDisplay() {
    const panel = this.shadowRoot?.getElementById("moon-panel");
    const labelNode = this.shadowRoot?.getElementById("moon-label");
    const isNight = this._scene?.isNight?.() ?? this._scene?.isNightMode?.() ?? false;
    const moonPhase = this.getMoonPhaseState();
    const moonLabel = moonPhase ? this.getMoonPhaseLabel() : "";
    const card = this.shadowRoot?.getElementById("dynamic-card");
    const stage = this.shadowRoot?.querySelector(".stage");
    card?.classList.toggle("is-night", isNight);
    stage?.classList.toggle("is-night", isNight);
    const rawIcon = this.getWeatherRawIcon();
    this.applyDayWeatherBackground(this.resolveWeatherVisual(rawIcon)?.condition || rawIcon || "sunny");
    if (!panel) return;
    panel.classList.toggle("is-hidden", !(isNight && moonPhase));
    if (labelNode) {
      labelNode.textContent = moonLabel;
    }
  }
  getMoonPhaseState() {
    const moonEntityId = String(this._config.moon_entity || "").trim();
    if (!moonEntityId) return "";
    const moonState = this.lookup(moonEntityId);
    const phase = String(moonState?.state || "").trim().toLowerCase();
    if (!phase || phase === "unknown" || phase === "unavailable") return "";
    return phase;
  }
  formatClockTime(ms) {
    if (!Number.isFinite(ms)) return "--:--";
    return new Date(ms).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  }
  getSimulatedTimestamp(progress) {
    if (!Number.isFinite(progress)) return null;
    const lat = this.getConfiguredLatitude();
    const lon = this.getConfiguredLongitude();
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return startOfDay + progress * 864e5;
    }
    const sunTimes = this.getSunTimes();
    if (sunTimes && Number.isFinite(sunTimes.sunriseMs) && Number.isFinite(sunTimes.sunsetMs) && sunTimes.sunsetMs > sunTimes.sunriseMs) {
      const daySpan = sunTimes.sunsetMs - sunTimes.sunriseMs;
      return sunTimes.sunriseMs + progress * daySpan;
    }
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return startOfDay + progress * 864e5;
  }
  updateDaySimulationControl() {
    const sceneProgress = this._scene?.getSunSimulationProgress?.();
    const activeProgress = Number.isFinite(sceneProgress) ? sceneProgress : this._scene?.getCurrentDayProgress?.();
    const progress = Math.max(0, Math.min(1, Number.isFinite(activeProgress) ? activeProgress : 0));
    this._sunSimulationProgress = Number.isFinite(sceneProgress) ? progress : null;
    this.updateDebugDayTimeDisplay(Number.isFinite(this._sunSimulationProgress) ? this._sunSimulationProgress : progress);
    this.updateDebugTimeMeta();
    this.updateMoonDisplay();
  }
  updateDebugTimeMeta() {
    const node = this.shadowRoot?.getElementById("debug-time-meta");
    if (!node) return;
    const debug = this._scene?.getSunDebugState?.(Date.now());
    if (!debug) {
      node.textContent = "";
      return;
    }
    const mode = Number.isFinite(debug.sunSimulationProgress) ? "SIM" : "REALTIME";
    const effectiveLocal = Number.isFinite(debug.effectiveNowMs) ? this.formatClockTime(debug.effectiveNowMs) : "--:--";
    const realLocal = this.formatClockTime(Date.now());
    const elev = Number.isFinite(debug.currentSunElevationDeg) ? debug.currentSunElevationDeg.toFixed(2) : "n/a";
    const nightTimes = debug.nightFromSunTimes == null ? "n/a" : debug.nightFromSunTimes ? "yes" : "no";
    const sprite = debug.sunSpriteVisible ? "on" : "off";
    node.textContent = `MODE ${mode} | REAL ${realLocal} | EFF ${effectiveLocal}\nELEV ${elev}° | NIGHT_BY_TIMES ${nightTimes} | SUN ${sprite}`;
  }
  updateDateTimeDisplay() {
    const timeNode = this.shadowRoot?.getElementById("clock-time");
    const dateNode = this.shadowRoot?.getElementById("clock-date");
    if (!timeNode || !dateNode) return;
    const now = new Date();
    timeNode.textContent = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    dateNode.textContent = now.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
  }
  getDisplayScaleValue(raw, fallback = 1) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0.5, Math.min(2.5, parsed));
  }
  applyDisplayScales() {
    const dateTimeOverlay = this.shadowRoot?.querySelector(".date-time-overlay");
    const metricPanel = this.shadowRoot?.querySelector(".metric-panel");
    const weatherPanel = this.shadowRoot?.querySelector(".weather-panel");
    const dateTimeScale = this.getDisplayScaleValue(this._config.date_time_scale, 1);
    const metricsScale = this.getDisplayScaleValue(this._config.metrics_scale, 1);
    const weatherScale = this.getDisplayScaleValue(this._config.weather_scale, 1);
    if (dateTimeOverlay) {
      dateTimeOverlay.style.transformOrigin = "top left";
      dateTimeOverlay.style.transform = `scale(${dateTimeScale})`;
    }
    if (metricPanel) {
      metricPanel.style.transformOrigin = "bottom left";
      metricPanel.style.transform = `scale(${metricsScale})`;
    }
    if (weatherPanel) {
      weatherPanel.style.transformOrigin = "bottom right";
      weatherPanel.style.transform = `scale(${weatherScale})`;
    }
  }
  startDateTimeTimer() {
    if (this._dateTimeTimer) {
      clearInterval(this._dateTimeTimer);
    }
    this.updateDateTimeDisplay();
    this.updateMoonDisplay();
    this.updateDebugTimeMeta();
    this._dateTimeTimer = setInterval(() => {
      this.updateDateTimeDisplay();
      this.updateMoonDisplay();
      this.updateDebugTimeMeta();
    }, 1e3);
  }
  render() {
    if (!this.shadowRoot.innerHTML) {
      this.shadowRoot.innerHTML = `
        <style>
          *{box-sizing:border-box}
          :host{
            display:block;
            height:100%;
            min-height:100%;
            overflow:hidden;
          }
          ha-card{
            height:100%;
            min-height:calc(100vh - 32px);
            display:flex;
            flex-direction:column;
            overflow:hidden;
            border-radius:20px;
            --day-card-top:#b5cde4;
            --day-card-mid:#6a87a4;
            --day-card-bottom:#2a3b4d;
            background:linear-gradient(180deg, var(--day-card-top) 0%, var(--day-card-mid) 48%, var(--day-card-bottom) 100%);
            box-shadow:none;
            color:#f5f7fa;
          }
          ha-card.is-night{
            background:linear-gradient(180deg, #020304 0%, #020304 65%, #010203 100%);
            border:none !important;
            outline:none !important;
            box-shadow:none !important;
            --ha-card-border-width:0;
            --ha-card-box-shadow:none;
          }
          .wrap{
            padding:0;
            flex:1;
            display:flex;
            min-height:0;
          }
          .stage{
            position:relative;
            flex:1;
            min-height:620px;
            height:100%;
            width:100%;
            border:none;
            border-radius:18px;
            overflow:hidden;
            --day-stage-top:rgba(151, 192, 236, 0.28);
            --day-stage-mid:rgba(73, 111, 156, 0.16);
            --day-stage-low:rgba(16, 30, 48, 0.06);
            background:radial-gradient(120% 95% at 50% 8%, var(--day-stage-top) 0%, var(--day-stage-mid) 35%, var(--day-stage-low) 70%, rgba(6, 12, 22, 0) 100%);
          }
          .stage.is-night{
            background:radial-gradient(120% 95% at 50% 10%, rgba(24, 28, 36, 0.18) 0%, rgba(10, 13, 18, 0.34) 40%, rgba(4, 6, 9, 0.72) 75%, rgba(2, 3, 4, 0.92) 100%);
          }
          .canvas{position:absolute;inset:0;touch-action:none}
          .canvas canvas{width:100%;height:100%;display:block}
          .overlay{
            position:absolute;
            top:14px;
            right:14px;
            display:flex;
            flex-direction:column;
            gap:8px;
            pointer-events:none;
            align-items:flex-end;
          }
          .date-time-overlay{
            position:absolute;
            top:70px;
            left:70px;
            z-index:3;
            pointer-events:none;
            display:flex;
            flex-direction:column;
            gap:4px;
            align-items:center;
            text-align:center;
          }
          .date-time-time{
            color:#f4f8ff;
            font:600 72px/0.9 "Bahnschrift", "DIN Alternate", "Arial Narrow", "Segoe UI", sans-serif;
            letter-spacing:0.01em;
            text-shadow:0 8px 34px rgba(0,0,0,0.55);
            pointer-events:auto;
            cursor:pointer;
          }
          .date-time-date{
            color:rgba(220,232,247,0.9);
            font:600 16px/1 "Rajdhani", "Segoe UI", sans-serif;
            letter-spacing:0.08em;
            text-transform:uppercase;
            text-shadow:0 6px 24px rgba(0,0,0,0.45);
            pointer-events:auto;
            cursor:pointer;
          }
          .metric-panel{
            position:absolute;
            left:46px;
            bottom:80px;
            width:min(420px, calc(100% - 32px));
            display:grid;
            grid-template-columns:repeat(2, minmax(0, 120px));
            gap:10px;
            pointer-events:none;
            z-index:2;
          }
          .weather-panel{
            position:absolute;
            right:46px;
            bottom:80px;
            width:400px;
            display:flex;
            flex-direction:column;
            align-items:flex-end;
            gap:6px;
            padding:10px 12px;
            border-radius:14px;
            backdrop-filter:blur(6px);
            z-index:2;
            pointer-events:auto;
            cursor:pointer;
          }
          .weather-panel.is-hidden{
            display:none;
          }
          .moon-panel{
            position:absolute;
            top:28px;
            right:14px;
            z-index:2;
            pointer-events:none;
            display:flex;
            flex-direction:column;
            align-items:flex-end;
            gap:6px;
          }
          .moon-panel.is-hidden{
            display:none;
          }
          .moon-label{
            color:rgba(198, 206, 217, 0.72);
            font:700 11px/1 Inter, "Rajdhani", "Segoe UI", sans-serif;
            letter-spacing:0.08em;
            text-transform:uppercase;
            text-align:right;
            width:100%;
          }
          .starlink-panel{
            position:absolute;
            left:14px;
            top:14px;
            width:min(420px, calc(100% - 28px));
            height:min(300px, 45%);
            border:1px solid rgba(198, 206, 217, 0.35);
            border-radius:14px;
            background:#000;
            box-shadow:0 16px 32px rgba(0,0,0,0.45);
            z-index:4;
            overflow:hidden;
            pointer-events:auto;
          }
          .starlink-panel.is-hidden{
            display:none;
          }
          .starlink-close{
            position:absolute;
            top:8px;
            right:8px;
            width:28px;
            height:28px;
            border:1px solid rgba(198, 206, 217, 0.35);
            border-radius:999px;
            background:rgba(9, 14, 24, 0.7);
            color:#e6eef8;
            font:700 16px/1 "Segoe UI", sans-serif;
            cursor:pointer;
            z-index:2;
          }
          .starlink-frame{
            width:100%;
            height:100%;
            border:none;
            background:#000;
          }
          .weather-label{
            color:rgba(198, 206, 217, 0.72);
            font:600 30px/1 "Rajdhani", "Segoe UI", sans-serif;
            letter-spacing:0.08em;
            text-transform:uppercase;
          }
          .weather-inside-label.is-hidden{
            display:none;
          }
          .weather-panel.is-night .weather-label{
            color:rgba(198, 206, 217, 0.72);
          }
          .scene-debug-controls{
            position:absolute;
            top:14px;
            left:14px;
            z-index:5;
            display:none;
            align-items:flex-start;
            gap:8px;
            padding:8px 10px;
            border-radius:12px;
            border:1px solid rgba(198, 206, 217, 0.32);
            background:rgba(9, 14, 24, 0.72);
            backdrop-filter:blur(6px);
            pointer-events:auto;
          }
          .scene-debug-controls label{
            color:rgba(224, 234, 246, 0.88);
            font:600 10px/1 "Rajdhani", "Segoe UI", sans-serif;
            letter-spacing:0.12em;
            text-transform:uppercase;
            white-space:nowrap;
          }
          .scene-debug-controls select{
            min-width:152px;
            height:28px;
            border-radius:8px;
            border:1px solid rgba(198, 206, 217, 0.38);
            background:rgba(9, 14, 24, 0.95);
            color:#dce7f4;
            font:600 12px/1 "Rajdhani", "Segoe UI", sans-serif;
            letter-spacing:0.04em;
            padding:2px 8px;
          }
          .scene-debug-controls input[type="range"]{
            width:160px;
            accent-color:#dce7f4;
          }
          .scene-debug-controls .debug-value{
            color:rgba(220,231,244,0.92);
            font:700 11px/1 "Rajdhani", "Segoe UI", sans-serif;
            letter-spacing:0.08em;
            min-width:96px;
            text-align:right;
          }
          .scene-debug-controls .debug-meta{
            color:rgba(198, 206, 217, 0.86);
            font:600 10px/1.35 "Rajdhani", "Segoe UI", sans-serif;
            letter-spacing:0.04em;
            white-space:pre;
            margin-top:2px;
          }
          .metric-tile{
            border-radius:14px;
            padding:10px 12px 11px;
            min-height:82px;
            display:flex;
            flex-direction:column;
            justify-content:space-between;
          }
          .metric-title{
            color:rgba(202, 216, 233, 0.76);
            font:600 10px/1 "Rajdhani", "Segoe UI", sans-serif;
            letter-spacing:0.16em;
            text-transform:uppercase;
          }
          .metric-primary{
            color:#f3f8ff;
            font:700 26px/1 "Rajdhani", "Segoe UI", sans-serif;
            letter-spacing:0.02em;
            margin-top:4px;
          }
          .metric-detail{
            color:rgba(198, 206, 217, 0.72);
            font:600 11px/1 "Rajdhani", "Segoe UI", sans-serif;
            letter-spacing:0.08em;
            text-transform:uppercase;
            margin-top:5px;
          }
          @media (max-width: 900px){
            ha-card{min-height:70vh}
            .stage{
              min-height:0;
              display:flex;
              flex-direction:column;
              gap:10px;
              padding:10px;
            }
            .canvas{
              position:relative;
              inset:auto;
              width:100%;
              height:52vh;
              min-height:320px;
              max-height:580px;
              border-radius:12px;
              overflow:hidden;
              order:1;
            }
            .date-time-overlay{
              top:12px;
              left:12px;
            }
            .date-time-time{
              font-size:44px;
            }
            .date-time-date{
              font-size:12px;
              letter-spacing:0.08em;
            }
            .weather-panel{
              position:static;
              width:100%;
              display:flex;
              align-items:center;
              justify-content:center;
              text-align:center;
              gap:6px;
              order:2;
              pointer-events:auto;
            }
            .weather-panel{
              display:none !important;
            }
            .weather-label{
              font-size:24px;
            }
            .metric-panel{
              position:static;
              left:auto;
              right:auto;
              bottom:auto;
              width:100%;
              gap:8px;
              order:3;
              grid-template-columns:repeat(2, minmax(0, 1fr));
            }
            .metric-tile{
              min-height:74px;
              padding:9px 10px;
            }
            .metric-primary{
              font-size:22px;
            }
            .metric-detail{
              font-size:10px;
            }
            .moon-panel{
              display:none !important;
            }
            .scene-debug-controls{
              top:10px;
              left:10px;
              padding:7px 8px;
            }
            .scene-debug-controls select{
              min-width:132px;
              height:26px;
              font-size:11px;
            }
          }
        </style>
        <ha-card id="dynamic-card">
          <div class="wrap">
            <div class="stage">
              <div class="canvas" id="scene"></div>
              <div class="date-time-overlay">
                <div class="date-time-time" id="clock-time">--:--</div>
                <div class="date-time-date" id="clock-date">--</div>
              </div>
              <div class="metric-panel" id="metric-panel">
                <div class="metric-tile" data-tile="solar">
                  <div class="metric-title" data-role="title">SOLAR</div>
                  <div class="metric-primary" data-role="primary">—</div>
                  <div class="metric-detail" data-role="detail">— | —</div>
                </div>
                <div class="metric-tile" data-tile="hookup">
                  <div class="metric-title" data-role="title">HOOKUP</div>
                  <div class="metric-primary" data-role="primary">—</div>
                  <div class="metric-detail" data-role="detail">— | —</div>
                </div>
                <div class="metric-tile" data-tile="alternator">
                  <div class="metric-title" data-role="title">ALTERNATOR</div>
                  <div class="metric-primary" data-role="primary">—</div>
                  <div class="metric-detail" data-role="detail">— | —</div>
                </div>
                <div class="metric-tile" data-tile="battery">
                  <div class="metric-title" data-role="title">BATTERY</div>
                  <div class="metric-primary" data-role="primary">—</div>
                  <div class="metric-detail" data-role="detail">— | —</div>
                </div>
              </div>
              <div class="weather-panel is-hidden" id="weather-panel">
                <div class="weather-label" id="weather-label"></div>
                <div class="weather-label weather-inside-label is-hidden" id="weather-inside-label"></div>
              </div>
              <div class="scene-debug-controls" id="scene-debug-controls">
                <label for="debug-weather-select">Debug Weather</label>
                <select id="debug-weather-select">
                  <option value="">Auto</option>
                  <option value="clear-day">Clear Day</option>
                  <option value="clear-night">Clear Night</option>
                  <option value="partly-cloudy-day">Partly Cloudy Day</option>
                  <option value="partly-cloudy-night">Partly Cloudy Night</option>
                  <option value="cloudy">Cloudy</option>
                  <option value="fog">Fog</option>
                  <option value="rain">Rain</option>
                  <option value="pouring">Pouring</option>
                  <option value="snow">Snow</option>
                  <option value="sleet">Sleet</option>
                  <option value="hail">Hail</option>
                  <option value="lightning">Lightning</option>
                  <option value="lightning-rainy">Lightning Rain</option>
                  <option value="wind">Wind</option>
                  <option value="windy-variant">Windy Variant</option>
                  <option value="exceptional">Exceptional</option>
                </select>
                <label for="debug-daytime-slider">Day Time</label>
                <input id="debug-daytime-slider" type="range" min="0" max="1" step="0.001" value="0.5">
                <span class="debug-value" id="debug-daytime-value">AUTO</span>
                <div class="debug-meta" id="debug-time-meta"></div>
              </div>
              <div class="moon-panel is-hidden" id="moon-panel">
                <div class="moon-label" id="moon-label"></div>
              </div>
              <div class="starlink-panel is-hidden" id="starlink-panel">
                <button class="starlink-close" id="starlink-close" type="button" aria-label="Close Starlink panel">\u00D7</button>
                <iframe class="starlink-frame" id="starlink-frame" title="Starlink Combined"></iframe>
              </div>
              <div class="overlay"></div>
            </div>
          </div>
        </ha-card>
      `;
      this.shadowRoot.getElementById("clock-time")?.addEventListener("click", () => {
        this.openHomepageUrl();
      });
      this.shadowRoot.getElementById("clock-date")?.addEventListener("click", () => {
        this.openHomepageUrl();
      });
      this.shadowRoot.getElementById("weather-panel")?.addEventListener("click", () => {
        this.handleWeatherClick();
      });
      this.shadowRoot.getElementById("debug-weather-select")?.addEventListener("change", (event) => {
        this.handleDebugWeatherSelectChange(event);
      });
      this.shadowRoot.getElementById("debug-weather-select")?.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      this.shadowRoot.getElementById("debug-daytime-slider")?.addEventListener("input", (event) => {
        this.handleDebugDayTimeInput(event);
      });
      this.shadowRoot.getElementById("debug-daytime-slider")?.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      this.syncDebugWeatherSelect();
      this.shadowRoot.getElementById("starlink-close")?.addEventListener("click", () => {
        this.closeStarlinkPanel();
      });
      this.shadowRoot.getElementById("starlink-panel")?.addEventListener("click", (event) => {
        if (event?.target?.id === "starlink-panel") {
          this.closeStarlinkPanel();
        }
      });
      this.shadowRoot.addEventListener("pointerdown", (event) => {
        const panel = this.shadowRoot?.getElementById("starlink-panel");
        if (!panel || panel.classList.contains("is-hidden")) return;
        const target = event?.target;
        if (target && panel.contains(target)) return;
        this.closeStarlinkPanel();
      });
    }
    if (!this._scene) {
      const initialView = !this._spinEnabled ? this._viewState : null;
      this._scene = createVanScene(this.shadowRoot.getElementById("scene"), {
        modelUrl: VAN_MODEL_URL,
        interactive: true,
        onContextLost: () => {
          this._scene = null;
          if (this.isConnected) setTimeout(() => this.render(), 2000);
        },
        lowPowerMode: this.isLowPowerModeEnabled(),
        maxPixelRatio: this.getConfiguredMaxPixelRatio(),
        fpsLimit: this.getConfiguredFpsLimit(),
        autoRotate: this.getConfiguredSpinEnabled(),
        autoRotateSpeed: 0.18,
        initialLightingMode: this._lightingMode,
        initialSunIntensityScale: this._sunIntensityScale,
        latitude: this.getConfiguredLatitude(),
        longitude: this.getConfiguredLongitude(),
        initialVanHeadingDegrees: this.parseStateNumber(this._config.van_heading_entity),
        initialVanHeadingOffsetDegrees: this.parseConfiguredNumber(this._config.van_heading_offset_degrees),
        initialModelLightsLevel: this._modelLightsLevel,
        modelLightConeDegrees: Number(this._config.model_light_cone_degrees),
        modelLightDistance: Number(this._config.model_light_distance),
        modelLightPenumbra: Number(this._config.model_light_penumbra),
        modelLightIntensityBoost: Number(this._config.model_light_intensity_boost),
        initialRotationY: initialView?.rotationY,
        initialPitch: initialView?.pitch,
        initialRadius: initialView?.radius,
        compassVisible: this.useCompass(),
        labelsVisible: this.useFloatingMetrics(),
        cloudsVisible: this.useClouds(),
        onModelLightClick: (index, detail) => {
          this.handleModelLightClick(index, detail);
        },
        onGrillClick: (index) => {
          this.handleGrillClick(index);
        },
        onCameraClick: (index) => {
          this.handleCameraClick(index);
        },
        onStarlinkClick: (_, detail) => {
          this.handleStarlinkClick(detail);
        },
        onMorphChange: (value) => {
          this._morphOpen = Number(value) >= 0.5;
          this.writeStoredBoolean(STORAGE_KEYS.morphOpen, this._morphOpen);
        },
        labelsSpinWithModel: false,
        morphTargetName: "Key 1"
      });
      this._scene.setMorphValue(this._morphOpen ? 1 : 0);
      this._sunIntensityScale = this._scene.setSunIntensityScale?.(this._sunIntensityScale) ?? this._sunIntensityScale;
      this.applySceneControlConfig();
      this._scene.setCompassVisible?.(this.useCompass());
      this._scene.setLabelsVisible?.(this.useFloatingMetrics());
      this._scene.setCloudsVisible?.(this.useClouds());
      this._lightingMode = this._scene.setLightingMode?.(this._lightingMode) || this._lightingMode;
      this._modelLightsLevel = this._scene.setModelLightsLevel?.(this._modelLightsLevel) ?? this._modelLightsLevel;
      this.writeStoredNumber(STORAGE_KEYS.modelLightsLevel, this._modelLightsLevel);
      this.startViewStatePersistence();
    }
    this.updateWeatherDisplay();
    this.updateMoonDisplay();
    this.updateDaySimulationControl();
    this.startDateTimeTimer();
    this.applyDisplayScales();
    this.updateMetricTiles();
  }
  update() {
    if (!this._hass) return;
    this.applyDisplayScales();
    this._scene?.setCompassVisible?.(this.useCompass());
    this._scene?.setLabelsVisible?.(this.useFloatingMetrics());
    this._scene?.setCloudsVisible?.(this.useClouds());
    this._scene?.setLabels?.(this.buildSceneLabels());
    this.updateMetricTiles();
    this._scene?.setSunLocation?.(
      this.getConfiguredLatitude(),
      this.getConfiguredLongitude()
    );
    this._scene?.setVanHeading?.(
      this.parseStateNumber(this._config.van_heading_entity),
      this.parseConfiguredNumber(this._config.van_heading_offset_degrees)
    );
    const sunTimes = this.getSunTimes();
    this._scene?.setSunTimes?.(sunTimes?.sunriseMs, sunTimes?.sunsetMs);
    this.applySceneControlConfig();
    this.updateDaySimulationControl();
    this._scene?.setModelLightLevels?.([
      this.parseLightPercent(this._config.model_light_1_entity) / 100,
      this.parseLightPercent(this._config.model_light_2_entity) / 100
    ]);
    this.updateWeatherDisplay();
    this.updateMoonDisplay();
  }
};
var EDITOR_FIELD_GROUPS = [
  {
    title: "Power Entities",
    fields: [
      { key: "solar_voltage", label: "Solar Voltage Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "solar_amp", label: "Solar Current Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "solar_watt", label: "Solar Power Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "battery_voltage", label: "Battery Voltage Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "battery_amp", label: "Battery Current Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "battery_watt", label: "Battery Power Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "battery_percent", label: "Battery Percent Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "grid_voltage", label: "Hookup Voltage Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "grid_amp", label: "Hookup Current Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "grid_watt", label: "Hookup Power Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "alternator_voltage", label: "Alternator Voltage Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "alternator_amp", label: "Alternator Current Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "alternator_watt", label: "Alternator Power Entity", type: "entity", includeDomains: ["sensor"] }
    ]
  },
  {
    title: "Sun Model",
    fields: [
      { key: "sun_entity", label: "Sun Entity (next_dawn/next_dusk)", type: "entity", includeDomains: ["sun"] },
      { key: "moon_entity", label: "Moon Phase Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "location_entity", label: "Location Entity", type: "entity", includeDomains: ["device_tracker", "person", "zone", "sensor"] },
      { key: "latitude_attribute", label: "Latitude Attribute", type: "text" },
      { key: "longitude_attribute", label: "Longitude Attribute", type: "text" },
      { key: "latitude_entity", label: "Latitude Entity", type: "entity", includeDomains: ["sensor", "input_number", "number"] },
      { key: "longitude_entity", label: "Longitude Entity", type: "entity", includeDomains: ["sensor", "input_number", "number"] },
      { key: "van_heading_entity", label: "Van Heading Entity", type: "entity", includeDomains: ["sensor", "input_number", "number", "device_tracker"] },
      { key: "van_heading_offset_degrees", label: "Van Heading Offset (deg)", type: "number", step: "0.1" },
      { key: "sun_intensity_scale", label: "Sun Intensity Scale (0-5)", type: "number", step: "0.01", min: "0", max: "5" }
    ]
  },
  {
    title: "Model Lights",
    fields: [
      { key: "model_light_1_entity", label: "Model Light 1 Entity", type: "entity", includeDomains: ["light"] },
      { key: "model_light_2_entity", label: "Model Light 2 Entity", type: "entity", includeDomains: ["light"] },
      { key: "camera_left_entity", label: "Camera Left Entity", type: "entity", includeDomains: ["camera"] },
      { key: "camera_right_entity", label: "Camera Right Entity", type: "entity", includeDomains: ["camera"] },
      { key: "upper_grill", label: "Upper Grill Entity", type: "entity" },
      { key: "lower_grill", label: "Lower Grill Entity", type: "entity" },
      { key: "model_light_cone_degrees", label: "Light Cone Degrees", type: "number", step: "1" },
      { key: "model_light_distance", label: "Light Distance", type: "number", step: "0.1" },
      { key: "model_light_penumbra", label: "Light Penumbra", type: "number", step: "0.01" },
      { key: "model_light_intensity_boost", label: "Light Intensity Boost", type: "number", step: "0.1" }
    ]
  },
  {
    title: "Display",
    fields: [
      { key: "light_style", label: "Light Style", type: "select", options: [{ value: "studio", label: "Studio" }, { value: "spotlight", label: "Model" }] },
      { key: "show_compass", label: "Show Compass", type: "boolean" },
      { key: "show_floating_metrics", label: "Show Floating Metrics", type: "boolean" },
      { key: "show_clouds", label: "Show Clouds", type: "boolean" },
      { key: "spin_enabled", label: "Spin Enabled", type: "boolean" },
      { key: "debug_time_of_day", label: "Debug Time Of Day (0-1)", type: "number", step: "0.01", min: "0", max: "1" },
      { key: "fullscreen", label: "Fullscreen", type: "boolean" },
      { key: "homepage_url", label: "Homepage URL", type: "text" },
      { key: "date_time_scale", label: "Date/Time Scale", type: "number", step: "0.05", min: "0.5", max: "2.5" },
      { key: "metrics_scale", label: "Metrics Scale", type: "number", step: "0.05", min: "0.5", max: "2.5" },
      { key: "weather_scale", label: "Weather Scale", type: "number", step: "0.05", min: "0.5", max: "2.5" }
    ]
  },
  {
    title: "Performance",
    fields: [
      { key: "low_power_mode", label: "Low Power Mode", type: "select", options: [{ value: "auto", label: "Auto (lower quality on Android)" }, { value: "true", label: "Always On" }, { value: "false", label: "Always Off" }] },
      { key: "max_pixel_ratio", label: "Max Pixel Ratio", type: "number", step: "0.1", min: "0.5", max: "2" },
      { key: "fps_limit", label: "FPS Limit", type: "number", step: "1", min: "1", max: "60" }
    ]
  },
  {
    title: "Weather",
    fields: [
      { key: "weather_entity", label: "Weather Entity", type: "entity", includeDomains: ["weather"] },
      { key: "inside_temp_entity", label: "Inside Temperature Entity (Optional)", type: "entity", includeDomains: ["sensor", "input_number", "number"] }
    ]
  }
];
var VanPowerCardEditor = class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = { ...DEFAULT_CONFIG };
    this._hass = null;
  }
  setConfig(config) {
    this._config = { ...DEFAULT_CONFIG, ...config || {} };
    this.render();
  }
  set hass(hass) {
    this._hass = hass;
    this.applyHassToEntityForms();
  }
  applyHassToEntityForms() {
    this.shadowRoot?.querySelectorAll("ha-form[data-key]").forEach((form) => {
      form.hass = this._hass;
    });
  }
  emitConfigChanged() {
    const nextConfig = { type: this._config.type || "custom:van-power-card" };
    Object.keys(DEFAULT_CONFIG).forEach((key) => {
      const value = this._config[key];
      const defaultValue = DEFAULT_CONFIG[key];
      if (value === "" || value == null) return;
      if (typeof defaultValue === "number" && typeof value === "number" && Number.isFinite(value) && value === defaultValue) return;
      if (typeof defaultValue === "boolean" && Boolean(value) === defaultValue) return;
      if (value === defaultValue) return;
      nextConfig[key] = value;
    });
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: nextConfig },
      bubbles: true,
      composed: true
    }));
  }
  updateField(key, rawValue, type) {
    if (type === "boolean") {
      this._config[key] = Boolean(rawValue);
      this.emitConfigChanged();
      return;
    }
    if (type === "number") {
      const parsed = Number(rawValue);
      this._config[key] = Number.isFinite(parsed) ? parsed : null;
      this.emitConfigChanged();
      return;
    }
    this._config[key] = String(rawValue || "").trim();
    this.emitConfigChanged();
  }
  getEntitySelector(field) {
    const includeDomains = Array.isArray(field.includeDomains) ? field.includeDomains.filter((domain) => typeof domain === "string" && domain) : [];
    if (includeDomains.length >= 1) {
      return { entity: { domain: includeDomains.length === 1 ? includeDomains[0] : includeDomains } };
    }
    return { entity: {} };
  }
  renderField(field) {
    const value = this._config[field.key];
    if (field.type === "entity") {
      return `
        <div class="field">
          <label>${field.label}</label>
          <ha-form data-key="${field.key}"></ha-form>
        </div>
      `;
    }
    if (field.type === "boolean") {
      return `
        <label class="field checkbox">
          <input type="checkbox" data-key="${field.key}" ${value ? "checked" : ""} />
          <span>${field.label}</span>
        </label>
      `;
    }
    if (field.type === "text") {
      return `
      <div class="field">
        <label>${field.label}</label>
        <input type="text" data-key="${field.key}" value="${value ?? ""}" />
      </div>
    `;
    }
    if (field.type === "select") {
      const options = Array.isArray(field.options) ? field.options : [];
      const optionsMarkup = options.map((option) => {
        const optionValue = String(option?.value ?? "");
        const optionLabel = String(option?.label ?? optionValue);
        const selected = String(value ?? "") === optionValue ? "selected" : "";
        return `<option value="${optionValue}" ${selected}>${optionLabel}</option>`;
      }).join("");
      return `
      <div class="field">
        <label>${field.label}</label>
        <select data-key="${field.key}">${optionsMarkup}</select>
      </div>
    `;
    }
    return `
      <div class="field">
        <label>${field.label}</label>
        <input type="number" data-key="${field.key}" step="${field.step || "any"}" min="${field.min || ""}" max="${field.max || ""}" value="${value ?? ""}" />
      </div>
    `;
  }
  render() {
    const groupsMarkup = EDITOR_FIELD_GROUPS.map((group) => `
      <section class="group">
        <h3>${group.title}</h3>
        <div class="grid">
          ${group.fields.map((field) => this.renderField(field)).join("")}
        </div>
      </section>
    `).join("");
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block}
        .wrap{
          display:flex;
          flex-direction:column;
          gap:14px;
          padding:12px 0 4px;
          color:var(--primary-text-color);
        }
        .group{
          border:1px solid var(--divider-color);
          border-radius:14px;
          padding:12px;
          background:var(--card-background-color);
        }
        .group h3{
          margin:0 0 10px;
          font-size:15px;
          font-weight:700;
        }
        .grid{
          display:grid;
          grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));
          gap:10px 12px;
        }
        .field{
          display:flex;
          flex-direction:column;
          gap:6px;
        }
        .field label{
          font-size:12px;
          color:var(--secondary-text-color);
        }
        .field.checkbox{
          display:flex;
          flex-direction:row;
          align-items:center;
          gap:8px;
          min-height:40px;
        }
        .field.checkbox span{
          font-size:13px;
          color:var(--primary-text-color);
        }
        input[type="number"]{
          width:100%;
          border:1px solid var(--divider-color);
          border-radius:10px;
          padding:8px 10px;
          font:inherit;
          color:var(--primary-text-color);
          background:var(--secondary-background-color, transparent);
        }
        input[type="text"]{
          width:100%;
          border:1px solid var(--divider-color);
          border-radius:10px;
          padding:8px 10px;
          font:inherit;
          color:var(--primary-text-color);
          background:var(--secondary-background-color, transparent);
        }
        select{
          width:100%;
          border:1px solid var(--divider-color);
          border-radius:10px;
          padding:8px 10px;
          font:inherit;
          color:var(--primary-text-color);
          background:var(--secondary-background-color, transparent);
        }
        ha-form{display:block}
      </style>
      <div class="wrap">${groupsMarkup}</div>
    `;
    EDITOR_FIELD_GROUPS.forEach((group) => {
      group.fields.forEach((field) => {
        if (field.type === "entity") {
          const form = this.shadowRoot.querySelector(`ha-form[data-key="${field.key}"]`);
          if (!form) return;
          form.hass = this._hass;
          form.data = { [field.key]: this._config[field.key] || "" };
          form.schema = [
            {
              name: field.key,
              label: "",
              selector: this.getEntitySelector(field)
            }
          ];
          form.computeLabel = () => "";
          form.addEventListener("value-changed", (event) => {
            this.updateField(field.key, event.detail?.value?.[field.key] || "", field.type);
          });
          return;
        }
        const input = this.shadowRoot.querySelector(`[data-key="${field.key}"]`);
        if (!input) return;
        if (field.type === "boolean") {
          input.addEventListener("change", (event) => {
            this.updateField(field.key, event.target.checked, field.type);
          });
        } else if (field.type === "select") {
          input.addEventListener("change", (event) => {
            this.updateField(field.key, event.target.value, "text");
          });
        } else if (field.type === "text") {
          input.addEventListener("change", (event) => {
            this.updateField(field.key, event.target.value, field.type);
          });
        } else {
          input.addEventListener("change", (event) => {
            this.updateField(field.key, event.target.value, field.type);
          });
        }
      });
    });
  }
};
VanPowerCard.getConfigElement = function() {
  return document.createElement("van-power-card-editor");
};
VanPowerCard.getStubConfig = function() {
  return { type: "custom:van-power-card" };
};
customElements.define("van-power-card", VanPowerCard);
if (!customElements.get("van-power-card-editor")) {
  customElements.define("van-power-card-editor", VanPowerCardEditor);
}
window.customCards = window.customCards || [];
window.customCards.push({
  type: "van-power-card",
  name: "Van Power Card",
  description: "3D van power dashboard card"
});
export {
  createVanScene
};
/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */
/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/
