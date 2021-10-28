// gets the rollup config for build
// merges the user provided config with the default config
// and returns the merged config

const mergewith = require("lodash.mergewith");
const babel = require("@babel/core");
const typescript = require("@rollup/plugin-typescript");
const sourceMaps = require("rollup-plugin-sourcemaps");
const path = require("path");
const fs = require("fs");
const requireFromString = require("require-from-string");
const tsconfigBuild = require("./tsconfig.build");

const paths = require("./paths");
const pkg = require(paths.appPackageJson);
const getDefaultConfig = (name) => {
  return {
    input: paths.appIndexFile,
    external: Object.keys(pkg.dependencies),
    output: { file: path.resolve(paths.appBuild, `${name}.esm.js`), format: "es", sourcemap: true },
    plugins: [typescript({ ...tsconfigBuild }), sourceMaps()],
  };
};

// objValue is the first object (our default config)
function customizer(objValue, srcValue) {
  if (Array.isArray(objValue)) {
    return srcValue;
  }
}

// We just return the user's array value

module.exports = async (name) => {
  console.log(paths.appRollupConfig);
  const code = babel.transformFileSync(paths.appRollupConfig, { presets: ["@babel/env"] }).code;
  const userConfig = fs.existsSync(paths.appRollupConfig) ? requireFromString(code).default : {};
  console.log(code, userConfig);
  return mergewith(getDefaultConfig(name), userConfig, customizer);
};
