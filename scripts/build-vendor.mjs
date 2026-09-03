import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const outdir = new URL("../vendor/shared/", import.meta.url);
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await build({
  entryPoints: {
    "three-entry": fileURLToPath(new URL("../src/three-entry.js", import.meta.url)),
    "gltf-loader-entry": fileURLToPath(new URL("../src/gltf-loader-entry.js", import.meta.url)),
  },
  bundle: true,
  chunkNames: "chunks/[name]-[hash]",
  entryNames: "[name]",
  format: "esm",
  minify: true,
  outdir: fileURLToPath(outdir),
  splitting: true,
  target: "es2020",
});
