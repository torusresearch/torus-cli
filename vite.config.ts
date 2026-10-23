import { defineConfig } from "vite-plus";

import { typescriptLintPreset } from "./packages/oxlint-config-typescript/index.js";
import { formatPreset } from "./packages/torus-scripts/src/presets/fmt.js";

export default defineConfig({
  lint: typescriptLintPreset(),
  fmt: formatPreset(),
});
