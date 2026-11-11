import { CanvasTexture, Color, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace, TextureLoader } from "vendor:three";
import { clamp, mix } from "./math.js";
import { GROUND_GRASS_ALBEDO_URL, GROUND_GRASS_AO_URL, GROUND_GRASS_HEIGHT_URL, GROUND_GRASS_NORMAL_URL } from "../assets.js";

// Ground: an opaque grass field reaching towards the horizon, with
// - two differently scaled/rotated samples of the grass texture blended by a large-scale
//   noise map, plus lighter/darker/drier patches and bare-earth patches, so it doesn't tile;
// - aerial haze towards the horizon and a soft fade at the far edge;
// - weather: darkening and gloss when wet, puddles in the bare-earth patches,
//   snow settling on the high points first, frost on the grass tips;
// - a soft contact shadow under the van (setFootprint), independent of sun shadows.
const GROUND_RADIUS = 80;
const GRASS_TILE_UNITS = 3.14;
const MACRO_TILE_UNITS = 30;
const GROUND_Y = -1.04;

// Tileable value-noise fbm, one octave set per channel.
function buildMacroNoiseTexture(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  const hash = (x, y, seed) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
    return s - Math.floor(s);
  };
  // Periodic value noise: lattice wraps every `period` cells.
  const noise = (x, y, period, seed) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const wrap = (v) => ((v % period) + period) % period;
    const a = hash(wrap(x0), wrap(y0), seed);
    const b = hash(wrap(x0 + 1), wrap(y0), seed);
    const c = hash(wrap(x0), wrap(y0 + 1), seed);
    const d = hash(wrap(x0 + 1), wrap(y0 + 1), seed);
    return mix(mix(a, b, sx), mix(c, d, sx), sy);
  };
  const fbm = (u, v, basePeriod, seed) => {
    let sum = 0;
    let amp = 0.55;
    let norm = 0;
    let period = basePeriod;
    for (let o = 0; o < 4; o++) {
      sum += noise(u * period, v * period, period, seed + o * 13) * amp;
      norm += amp;
      amp *= 0.5;
      period *= 2;
    }
    return sum / norm;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const i = (y * size + x) * 4;
      image.data[i] = Math.round(255 * fbm(u, v, 4, 1)); // r: texture-sample blend
      image.data[i + 1] = Math.round(255 * fbm(u, v, 3, 7)); // g: lighter/darker/drier patches
      image.data[i + 2] = Math.round(255 * clamp((fbm(u, v, 5, 19) - 0.5) * 1.6 + 0.5, 0, 1)); // b: bare earth / puddles / snow drift
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
}

// Soft rounded-rectangle shadow (alpha) for under the van.
function buildContactShadowTexture(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  // Footprint occupies the inner 70% of the texture; the rest is the soft falloff.
  const half = 0.35;
  const cornerRadius = 0.08;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = Math.abs((x + 0.5) / size - 0.5);
      const py = Math.abs((y + 0.5) / size - 0.5);
      const qx = px - (half - cornerRadius);
      const qy = py - (half - cornerRadius);
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - cornerRadius;
      // Darker core under the van, soft penumbra fading out over ~0.15 of the texture.
      const t = clamp((outside + 0.06) / 0.21, 0, 1);
      const alpha = Math.pow(1 - t * t * (3 - 2 * t), 1.6);
      const i = (y * size + x) * 4;
      image.data[i] = 0;
      image.data[i + 1] = 0;
      image.data[i + 2] = 0;
      image.data[i + 3] = Math.round(255 * alpha);
    }
  }
  ctx.putImageData(image, 0, 0);
  return new CanvasTexture(canvas);
}

export function createGroundComponent(parent, { requestRender, fogColor = null, maxAnisotropy = 1 }) {
  const geometry = new PlaneGeometry(GROUND_RADIUS * 2, GROUND_RADIUS * 2, 16, 16);
  const macroTexture = buildMacroNoiseTexture();
  const uniforms = {
    uMacroMap: { value: macroTexture },
    uHeightMap: { value: macroTexture },
    uMacroScale: { value: 1 / MACRO_TILE_UNITS },
    uRadius: { value: GROUND_RADIUS },
    uWetness: { value: 0 },
    uSnow: { value: 0 },
    uFrost: { value: 0 },
    uDirtColor: { value: new Color(0.13, 0.095, 0.06) },
    uSnowColor: { value: new Color(0.74, 0.77, 0.82) },
    uFrostColor: { value: new Color(0.68, 0.74, 0.8) },
    uSkyColor: { value: fogColor || new Color(0.6, 0.65, 0.7) }
  };
  const material = new MeshStandardMaterial({
    color: new Color(1, 1, 1),
    roughness: 0.92,
    metalness: 0,
    transparent: true,
    depthWrite: false,
    toneMapped: true
  });
  material.customProgramCacheKey = () => "van-ground-v2";
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vGroundWorld;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGroundWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec3 vGroundWorld;
uniform sampler2D uMacroMap;
uniform sampler2D uHeightMap;
uniform float uMacroScale;
uniform float uRadius;
uniform float uWetness;
uniform float uSnow;
uniform float uFrost;
uniform vec3 uDirtColor;
uniform vec3 uSnowColor;
uniform vec3 uFrostColor;
uniform vec3 uSkyColor;`)
      .replace("#include <map_fragment>", `
float groundDist = length(vGroundWorld.xz);
vec4 groundMacro = texture2D(uMacroMap, vGroundWorld.xz * uMacroScale);
float groundPuddle = 0.0;
float groundSnow = 0.0;
float groundGrassHeight = 0.5;
#ifdef USE_MAP
  // Two samples at different scale/rotation, blended by large-scale noise, hide the tiling.
  vec2 groundUvB = mat2(0.8, -0.6, 0.6, 0.8) * vMapUv * 0.71 + vec2(0.31, 0.17);
  vec4 groundTexA = texture2D(map, vMapUv);
  vec4 groundTexB = texture2D(map, groundUvB);
  vec3 groundAlbedo = mix(groundTexA.rgb, groundTexB.rgb, smoothstep(0.38, 0.62, groundMacro.r));
  groundGrassHeight = mix(texture2D(uHeightMap, vMapUv).r, texture2D(uHeightMap, groundUvB).r, smoothstep(0.38, 0.62, groundMacro.r));
#else
  vec3 groundAlbedo = vec3(0.16, 0.2, 0.08);
#endif
// The grass texture is yellow-brown on its own; grade it to a natural green.
groundAlbedo *= vec3(0.7, 1.05, 0.72);
// Lighter / darker patches, and drier yellowish grass in places.
groundAlbedo *= mix(0.78, 1.22, groundMacro.g);
groundAlbedo = mix(groundAlbedo, groundAlbedo * vec3(1.12, 1.02, 0.72), smoothstep(0.6, 0.9, groundMacro.g) * 0.6);
// Bare earth patches.
float groundDirt = smoothstep(0.76, 0.9, groundMacro.b);
groundAlbedo = mix(groundAlbedo, uDirtColor * mix(0.8, 1.15, groundGrassHeight), groundDirt);
// Frost on the grass tips.
groundAlbedo = mix(groundAlbedo, uFrostColor, uFrost * 0.8 * smoothstep(0.3, 0.8, groundGrassHeight) * (1.0 - groundDirt * 0.5));
// Wet: darker overall; puddles form in the bare-earth patches as it gets wetter.
groundAlbedo *= mix(1.0, 0.6, uWetness);
// Water collects in the bare-earth patches and in grassy hollows; the wetter it is,
// the lower the level at which standing water appears, so puddles grow and multiply.
float groundHollow = max(groundMacro.b, (1.0 - groundMacro.r) * 0.96);
float groundPuddleLevel = 0.95 - smoothstep(0.3, 1.0, uWetness) * 0.24;
groundPuddle = smoothstep(groundPuddleLevel, groundPuddleLevel + 0.035, groundHollow) * smoothstep(0.3, 0.65, uWetness);
// No standing water right around the van (it's parked on the firmer ground).
groundPuddle *= smoothstep(4.5, 7.0, groundDist);
groundAlbedo = mix(groundAlbedo, groundAlbedo * 0.35, groundPuddle);
// Snow: settles on high points and drifts first, covering everything as it deepens.
float groundSnowHeight = mix(groundGrassHeight, 1.0 - groundMacro.b, 0.45);
float groundSnowLevel = 1.0 - uSnow * 1.1;
groundSnow = uSnow > 0.001 ? smoothstep(groundSnowLevel - 0.12, groundSnowLevel + 0.12, groundSnowHeight) : 0.0;
groundAlbedo = mix(groundAlbedo, uSnowColor, groundSnow);
diffuseColor.rgb *= groundAlbedo;
// Fade out at the far edge so the ground meets the sky softly.
diffuseColor.a *= 1.0 - smoothstep(uRadius * 0.62, uRadius * 0.98, groundDist);
`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.55, uWetness * 0.6);
roughnessFactor = mix(roughnessFactor, 0.06, groundPuddle);
roughnessFactor = mix(roughnessFactor, 0.78, groundSnow);`)
      .replace("#include <normal_fragment_maps>", `vec3 groundFlatNormal = normal;
#include <normal_fragment_maps>
normal = normalize(mix(normal, groundFlatNormal, max(groundPuddle, groundSnow * 0.75)));`)
      .replace("#include <opaque_fragment>", `// Puddles reflect the sky, more at grazing angles.
float groundFresnel = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 4.0) * 0.55 + 0.08;
outgoingLight = mix(outgoingLight, uSkyColor * 0.8, groundPuddle * groundFresnel);
#include <opaque_fragment>`)
      .replace("#include <fog_fragment>", `#include <fog_fragment>
#ifdef USE_FOG
  // Aerial haze: distant ground fades towards the horizon colour.
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, smoothstep(uRadius * 0.25, uRadius * 0.95, groundDist) * 0.65);
#endif`);
  };
  const mesh = new Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = GROUND_Y;
  mesh.receiveShadow = true;
  mesh.renderOrder = -2;
  parent.add(mesh);

  // Contact shadow under the van (sized in setFootprint once the model has loaded).
  const contactTexture = buildContactShadowTexture();
  const contactMaterial = new MeshBasicMaterial({
    map: contactTexture,
    color: 0x000000,
    transparent: true,
    depthWrite: false,
    // Not fogged: fog would tint the black shadow towards the (light) fog colour.
    fog: false,
    opacity: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  const contactGeometry = new PlaneGeometry(1, 1);
  const contactMesh = new Mesh(contactGeometry, contactMaterial);
  contactMesh.rotation.x = -Math.PI / 2;
  contactMesh.position.y = GROUND_Y + 0.005;
  contactMesh.renderOrder = -1;
  contactMesh.visible = false;
  parent.add(contactMesh);
  // Soft ambient shade on the ground under the open awning. The sun shadow handles direct
  // light; this keeps it shaded on overcast days or with the sun behind the van.
  const awningMaterial = contactMaterial.clone();
  awningMaterial.opacity = 0;
  const awningMesh = new Mesh(contactGeometry, awningMaterial);
  awningMesh.rotation.x = -Math.PI / 2;
  awningMesh.position.y = GROUND_Y + 0.004;
  awningMesh.renderOrder = -1;
  awningMesh.visible = false;
  parent.add(awningMesh);
  let awningOpen = 0;
  let awningShadeReady = false;
  let shadeDayFactor = 1;
  // Size a shadow plane so the box footprint fills the inner 70% of the texture (the rest is penumbra).
  function fitShadowPlane(target, box, pad) {
    const sizeX = box.max.x - box.min.x;
    const sizeZ = box.max.z - box.min.z;
    target.scale.set((sizeX + pad) / 0.7, (sizeZ + pad) / 0.7, 1);
    target.position.x = (box.min.x + box.max.x) / 2;
    target.position.z = (box.min.z + box.max.z) / 2;
  }
  function setFootprint(box) {
    if (!box || box.isEmpty?.()) return;
    fitShadowPlane(contactMesh, box, 0.35);
    contactMesh.visible = true;
    requestRender();
  }
  function setAwningShade(box) {
    awningShadeReady = Boolean(box && !box.isEmpty?.());
    if (awningShadeReady) fitShadowPlane(awningMesh, box, 0.8);
    applyAwningShade();
  }
  function setAwningOpen(value) {
    awningOpen = clamp(Number(value) || 0, 0, 1);
    applyAwningShade();
  }
  function applyAwningShade() {
    const opacity = awningShadeReady ? awningOpen * mix(0.18, 0.3, shadeDayFactor) : 0;
    awningMaterial.opacity = opacity;
    awningMesh.visible = opacity > 0.005;
    requestRender();
  }

  let groundDisposed = false;
  const loadedTextures = [];
  function configureTexture(texture) {
    if (!texture) return;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    const repeat = (GROUND_RADIUS * 2) / GRASS_TILE_UNITS;
    texture.repeat.set(repeat, repeat);
    texture.anisotropy = Math.max(1, Math.min(8, maxAnisotropy || 1));
    texture.needsUpdate = true;
    loadedTextures.push(texture);
  }
  function loadTexture(url) {
    return new Promise((resolve, reject) => {
      const textureLoader = new TextureLoader();
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
    albedoMap.colorSpace = SRGBColorSpace;
    configureTexture(albedoMap);
    configureTexture(aoMap);
    configureTexture(heightMap);
    configureTexture(normalMap);
    material.map = albedoMap;
    material.aoMap = aoMap;
    material.aoMapIntensity = 0.9;
    material.normalMap = normalMap;
    material.normalScale.set(1.1, 1.1);
    uniforms.uHeightMap.value = heightMap;
    material.needsUpdate = true;
    requestRender();
  }).catch(() => {
    requestRender();
  });

  // dayFactor dims the ground at night (the scene's fill lights don't follow the sun).
  function setState(dayFactor, wetness, snowCover, frost = 0) {
    const day = clamp(dayFactor, 0, 1);
    const wet = clamp(wetness, 0, 1);
    const snow = clamp(snowCover, 0, 1);
    const level = mix(0.22, 1, day);
    material.color.setRGB(level, level, level);
    uniforms.uWetness.value = wet;
    uniforms.uSnow.value = snow;
    uniforms.uFrost.value = clamp(frost, 0, 1);
    // Contact shadow: softer at night, a touch stronger on wet ground.
    contactMaterial.opacity = mix(0.38, 0.62, day) * mix(1, 1.1, wet) * mix(1, 0.85, snow);
    if (Math.abs(day - shadeDayFactor) > 0.02) {
      shadeDayFactor = day;
      applyAwningShade();
    }
  }
  function destroyComponent() {
    groundDisposed = true;
    mesh.removeFromParent();
    contactMesh.removeFromParent();
    geometry.dispose();
    material.dispose();
    contactGeometry.dispose();
    contactMaterial.dispose();
    awningMesh.removeFromParent();
    awningMaterial.dispose();
    contactTexture.dispose();
    macroTexture.dispose();
    for (let i = 0; i < loadedTextures.length; i++) {
      loadedTextures[i]?.dispose?.();
    }
  }
  return { setState, setFootprint, setAwningShade, setAwningOpen, groundY: GROUND_Y, destroy: destroyComponent };
}
