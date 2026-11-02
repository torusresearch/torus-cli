import { libraryPreset } from "@toruslabs/torus-scripts/library";
import { reactPreset } from "@toruslabs/torus-scripts/react";

const library = libraryPreset({ entry: "src/index.tsx", dts: false });

export default {
  ...reactPreset(),
  pack: {
    ...library.pack,
    banner: { js: '"use client";' },
  },
};
