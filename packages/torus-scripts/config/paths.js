"use strict";

import path from "path";
import fs from "fs";
import { resolveFileUrl } from "../helpers/utils.js";

// This works with lerna packages too
const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = (relativePath) => path.resolve(appDirectory, relativePath);

const buildPath = process.env.BUILD_DIR || "dist";

export const appModuleFileExtensions = ["js", "ts", "json", "mjs", "jsx", "tsx"];
export const configModuleFileExtensions = ["js", "json", "mjs"];

// Resolve file paths in the same order as webpack
const resolveModule = (resolveFn, filePath, moduleFileExtensions = appModuleFileExtensions) => {
  const extension = moduleFileExtensions.find((extension) => fs.existsSync(resolveFn(`${filePath}.${extension}`)));

  if (extension) {
    return resolveFn(`${filePath}.${extension}`);
  }

  return resolveFn(`${filePath}.js`);
};

const resolveOwn = (relativePath) => path.resolve(resolveFileUrl(new URL("../" + relativePath, import.meta.url)));

// we're in ./node_modules/torus-scripts/config/
export default {
  dotenv: resolveApp(".env"),
  appPath: resolveApp("."),
  appBuild: resolveApp(buildPath),
  appBuildPath: buildPath,
  appIndexFile: resolveModule(resolveApp, "src/index"),
  appPackageJson: resolveApp("package.json"),
  appSrc: resolveApp("src"),
  appTsBuildConfig: resolveApp("tsconfig.build.json"),
  appTsConfig: resolveApp("tsconfig.json"),
  testsSetupFile: resolveModule(resolveApp, "test/setup"),
  appNodeModules: resolveApp("node_modules"),
  appWebpackCache: resolveApp("node_modules/.cache"),
  appTsBuildInfoFile: resolveApp("node_modules/.cache/tsconfig.tsbuildinfo"),
  appWebpackConfig: resolveModule(resolveApp, "webpack.config", configModuleFileExtensions),
  appRollupConfig: resolveModule(resolveApp, "rollup.config", configModuleFileExtensions),
  appBabelConfig: resolveModule(resolveApp, "babel.config", configModuleFileExtensions),
  appTorusConfig: resolveModule(resolveApp, "torus.config", configModuleFileExtensions),
  appBrowserslistConfig: resolveApp(".browserslistrc"),
  ownPath: resolveOwn("."),
  ownNodeModules: resolveOwn("node_modules"), // This is empty on npm 3
};
