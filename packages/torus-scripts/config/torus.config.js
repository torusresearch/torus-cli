// gets the babel config for build
// merges the user provided config with the default config
// and returns the merged config

const merge = require("lodash.mergewith");
const fs = require("fs");

const paths = require("./paths");

function camelCase(input) {
  return input.toLowerCase().replace(/-(.)/g, (_, group1) => group1.toUpperCase());
}

function generatePackageName(name) {
  const splits = name.split("/");
  const pkgName = splits[splits.length - 1];
  const usableName = camelCase(pkgName);
  return usableName;
}

const pkg = require(paths.appPackageJson);

const defaultConfig = {
  name: generatePackageName(pkg.name),
  esm: true,
  cjs: true,
  umd: true,

  cjsBundled: false,
  bundledDeps: [],

  analyzerMode: "disabled",

  browserslistrc:
    pkg.browserslist && pkg.browserslist.production ? pkg.browserslist.production : pkg.browserslist || ["> 0.5%", "not dead", "not ie 11"],
};

const userConfig = fs.existsSync(paths.appTorusConfig) ? require(paths.appTorusConfig) : {};

module.exports = merge(defaultConfig, userConfig);
