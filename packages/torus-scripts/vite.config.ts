export default {
  pack: {
    entry: {
      library: "src/presets/library.ts",
      react: "src/presets/react.ts",
      node: "src/presets/node.ts",
      fmt: "src/presets/fmt.ts",
    },
    dts: true,
    format: ["esm"],
    sourcemap: true,
  },
};
