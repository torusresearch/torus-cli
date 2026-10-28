import { defineConfig } from "vite-plus";

import { formatPreset } from "./packages/torus-scripts/src/presets/fmt.js";

export default defineConfig({
  fmt: formatPreset(),
});
