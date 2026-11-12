export default {
  pack: {
    entry: { index: "index.ts", "torus-plugin": "torus-plugin.mjs", "tsdoc-plugin": "tsdoc-plugin.mjs" },
    dts: true,
    format: ["esm"],
  },
};
