// gets the rollup config for build
// merges the user provided config with the default config
// and returns the merged config

import mergewith from "lodash.mergewith";
import babelPlugin from "@rollup/plugin-babel";
import path from "path";
import fs from "fs";
import resolve from "@rollup/plugin-node-resolve";

import torusConfig from "./torus.config.js";
import paths, { appModuleFileExtensions } from "./paths.js";
import { readFile, readJSONFile } from "../helpers/utils.js";
import babelConfig from "./babel.config.js";

const pkg = readJSONFile(paths.appPackageJson);

const babelPluginOptions = {
  extensions: appModuleFileExtensions.map((x) => `.${x}`),
  babelHelpers: "runtime",
  babelrc: false,
  ...babelConfig,
  configFile: false,
};

if (fs.existsSync(paths.appBrowserslistConfig)) {
  babelPluginOptions.browserslistConfigFile = paths.appBrowserslistConfig;
} else {
  babelPluginOptions.targets = torusConfig.browserslistrc;
}

// we want to create only one build set with rollup
const getDefaultConfig = (name) => {
  return {
    input: paths.appIndexFile,
    external: [...Object.keys(pkg.dependencies || {}).map((x) => new RegExp(`${x}`)), /@babel\/runtime/],
    output: [{ file: path.resolve(paths.appBuild, `${name}.esm.js`), format: "es", sourcemap: true }],
    plugins: [
      // Allows node_modules resolution
      resolve({
        extensions: appModuleFileExtensions.map((x) => `.${x}`),
      }),
      babelPlugin(babelPluginOptions),
    ],
  };
};

// objValue is the first object (our default config)
function customizer(objValue, srcValue, key) {
  // merge plugins nicely knowing that name is common
  if (key === "plugins") {
    // concat first and remove duplicates by name (keep the first occurrence)
    return Object.values(
      srcValue.concat(objValue).reduce((acc, x) => {
        if (!acc[x.name]) {
          acc[x.name] = x;
        }
        return acc;
      }, {}),
    );
  }
  if (key === "output") {
    // concat first and remove duplicates by format (keep the first occurrence)
    return Object.values(
      srcValue.concat(objValue).reduce((acc, x) => {
        if (!acc[x.format]) {
          acc[x.format] = x;
        }
        return acc;
      }, {}),
    );
  }
  if (Array.isArray(objValue)) {
    return srcValue;
  }
}

// We just return the user's array value
const userConfig = fs.existsSync(paths.appRollupConfig) ? await readFile(paths.appRollupConfig) : {};

export default (name) => {
  return mergewith(getDefaultConfig(name), userConfig.default, customizer);
};
