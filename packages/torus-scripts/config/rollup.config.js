// gets the rollup config for build
// merges the user provided config with the default config
// and returns the merged config

import mergewith from "lodash.mergewith";
import babel from "@babel/core";
import typescript from "@rollup/plugin-typescript";
import babelPlugin from "@rollup/plugin-babel";
import path from "path";
import fs from "fs";
import requireFromString from "require-from-string";

import tsconfigBuild from "./tsconfig.build.js";
import torusConfig from "./torus.config.js";
import paths from "./paths.js";
import { readJSONFile } from "../helpers/utils.js";
import babelConfig from "./babel.config.js";

const pkg = readJSONFile(paths.appPackageJson);

const babelPluginOptions = {
  extensions: [".ts", ".js", ".tsx", ".jsx", ".mjs"],
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
    external: [...Object.keys(pkg.dependencies || {}), /@babel\/runtime/],
    output: [{ file: path.resolve(paths.appBuild, `${name}.esm.js`), format: "es", sourcemap: true }],
    plugins: [
      typescript({
        ...tsconfigBuild.compilerOptions,
        tsconfig: fs.existsSync(paths.appTsBuildConfig) ? paths.appTsBuildConfig : paths.appTsConfig,
        noEmitOnError: process.env.NODE_ENV === "production",
        cacheDir: paths.appWebpackCache,
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
      }, {})
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
      }, {})
    );
  }
  if (Array.isArray(objValue)) {
    return srcValue;
  }
}

// We just return the user's array value

export default (name) => {
  const userConfig = fs.existsSync(paths.appRollupConfig)
    ? requireFromString(babel.transformFileSync(paths.appRollupConfig, { presets: ["@babel/env"] }).code).default
    : {};
  return mergewith(getDefaultConfig(name), userConfig, customizer);
};
