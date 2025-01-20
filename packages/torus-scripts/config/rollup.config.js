// gets the rollup config for build
// merges the user provided config with the default config
// and returns the merged config

import babelPlugin from "@rollup/plugin-babel";
import path from "path";
import fs from "fs";
import resolve from "@rollup/plugin-node-resolve";
import tsconfigPaths from "rollup-plugin-tsconfig-paths";

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

// We just return the user's array value
const userConfig = fs.existsSync(paths.appRollupConfig) ? await readFile(paths.appRollupConfig) : {};

// we want to create only one build set with rollup
const getDefaultConfig = (name) => {
  const allDeps = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})];
  const baseConfig = {
    input: paths.appIndexFile,
    external: [...allDeps, ...allDeps.map((x) => new RegExp(`^${x}/`)), /@babel\/runtime/],
    ...(userConfig.baseConfig || {}),
  };
  const esmCombinedExport = {
    ...baseConfig,
    output: { file: path.resolve(paths.appBuild, `${name}.esm.js`), format: "es", sourcemap: process.env.NODE_ENV === "development" },
    plugins: [
      tsconfigPaths(),
      // Allows node_modules resolution
      resolve({
        extensions: appModuleFileExtensions.map((x) => `.${x}`),
        modulesOnly: true,
        preferBuiltins: false,
      }),
      ...(baseConfig.plugins || []),
      babelPlugin(babelPluginOptions),
    ],
  };
  const esmOriginalExport = {
    ...baseConfig,
    output: { preserveModules: true, dir: path.resolve(paths.appBuild, "lib.esm"), format: "es", sourcemap: process.env.NODE_ENV === "development" },
    plugins: [
      tsconfigPaths(),
      // Allows node_modules resolution
      resolve({
        extensions: appModuleFileExtensions.map((x) => `.${x}`),
        modulesOnly: true,
        preferBuiltins: false,
      }),
      ...(baseConfig.plugins || []),
      babelPlugin(babelPluginOptions),
    ],
  };
  // const cjsCombinedExport = {
  //   ...baseConfig,
  //   output: { file: path.resolve(paths.appBuild, `${name}.cjs.js`), format: "cjs", sourcemap: process.env.NODE_ENV === "development" },
  //   plugins: [
  //     // Allows node_modules resolution
  //     resolve({
  //       extensions: appModuleFileExtensions.map((x) => `.${x}`),
  //       modulesOnly: true,
  //       preferBuiltins: false,
  //     }),
  //     commonjs(),
  //     babelPlugin(babelPluginOptions),
  // ...(baseConfig.plugins || []),
  //   ],
  // };
  const cjsOriginalExport = {
    ...baseConfig,
    output: { preserveModules: true, dir: path.resolve(paths.appBuild, "lib.cjs"), format: "cjs", sourcemap: process.env.NODE_ENV === "development" },
    plugins: [
      tsconfigPaths(),
      // Allows node_modules resolution
      resolve({
        extensions: appModuleFileExtensions.map((x) => `.${x}`),
        modulesOnly: true,
        preferBuiltins: false,
      }),
      ...(baseConfig.plugins || []),
      babelPlugin(babelPluginOptions),
    ],
  };
  const finalTasks = [];
  if (torusConfig.esm) finalTasks.push(esmCombinedExport);
  if (torusConfig.libEsm) finalTasks.push(esmOriginalExport);
  if (torusConfig.libCjs) finalTasks.push(cjsOriginalExport);
  return finalTasks;
};

export default (name) => {
  return getDefaultConfig(name);
};
