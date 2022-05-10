// gets the babel config for build
// merges the user provided config with the default config
// and returns the merged config

const merge = require("lodash.mergewith");
const fs = require("fs");

const paths = require("./paths");

const defaultConfig = require("../defaults/torus.config");

const userConfig = fs.existsSync(paths.appTorusConfig) ? require(paths.appTorusConfig) : {};

module.exports = merge(defaultConfig, userConfig);
