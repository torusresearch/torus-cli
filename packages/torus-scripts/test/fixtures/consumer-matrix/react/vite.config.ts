import { libraryPreset } from "@toruslabs/torus-scripts/library";
import { reactPreset } from "@toruslabs/torus-scripts/react";

export default {
  ...reactPreset(),
  ...libraryPreset({ entry: "src/index.tsx", dts: false }),
  pack: {
    ...libraryPreset({ entry: "src/index.tsx", dts: false }).pack,
    banner: { js: '"use client";' },
  },
};
