// gets the babel config for build
// merges the user provided config with the default config
// and returns the merged config

const merge = require("babel-merge");
const fs = require("fs");

const paths = require("./paths");

const defaultConfig = {
  presets: ["@babel/env", "@babel/typescript"],
  plugins: [
    "@babel/plugin-syntax-bigint",
    "@babel/plugin-proposal-object-rest-spread",
    "@babel/plugin-proposal-class-properties",
    "@babel/transform-runtime",
  ],
  sourceType: "unambiguous",
};

const userConfig = fs.existsSync(paths.appBabelConfig) ? require(paths.appBabelConfig) : {};

module.exports = merge(defaultConfig, userConfig);
