import { libraryPreset } from "@toruslabs/torus-scripts/library";
import { vuePreset } from "@toruslabs/torus-scripts/vue";

export default {
  ...vuePreset(),
  ...libraryPreset({ entry: "src/index.ts" }),
};
