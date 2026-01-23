// gets the tsconfig for build
// merges the user provided config with the default config
// and returns the merged config

import fs from "fs";
import ts from "typescript";
import merge from "lodash.mergewith";
import { createRequire } from "node:module";
import paths from "./paths.js";

const require = createRequire(import.meta.url);

const userPathExists = fs.existsSync(paths.appTsBuildConfig);

const userConfig = userPathExists ? ts.readConfigFile(paths.appTsBuildConfig, ts.sys.readFile).config : {};

// objValue is the first object (our default config)
function customizer(objValue, srcValue) {
  if (Array.isArray(objValue)) {
    return srcValue;
  }
}

function getFullTsConfigFromFile(filePath) {
  const configPath = require.resolve(filePath);
  const config = ts.readConfigFile(configPath, ts.sys.readFile).config;
  if (typeof config.extends === "string" && config.extends) {
    const extend = config.extends;
    delete config.extends;
    return merge(config, getFullTsConfigFromFile(extend), customizer);
  } else if (Array.isArray(config.extends)) {
    const extend = config.extends;
    delete config.extends;
    return merge(config, ...extend.map((x) => getFullTsConfigFromFile(x)), customizer);
  }
  return config;
}

const defaultConfig = getFullTsConfigFromFile("@toruslabs/config/tsconfig.build.json");

const mergedConfig = merge(
  defaultConfig,
  {
    compilerOptions: { outDir: paths.appBuildPath, declarationDir: paths.appBuildPath + "/types", rootDir: paths.appSrc },
    include: ["src"],
  },
  userConfig,
  customizer,
);

export default mergedConfig;
