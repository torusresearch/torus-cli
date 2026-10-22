import { reactPreset } from "@toruslabs/torus-scripts/react";

export default {
  ...reactPreset(),
  pack: {
    entry: "src/index.tsx",
    dts: false,
  },
};
