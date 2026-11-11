import { AmbientLight, Box3, BufferGeometry, Color, DirectionalLight, Float32BufferAttribute, Fog, Group, Object3D, PCFShadowMap, PerspectiveCamera, Points, PointsMaterial, SRGBColorSpace, Scene, SpotLight, Sprite, SpriteMaterial, Vector3, WebGLRenderer } from "vendor:three";
import { bearingDegToXZ, clamp, clampModelLightsLevel, clampUnit, getRelativeBearingDeg, getSolarPositionFromLatLon, legacyAzimuthRadToBearingDeg, mix, normalizeProgress, radToDeg, shortestAngleDelta, wrapAngle, wrapDegrees } from "./math.js";
import { buildSunSpriteTexture, drawLabel } from "./sprite-textures.js";
import { createCloudComponent } from "./clouds.js";
import { createCompass } from "./compass.js";
import { createGltfLoader, loadModelAsset } from "./model-loader.js";
import { createGroundComponent } from "./ground.js";
import { createHotspotPicker } from "./hotspot-picker.js";
import { createPrecipComponent } from "./precipitation.js";
import { createSceneLabels } from "./labels.js";
import { createSkyDomeComponent } from "./sky-dome.js";
import { DEFAULT_WIND_FROM_DEG, SNOW_BUILD_SECONDS, dryingPerSecond, fogFromVisibility, frostAmount, gustEnvelope, gustinessFromSpeeds, precipRateFromMm, sceneFogRange, snowMeltPerSecond, windAmountFromSpeed } from "./weather-model.js";
import { getBaseGeometryBox } from "./model-bounds.js";
import { VAN_MODEL_URL } from "../assets.js";
import { WEATHER_RECIPES, normalizeWeatherCondition } from "./weather-recipes.js";

export function createVanScene(container, options = {}) {
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
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 100);
  const loader = createGltfLoader();
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
  const rootGroup = new Group();
  const modelGroup = new Group();
  const labelGroup = new Group();
  const compassGroup = new Group();
  const { createCompassUnderModel, updateCompassOrientation } = createCompass({ compassGroup, getVanBearingDeg });
  const assetGroups = /* @__PURE__ */ new Map();
  const assetGroupVisibility = /* @__PURE__ */ new Map();
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
  const { getAnchorLocalCenter, getModelLightPickIndex, getCameraPickIndex, getStarlinkPickIndex, getGrillPickIndex, isAwningClick, isHotspotAt } = createHotspotPicker({ awningPickMeshes, camera, cameraPickAnchors, canvas, grillPickMeshes, modelLights, starlinkPickAnchors });
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
    const spot = new SpotLight(
      color,
      normalizedBaseIntensity,
      modelSpotDistance,
      modelSpotHalfAngle,
      modelSpotPenumbra,
      2
    );
    spot.position.copy(localCenter);
    const target = new Object3D();
    const sideSign = localCenter.x >= 0 ? 1 : -1;
    const outward = new Vector3(sideSign, -1, 0).normalize();
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
  let morphValue = 0;
  let targetMorphValue = 0;
  const labelSpecs = options.labelSpecs || {
    grid: { angle: -2.72, radius: 3.55, y: -0.22, scale: 1.45, title: "HOOKUP" },
    battery: { angle: -0.78, radius: 3.45, y: -0.22, scale: 1.45, title: "BATTERY" },
    alternator: { angle: 2.45, radius: 3.1, y: -0.22, scale: 1.45, title: "ALTERNATOR" },
    solar: { angle: 0.62, radius: 2.85, y: -0.22, scale: 1.55, title: "SOLAR" }
  };
  const { createLabelEntry, setLabels, updateLabelPositions } = createSceneLabels({ getLabelsSpinWithModel: () => labelsSpinWithModel, getRotationY: () => rotationY, labelGroup, labelSpecs, requestSceneRender });
  function requestSceneRender() {
    renderDirty = true;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
  renderer.outputColorSpace = SRGBColorSpace;
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
  const ambientLight = new AmbientLight(16777215, 2.2);
  scene.add(ambientLight);
  const frontLight = new DirectionalLight(16777215, 1.6);
  frontLight.position.set(8, 9, 10);
  scene.add(frontLight);
  const rearLight = new DirectionalLight(16777215, 1.3);
  rearLight.position.set(-8, 7, -10);
  scene.add(rearLight);
  const sideLight = new DirectionalLight(16777215, 0.9);
  sideLight.position.set(0, 6, -12);
  scene.add(sideLight);
  const sunLight = new DirectionalLight(16777215, 0);
  sunLight.position.set(0, 26, 18);
  scene.add(sunLight);
  // Sun shadows (off in low-power mode). The shadow map is only re-rendered when the
  // sun moves, the model changes or the awning animates (see updateSunShadow).
  const sunShadowsEnabled = !lowPowerMode && options.sunShadows !== false;
  let sunShadowDirty = true;
  const lastShadowSunDir = new Vector3();
  if (sunShadowsEnabled) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    const shadowCamera = sunLight.shadow.camera;
    // Orthographic box around the van in light space; negative near because the
    // light sits only SUN_DISTANCE from the origin.
    shadowCamera.left = -7;
    shadowCamera.right = 7;
    shadowCamera.top = 7;
    shadowCamera.bottom = -7;
    shadowCamera.near = -40;
    shadowCamera.far = 40;
    shadowCamera.updateProjectionMatrix();
    sunLight.shadow.bias = -5e-4;
    sunLight.shadow.normalBias = 0.02;
    sunLight.shadow.radius = 5;
  }
  function updateSunShadow() {
    if (!sunShadowsEnabled) return;
    const len = Math.max(1e-6, sunLight.position.length());
    const dx = sunLight.position.x / len;
    const dy = sunLight.position.y / len;
    const dz = sunLight.position.z / len;
    const moved = Math.abs(dx - lastShadowSunDir.x) + Math.abs(dy - lastShadowSunDir.y) + Math.abs(dz - lastShadowSunDir.z) > 2e-3;
    const morphing = Math.abs(targetMorphValue - morphValue) >= 1e-3;
    if (sunShadowDirty || moved || morphing) {
      lastShadowSunDir.set(dx, dy, dz);
      sunShadowDirty = false;
      renderer.shadowMap.needsUpdate = true;
    }
  }
  const sunSpriteTexture = buildSunSpriteTexture();
  const sunSpriteMaterial = new SpriteMaterial({
    map: sunSpriteTexture,
    fog: false,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    opacity: 0
  });
  const sunSprite = new Sprite(sunSpriteMaterial);
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
    const starsGeometry = new BufferGeometry();
    starsGeometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(positions), 3));
    const starsMaterial = new PointsMaterial({
      color: 16777215,
      fog: false,
      size: 0.24,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false
    });
    const stars = new Points(starsGeometry, starsMaterial);
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
  const weatherGroup = new Group();
  scene.add(weatherGroup);
  // Linear distance fog for haze/fog weather; colour follows the sky's horizon (set in updateWeatherEffects).
  scene.fog = new Fog(0xb8c4cf, 1e4, 2e4);
  const skyComponent = createSkyDomeComponent(weatherGroup);
  const groundComponent = createGroundComponent(rootGroup, {
    requestRender: requestSceneRender,
    fogColor: scene.fog.color,
    maxAnisotropy: renderer.capabilities.getMaxAnisotropy()
  });
  const cloudComponent = createCloudComponent(weatherGroup, { options, camera, requestRender: requestSceneRender });
  const precipComponent = createPrecipComponent(weatherGroup, { getWeatherCondition: () => currentWeatherCondition });
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
  // Measured weather (from the card). Unknown values fall back to the recipe.
  let weatherInputs = {};
  // Debug overrides for ground wetness / snow cover (null = simulate).
  let surfaceOverrides = { wetness: null, snowCover: null };
  let weatherFrostAmount = 0;
  let weatherCloudMotionSpeed = 1;
  let weatherSurfaceSnow = 0;
  let weatherLowFog = 0;
  // Smoothed wind direction in scene space (unit vector the wind blows towards).
  let windDirX = 1;
  let windDirZ = 0;
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
          material.color.lerp(new Color(0.93, 0.94, 0.96), snow * 0.22);
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
    // Wind: measured speed when known, with gusts riding on top; else the recipe.
    const measuredWind = windAmountFromSpeed(weatherInputs.windSpeedMs);
    const gustiness = gustinessFromSpeeds(weatherInputs.windSpeedMs, weatherInputs.windGustMs);
    const windPulse = gustiness == null ? 0.88 + 0.12 * Math.sin(nowMs * 1e-3 * 0.24) : 1 + gustiness * (gustEnvelope(nowMs) - 0.3);
    const baseWind = measuredWind ?? (weatherInputs.windGustMs != null ? windAmountFromSpeed(weatherInputs.windGustMs * 0.6) : currentWeatherRecipe.wind);
    // Fog/haze: measured visibility + humidity when known; the "fog" condition keeps its floor.
    const measuredFog = fogFromVisibility(weatherInputs.visibilityKm, weatherInputs.humidity);
    const fogBase = measuredFog == null ? currentWeatherRecipe.fog : Math.max(measuredFog, currentWeatherCondition === "fog" ? currentWeatherRecipe.fog : 0);
    // 0..1: how far haze has thickened into low fog (drops and thickens the cloud layer).
    // Driven by the "fog" condition or measured visibility only; the rain/snow recipes'
    // own fog values are rain haze, not low cloud.
    const targetLowFog = currentWeatherCondition === "fog" ? 1 : measuredFog == null ? 0 : clamp((measuredFog - 8e-3) / 6e-3, 0, 1);
    weatherLowFog = mix(weatherLowFog, targetLowFog, clamp(dtSec * 1.8, 0, 1));
    const lowFog = weatherLowFog;
    const fogCloudBonus = 0.24 * lowFog;
    // Cloud amount: measured cloud cover when known (rain and fog keep a heavy-cloud floor), else the recipe.
    const measuredCloud = Number.isFinite(weatherInputs.cloudCoverage) ? clamp(weatherInputs.cloudCoverage / 100, 0, 1) : null;
    const precipCloudFloor = currentWeatherRecipe.precipType !== "none" || currentWeatherCondition === "fog" ? currentWeatherRecipe.cloud * 0.85 : 0;
    const baseCloud = measuredCloud == null ? currentWeatherRecipe.cloud : Math.max(measuredCloud, precipCloudFloor);
    const targetCloud = clamp(baseCloud + nightFactor * 0.06 + fogCloudBonus, 0, 1);
    const targetFog = clamp(fogBase + nightFactor * 0.002, 0, 0.03);
    const precipActive = currentWeatherRecipe.precipType !== "none" && currentWeatherRecipe.precipRate > 0.02;
    // Rain strength: forecast mm/h scales it while the condition says it is raining.
    const targetPrecip = precipActive ? precipRateFromMm(weatherInputs.precipMmPerHour) ?? currentWeatherRecipe.precipRate : currentWeatherRecipe.precipRate;
    const targetWind = clamp(baseWind * windPulse, 0, 1.2);
    const wetSurfaceActive = precipActive && (currentWeatherRecipe.precipType === "rain" || currentWeatherRecipe.precipType === "sleet");
    const targetStorm = currentWeatherRecipe.storm;
    const blend = clamp(dtSec * 1.8, 0, 1);
    weatherCloudAmount = mix(weatherCloudAmount, targetCloud, blend);
    weatherFogDensity = mix(weatherFogDensity, targetFog, blend);
    weatherPrecipRate = mix(weatherPrecipRate, targetPrecip, blend);
    weatherWindAmount = mix(weatherWindAmount, targetWind, blend);
    // Ground wetness: soaks quickly in rain, then dries over tens of minutes.
    if (surfaceOverrides.wetness != null) {
      weatherWetness = surfaceOverrides.wetness;
    } else if (wetSurfaceActive) {
      weatherWetness = mix(weatherWetness, 1, blend);
    } else {
      const drying = dryingPerSecond({ windAmount: weatherWindAmount, dayFactor, humidity: weatherInputs.humidity, temperatureC: weatherInputs.temperatureC });
      weatherWetness = Math.max(0, weatherWetness - drying * dtSec);
    }
    // Snow: builds up over a few minutes while it falls, then lies until it is warm enough to melt.
    const targetSnow = currentWeatherRecipe.snow;
    if (surfaceOverrides.snowCover != null) {
      weatherSnowCover = surfaceOverrides.snowCover;
    } else if (weatherSnowCover < targetSnow) {
      weatherSnowCover = Math.min(targetSnow, weatherSnowCover + dtSec / SNOW_BUILD_SECONDS);
    } else if (weatherSnowCover > targetSnow) {
      const melt = snowMeltPerSecond({ temperatureC: weatherInputs.temperatureC, dayFactor });
      weatherSnowCover = Math.max(targetSnow, weatherSnowCover - melt * dtSec);
    }
    weatherFrostAmount = wetSurfaceActive ? 0 : frostAmount(weatherInputs.temperatureC, weatherInputs.humidity);
    weatherSurfaceSnow = surfaceOverrides.snowCover != null ? weatherSnowCover : Math.max(weatherSnowCover, weatherFrostAmount * 0.22);
    weatherStormLevel = mix(weatherStormLevel, targetStorm, blend);
    // Wind direction: the real bearing (direction it blows FROM) relative to the van's heading,
    // or a south-westerly default; both wander a few degrees. Smoothed so updates don't snap.
    const windFromDeg = weatherInputs.windBearingDeg ?? DEFAULT_WIND_FROM_DEG;
    const wanderDeg = (weatherInputs.windBearingDeg == null ? 12 : 5) * Math.sin(nowMs * 1e-3 * 0.015) + 4 * Math.sin(nowMs * 1e-3 * 0.037 + 1.3);
    const windToRelDeg = getRelativeBearingDeg(windFromDeg + 180 + wanderDeg, getVanBearingDeg());
    const windTarget = bearingDegToXZ(windToRelDeg, 1);
    const dirBlend = clamp(dtSec * 0.4, 0, 1);
    windDirX = mix(windDirX, windTarget.x, dirBlend);
    windDirZ = mix(windDirZ, windTarget.z, dirBlend);
    const windDirLen = Math.max(1e-6, Math.hypot(windDirX, windDirZ));
    windDirX /= windDirLen;
    windDirZ /= windDirLen;
    const windX = windDirX * weatherWindAmount;
    const windZ = windDirZ * weatherWindAmount;
    if (nowMs >= nextSkyRedrawMs || weatherStormLevel > 0.6) {
      nextSkyRedrawMs = nowMs + 120;
      const horizon = skyComponent.drawSky({
        dayFactor,
        cloudAmount: weatherCloudAmount,
        fogDensity: weatherFogDensity,
        stormLevel: weatherStormLevel,
        sunX: sunLight.position.x,
        sunY: sunLight.position.y,
        sunZ: sunLight.position.z
      });
      if (horizon) scene.fog.color.setRGB(horizon.r / 255, horizon.g / 255, horizon.b / 255, SRGBColorSpace);
    }
    const fogRange = sceneFogRange(weatherFogDensity);
    scene.fog.near = fogRange.near;
    scene.fog.far = fogRange.far;
    let cloudGrayness = clamp(weatherCloudAmount * 0.72 + weatherPrecipRate * 0.42 + weatherStormLevel * 0.66 + 0.18 * lowFog, 0, 1);
    if (currentWeatherCondition === "sunny" || currentWeatherCondition === "partlycloudy") {
      cloudGrayness = clamp(cloudGrayness * 0.62 - 0.08, 0, 1);
    }
    groundComponent.setState(dayFactor, weatherWetness, weatherSnowCover, weatherFrostAmount);
    cloudComponent.setState(weatherCloudAmount, dayFactor, weatherWindAmount, cloudGrayness);
    // Clouds travel along the smoothed wind direction at a speed set by wind strength.
    cloudComponent.update(nowMs, dtSec, windDirX, windDirZ, sunLight.position, dayFactor, currentWeatherCondition, currentSunElevationDeg);
    weatherCloudMotionSpeed = cloudComponent.getDriftSpeed();
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
    applyGroundResponse(weatherWetness, weatherSurfaceSnow);
  }
  function setWeatherInputs(inputs = {}) {
    const num = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
    weatherInputs = {
      windSpeedMs: num(inputs.windSpeedMs),
      windGustMs: num(inputs.windGustMs),
      visibilityKm: num(inputs.visibilityKm),
      humidity: num(inputs.humidity),
      temperatureC: num(inputs.temperatureC),
      precipMmPerHour: num(inputs.precipMmPerHour),
      windBearingDeg: num(inputs.windBearingDeg),
      cloudCoverage: num(inputs.cloudCoverage)
    };
    requestSceneRender();
  }
  function setSurfaceOverrides({ wetness = null, snowCover = null } = {}) {
    surfaceOverrides = {
      wetness: Number.isFinite(wetness) ? clamp(wetness, 0, 1) : null,
      snowCover: Number.isFinite(snowCover) ? clamp(snowCover, 0, 1) : null
    };
    requestSceneRender();
  }
  function getWeatherDebugState() {
    return {
      condition: currentWeatherCondition,
      inputs: { ...weatherInputs },
      wind: weatherWindAmount,
      fog: weatherFogDensity,
      cloud: weatherCloudAmount,
      precipRate: weatherPrecipRate,
      wetness: weatherWetness,
      snowCover: weatherSnowCover,
      frost: weatherFrostAmount,
      cloudMotionSpeed: weatherCloudMotionSpeed
    };
  }
  function updateNightBackground() {
    const shouldUseNightBackground = forcedNight || sunBelowHorizon;
    if (nightBackgroundActive === shouldUseNightBackground) return;
    nightBackgroundActive = shouldUseNightBackground;
    renderer.setClearColor(shouldUseNightBackground ? 131844 : 1973790, shouldUseNightBackground ? 1 : 0);
  }
  function getVanBearingDeg() {
    if (!Number.isFinite(vanHeadingDeg)) return null;
    return wrapDegrees(vanHeadingDeg + vanHeadingOffsetDeg);
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
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    // Scale from the full box (keeps the van's established on-screen size), but centre
    // on the body so optional parts like the EV charger don't push the van off-centre.
    const scale = 7.4 / maxDim;
    object.scale.setScalar(scale);
    object.updateMatrixWorld(true);
    box.copy(getBaseModelBox(object, { bodyOnly: true }));
    box.getCenter(center);
    object.position.sub(center);
    object.updateMatrixWorld(true);
    box.copy(getBaseModelBox(object));
    object.position.y -= box.min.y + 1;
    object.updateMatrixWorld(true);
  }
  // Optional or hidden parts (EV charger and cable, asset groups, default-hidden nodes).
  function isOptionalModelNode(node) {
    return node?.userData?.default_hidden === true || Boolean(node?.userData?.asset_group) || /^EV_CHARGER_/i.test(node?.name || "") || node?.name === "Blue_Hookup_Cable";
  }
  function hasOptionalAncestor(node, root) {
    for (let current = node; current && current !== root.parent; current = current.parent) {
      if (isOptionalModelNode(current)) return true;
    }
    return false;
  }
  // World box of the model's static geometry. Morphing parts (the awning) are always
  // excluded; with bodyOnly, optional/hidden parts such as the EV charger are too, so the
  // box is just the van body.
  function getBaseModelBox(object, { bodyOnly = false } = {}) {
    const worldBox = new Box3().makeEmpty();
    const morphTargetName = options.morphTargetName || "Key 1";
    const corners = [
      new Vector3(),
      new Vector3(),
      new Vector3(),
      new Vector3(),
      new Vector3(),
      new Vector3(),
      new Vector3(),
      new Vector3()
    ];
    object.updateMatrixWorld(true);
    object.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;
      if (child.morphTargetDictionary && child.morphTargetDictionary[morphTargetName] != null) {
        return;
      }
      if (bodyOnly && hasOptionalAncestor(child, object)) return;
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
  // Lower the model so its lowest visible part (the tyres) sits just into the grass.
  // The fitted box can include hidden or optional parts that reach lower than the wheels.
  function seatModelOnGround(model) {
    const assetMembers = new Set([...assetGroups.values()].flat());
    const visibleBox = new Box3().makeEmpty();
    const meshBox = new Box3();
    model.updateMatrixWorld(true);
    model.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;
      for (let node = child; node && node !== model; node = node.parent) {
        if (!node.visible || assetMembers.has(node)) return;
      }
      if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
      meshBox.copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld);
      visibleBox.union(meshBox);
    });
    if (visibleBox.isEmpty()) return;
    const offset = groundComponent.groundY - 0.015 - visibleBox.min.y;
    if (Math.abs(offset) > 0.5) return;
    model.position.y += offset;
    model.updateMatrixWorld(true);
  }
  async function loadModel() {
    const model = await loadModelAsset(loader, modelUrl);
    if (destroyed) return;
    fitModel(model);
    const fittedBox = getBaseModelBox(model);
    const bodyBox = getBaseModelBox(model, { bodyOnly: true });
    const fittedSize = new Vector3();
    fittedBox.getSize(fittedSize);
    const compassRadius = Math.max(fittedSize.x, fittedSize.z) * 0.72;
    const compassY = fittedBox.min.y - 0.04;
    createCompassUnderModel(compassRadius, compassY);
    modelGroup.clear();
    modelGroup.add(model);
    if (sunShadowsEnabled) {
      model.traverse((child) => {
        if (child.isMesh) child.castShadow = true;
      });
      sunShadowDirty = true;
    }
    assetGroups.clear();
    model.traverse((child) => {
      if (child?.userData?.default_hidden === true) child.visible = false;
      const isEvChargerNode = /^EV_CHARGER_/i.test(child?.name || "") || child?.name === "Blue_Hookup_Cable";
      const assetGroup = child?.userData?.asset_group || (isEvChargerNode ? "EV_CHARGER_AND_CABLE" : "");
      if (!assetGroup) return;
      if (!assetGroups.has(assetGroup)) assetGroups.set(assetGroup, []);
      assetGroups.get(assetGroup).push(child);
    });
    for (const [assetGroup, visible] of assetGroupVisibility) {
      const members = assetGroups.get(assetGroup) || [];
      for (const member of members) member.visible = visible;
    }
    seatModelOnGround(model);
    groundComponent.setFootprint(bodyBox);
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
    groundComponent.setAwningShade(getAwningShadeBox(getMorphTargetOpenBox(), bodyBox));
    awningShadeValue = morphValue;
    groundComponent.setAwningOpen(morphValue);
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
  let awningShadeValue = -1;
  function applyMorphTargets(value) {
    morphValue = value;
    for (const target of morphTargets) {
      target.mesh.morphTargetInfluences[target.index] = morphValue;
    }
    if (Math.abs(morphValue - awningShadeValue) > 1e-3) {
      awningShadeValue = morphValue;
      groundComponent.setAwningOpen(morphValue);
    }
  }
  // Ground area shaded by the open awning: the part of its open footprint that sticks out
  // beyond the body, on whichever side it opens (plus a little under the van's edge).
  function getAwningShadeBox(openBox, bodyBox) {
    if (openBox.isEmpty() || bodyBox.isEmpty()) return openBox;
    const overhang = {
      "+x": openBox.max.x - bodyBox.max.x,
      "-x": bodyBox.min.x - openBox.min.x,
      "+z": openBox.max.z - bodyBox.max.z,
      "-z": bodyBox.min.z - openBox.min.z
    };
    const side = Object.keys(overhang).reduce((a, b) => (overhang[b] > overhang[a] ? b : a));
    if (overhang[side] < 0.3) return new Box3();
    const shade = openBox.clone();
    const tuck = 0.25;
    if (side === "+x") shade.min.x = bodyBox.max.x - tuck;
    if (side === "-x") shade.max.x = bodyBox.min.x + tuck;
    if (side === "+z") shade.min.z = bodyBox.max.z - tuck;
    if (side === "-z") shade.max.z = bodyBox.min.z + tuck;
    return shade;
  }
  // World box of the morphing parts (the awning) when fully open.
  function getMorphTargetOpenBox() {
    const box = new Box3().makeEmpty();
    const point = new Vector3();
    for (const { mesh, index } of morphTargets) {
      const geometry = mesh.geometry;
      const base = geometry?.attributes?.position;
      const morph = geometry?.morphAttributes?.position?.[index];
      if (!base || !morph) continue;
      mesh.updateMatrixWorld(true);
      for (let i = 0; i < base.count; i++) {
        const mx = morph.getX(i);
        const my = morph.getY(i);
        const mz = morph.getZ(i);
        if (geometry.morphTargetsRelative) point.set(base.getX(i) + mx, base.getY(i) + my, base.getZ(i) + mz);
        else point.set(mx, my, mz);
        box.expandByPoint(point.applyMatrix4(mesh.matrixWorld));
      }
    }
    return box;
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
    updateSunShadow();
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
    setWeatherInputs,
    setSurfaceOverrides,
    getWeatherDebugState,
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
    setAssetGroupVisible(assetGroup, enabled) {
      const key = String(assetGroup || "");
      const visible = Boolean(enabled);
      assetGroupVisibility.set(key, visible);
      const members = assetGroups.get(key) || [];
      for (const member of members) member.visible = visible;
      requestSceneRender();
      return visible;
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
