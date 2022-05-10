// gets the babel config for build
// merges the user provided config with the default config
// and returns the merged config

const merge = require("babel-merge");
const fs = require("fs");

const paths = require("./paths");

const defaultConfig = require("../defaults/babel.config");

const userConfig = fs.existsSync(paths.appBabelConfig) ? require(paths.appBabelConfig) : {};

module.exports = merge(defaultConfig, userConfig);
