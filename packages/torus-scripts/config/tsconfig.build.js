// gets the tsconfig for build
// merges the user provided config with the default config
// and returns the merged config

import fs from "fs";
import ts from "typescript";
import merge from "lodash.mergewith";

import paths from "./paths.js";

const defaultConfig = {
  compilerOptions: {
    rootDir: "src",
    moduleResolution: "node",
    strict: false,
    module: "es6",
    target: "esnext",
    lib: ["ES2020", "DOM"],
    sourceMap: true,
    esModuleInterop: true,
    noImplicitThis: true,
    declaration: true,
    declarationDir: "./types",
    outDir: paths.appBuildPath,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true,
    resolveJsonModule: true,
  },
  include: ["src"],
};

const userPathExists = fs.existsSync(paths.appTsBuildConfig);

const userConfig = userPathExists ? ts.readConfigFile(paths.appTsBuildConfig, ts.sys.readFile).config : {};

// objValue is the first object (our default config)
function customizer(objValue, srcValue) {
  if (Array.isArray(objValue)) {
    return srcValue;
  }
}

export default merge(defaultConfig, userConfig, customizer);
