import { defineConfig } from "vite-plus";

import { formatPreset } from "./packages/torus-scripts/src/presets/fmt.js";
import { lintPreset } from "./packages/torus-scripts/src/presets/lint.js";

export default defineConfig({
  lint: lintPreset(),
  fmt: formatPreset(),
});
