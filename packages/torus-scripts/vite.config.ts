export default {
  pack: {
    entry: {
      library: "src/presets/library.ts",
      react: "src/presets/react.ts",
      node: "src/presets/node.ts",
      fmt: "src/presets/fmt.ts",
      "migrate/inspect": "src/migrate/inspect.ts",
      "migrate/report": "src/migrate/report.ts",
      "migrate/cli": "src/migrate/cli.ts",
    },
    dts: true,
    format: ["esm"],
    sourcemap: true,
  },
};
