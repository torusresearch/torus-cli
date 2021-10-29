// gets the babel config for build
// merges the user provided config with the default config
// and returns the merged config

const merge = require("lodash.mergewith");
const fs = require("fs");

const paths = require("./paths");

function camelCase(input) {
  return input.toLowerCase().replace(/-(.)/g, (_, group1) => group1.toUpperCase());
}

function generateLibraryName(name) {
  const splits = name.split("/");
  const pkgName = splits[splits.length - 1];
  const usableName = camelCase(pkgName);
  return usableName.charAt(0).toUpperCase() + usableName.slice(1);
}

const pkg = require(paths.appPackageJson);

const defaultConfig = {
  name: generateLibraryName(pkg.name),
  esm: true,
  cjs: true,
  umd: true,

  cjsBundled: false,
  bundledDeps: [],

  analyzerMode: "disabled",
};

const userConfig = fs.existsSync(paths.appTorusConfig) ? require(paths.appTorusConfig) : {};

module.exports = merge(defaultConfig, userConfig);
