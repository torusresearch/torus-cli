const currentPkg = require("./package.json");
const runtimeVersion = currentPkg.peerDependencies["@babel/runtime"];

module.exports = {
  presets: [["@babel/env", { modules: false, bugfixes: true }], "@babel/typescript"],
  plugins: [
    "@babel/plugin-syntax-bigint",
    "@babel/plugin-transform-object-rest-spread",
    "@babel/plugin-transform-class-properties",
    ["@babel/transform-runtime", { version: runtimeVersion }],
    "@babel/plugin-transform-numeric-separator",
  ],
  sourceType: "unambiguous",
};
