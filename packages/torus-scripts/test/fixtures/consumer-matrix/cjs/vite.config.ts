import { libraryPreset } from "@toruslabs/torus-scripts/library";

export default libraryPreset({ entry: "src/index.ts", format: ["esm", "cjs"] });
