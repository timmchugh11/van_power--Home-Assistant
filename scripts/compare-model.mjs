import { readFile } from "node:fs/promises";

async function readGlbJson(path) {
  const bytes = await readFile(path);
  const jsonLength = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8"));
}

const [sourcePath = "assets/van.source.glb", outputPath = "van.glb"] = process.argv.slice(2);
const [source, output] = await Promise.all([readGlbJson(sourcePath), readGlbJson(outputPath)]);
const sourceNames = new Set(source.nodes.map((node) => node.name).filter(Boolean));
const outputNames = new Set(output.nodes.map((node) => node.name).filter(Boolean));
const missingNames = [...sourceNames].filter((name) => !outputNames.has(name));
const sourceAnimations = source.animations?.map((animation) => animation.name) ?? [];
const outputAnimations = output.animations?.map((animation) => animation.name) ?? [];
const sourceExtraKeys = new Set(source.nodes.flatMap((node) => Object.keys(node.extras ?? {})));
const outputExtraKeys = new Set(output.nodes.flatMap((node) => Object.keys(node.extras ?? {})));
const missingExtraKeys = [...sourceExtraKeys].filter((key) => !outputExtraKeys.has(key));

console.log(JSON.stringify({
  source: { nodes: source.nodes.length, meshes: source.meshes.length, animations: sourceAnimations },
  output: { nodes: output.nodes.length, meshes: output.meshes.length, animations: outputAnimations },
  missingNames,
  missingExtraKeys,
}, null, 2));

if (missingNames.length || missingExtraKeys.length || sourceAnimations.join("\0") !== outputAnimations.join("\0")) {
  process.exitCode = 1;
}
