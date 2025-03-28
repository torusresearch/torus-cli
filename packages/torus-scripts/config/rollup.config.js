// gets the rollup config for build
// merges the user provided config with the default config
// and returns the merged config

import babelPlugin from "@rollup/plugin-babel";
import path from "path";
import fs from "fs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { createRequire } from "node:module";

import torusConfig from "./torus.config.js";
import paths, { appModuleFileExtensions } from "./paths.js";
import { readFile, readJSONFile } from "../helpers/utils.js";
import babelConfig from "./babel.config.js";
import tsconfigBuild from "./tsconfig.build.js";

const require = createRequire(import.meta.url);
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
  const tsConfigBuildPlugins = [];
  if (tsconfigBuild.compilerOptions.plugins && tsconfigBuild.compilerOptions.plugins.length > 0) {
    const isTransformPlugin = tsconfigBuild.compilerOptions.plugins.some((x) => x.transform === "typescript-transform-paths");
    if (isTransformPlugin) {
      tsConfigBuildPlugins.push(
        typescript({
          ...tsconfigBuild.compilerOptions,
          tsconfig: fs.existsSync(paths.appTsBuildConfig) ? paths.appTsBuildConfig : paths.appTsConfig,
          noEmitOnError: process.env.NODE_ENV === "production",
          outDir: path.resolve(paths.appBuild, "lib.esm"),
          declaration: false,
          declarationDir: undefined,
          typescript: require("ts-patch/compiler"),
          sourceMap: process.env.NODE_ENV === "development",
          emitDeclarationOnly: true,
        }),
      );
    }
  }
  const baseConfig = {
    input: paths.appIndexFile,
    external: [...allDeps, ...allDeps.map((x) => new RegExp(`^${x}/`)), /@babel\/runtime/],
    ...(userConfig.baseConfig || {}),
  };
  // const esmCombinedExport = {
  //   ...baseConfig,
  //   output: { file: path.resolve(paths.appBuild, `${name}.esm.js`), format: "es", sourcemap: process.env.NODE_ENV === "development" },
  //   plugins: [
  //     // Allows node_modules resolution
  //     resolve({
  //       extensions: appModuleFileExtensions.map((x) => `.${x}`),
  //       modulesOnly: true,
  //       preferBuiltins: false,
  //     }),
  //     ...(baseConfig.plugins || []),
  //     babelPlugin(babelPluginOptions),
  //   ],
  // };
  const esmOriginalExport = {
    ...baseConfig,
    output: { preserveModules: true, dir: path.resolve(paths.appBuild, "lib.esm"), format: "es", sourcemap: process.env.NODE_ENV === "development" },
    plugins: [
      ...tsConfigBuildPlugins,
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
      typescript({
        ...tsconfigBuild.compilerOptions,
        tsconfig: fs.existsSync(paths.appTsBuildConfig) ? paths.appTsBuildConfig : paths.appTsConfig,
        noEmitOnError: process.env.NODE_ENV === "production",
        outDir: path.resolve(paths.appBuild, "lib.cjs"),
        declarationDir: path.resolve(paths.appBuild, "lib.cjs/types"),
        typescript: require("ts-patch/compiler"),
        sourceMap: process.env.NODE_ENV === "development",
      }),
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
  // if (torusConfig.esm) finalTasks.push(esmCombinedExport);
  if (torusConfig.libEsm) finalTasks.push(esmOriginalExport);
  if (torusConfig.libCjs) finalTasks.push(cjsOriginalExport);
  return finalTasks;
};

export default (name) => {
  return getDefaultConfig(name);
};
