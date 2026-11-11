// Runtime asset URLs, resolved relative to the bundled entrypoint (repo root).
export const VAN_MODEL_URL = new URL("./van.glb?v=20260902-perf4", import.meta.url).toString();
export const MOON_MODEL_URL = new URL("./the_moon.glb", import.meta.url).toString();
export const GROUND_GRASS_ALBEDO_URL = new URL("./ground/albedo-1024.webp", import.meta.url).toString();
export const GROUND_GRASS_AO_URL = new URL("./ground/ao-1024.webp", import.meta.url).toString();
export const GROUND_GRASS_HEIGHT_URL = new URL("./ground/height-1024.webp", import.meta.url).toString();
export const GROUND_GRASS_NORMAL_URL = new URL("./ground/normal-ogl-1024.webp", import.meta.url).toString();
