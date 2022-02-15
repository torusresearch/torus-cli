"use strict";

const path = require("path");
const fs = require("fs");

// This works with lerna packages too
const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = (relativePath) => path.resolve(appDirectory, relativePath);

const buildPath = process.env.BUILD_DIR || "dist";

const moduleFileExtensions = ["js", "ts", "json", "mjs", "jsx", "tsx"];

// Resolve file paths in the same order as webpack
const resolveModule = (resolveFn, filePath) => {
  const extension = moduleFileExtensions.find((extension) => fs.existsSync(resolveFn(`${filePath}.${extension}`)));

  if (extension) {
    return resolveFn(`${filePath}.${extension}`);
  }

  return resolveFn(`${filePath}.js`);
};

const resolveOwn = (relativePath) => path.resolve(__dirname, "..", relativePath);

// we're in ./node_modules/torus-scripts/config/
module.exports = {
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
  appWebpackConfig: resolveApp("webpack.config.js"),
  appRollupConfig: resolveApp("rollup.config.js"),
  appBabelConfig: resolveApp("babel.config.js"),
  appTorusConfig: resolveApp("torus.config.js"),
  appBrowserslistConfig: resolveApp(".browserslistrc"),
  // These properties only exist before ejecting:
  ownPath: resolveOwn("."),
  ownNodeModules: resolveOwn("node_modules"), // This is empty on npm 3
};

module.exports.moduleFileExtensions = moduleFileExtensions;
