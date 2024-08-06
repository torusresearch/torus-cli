// gets the babel config for build
// merges the user provided config with the default config
// and returns the merged config

import merge from "lodash.mergewith";

import paths from "./paths.js";
import defaultConfig from "@toruslabs/config/torus.config.js";
import { readFile } from "../helpers/utils.js";

function camelCase(input) {
  return input.toLowerCase().replace(/-(.)/g, (_, group1) => group1.toUpperCase());
}

function generatePackageName(name) {
  const splits = name.split("/");
  const pkgName = splits[splits.length - 1];
  const usableName = camelCase(pkgName);
  return usableName;
}

const pkg = await readFile(paths.appPackageJson);

defaultConfig.browserslistrc =
  pkg.browserslist && pkg.browserslist.production ? pkg.browserslist.production : pkg.browserslist || defaultConfig.browserslistrc;

defaultConfig.name = generatePackageName(pkg.name);

defaultConfig.umd = process.env.NODE_ENV === "production";
defaultConfig.cjs = process.env.NODE_ENV === "production";
defaultConfig.esm = process.env.NODE_ENV === "production";

const userConfig = await readFile(paths.appTorusConfig);

export default merge(defaultConfig, userConfig.default || {});
