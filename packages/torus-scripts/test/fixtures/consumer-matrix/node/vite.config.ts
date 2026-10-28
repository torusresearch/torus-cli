import { nodePreset } from "@toruslabs/torus-scripts/node";

const preset = nodePreset({ entry: "src/index.ts" });
export default { ...preset, pack: { ...preset.pack, dts: true } };
