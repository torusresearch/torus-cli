// gets the tsconfig for build
// merges the user provided config with the default config
// and returns the merged config

const paths = require("./paths");
const fs = require("fs");
const ts = require("typescript");
const merge = require("lodash.mergewith");

const defaultConfig = {
  compilerOptions: {
    rootDir: "src",
    moduleResolution: "node",
    strict: false,
    module: "es6",
    target: "es6",
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

module.exports = merge(defaultConfig, userConfig, customizer);
