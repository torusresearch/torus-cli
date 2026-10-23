export default {
  pack: {
    entry: {
      index: "src/index.ts",
      "vue-lint": "src/presets/vue-lint.ts",
      "migrate/inspect": "src/migrate/inspect.ts",
      "migrate/report": "src/migrate/report.ts",
      "migrate/cli": "src/migrate/cli.ts",
    },
    dts: true,
    format: ["esm"],
    sourcemap: true,
  },
};
