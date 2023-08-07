const currentPkg = require("./package.json");
const runtimeVersion = currentPkg.peerDependencies["@babel/runtime"];

module.exports = {
  presets: ["@babel/env", "@babel/typescript"],
  plugins: [
    "@babel/plugin-syntax-bigint",
    "@babel/plugin-proposal-object-rest-spread",
    "@babel/plugin-proposal-class-properties",
    ["@babel/transform-runtime", { version: runtimeVersion }],
    "@babel/plugin-proposal-numeric-separator",
  ],
  sourceType: "unambiguous",
};
