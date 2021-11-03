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
// we want to create only one build set with rollup
const getDefaultConfig = (name) => {
  return {
    input: paths.appIndexFile,
    external: Object.keys(pkg.dependencies),
    output: [{ file: path.resolve(paths.appBuild, `${name}.esm.js`), format: "es", sourcemap: true }],
    plugins: [
      typescript({ ...tsconfigBuild.compilerOptions, tsconfig: fs.existsSync(paths.appTsBuildConfig) ? paths.appTsBuildConfig : paths.appTsConfig }),
      sourceMaps(),
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

module.exports = (name) => {
  const code = babel.transformFileSync(paths.appRollupConfig, { presets: ["@babel/env"] }).code;
  const userConfig = fs.existsSync(paths.appRollupConfig) ? requireFromString(code).default : {};
  return mergewith(getDefaultConfig(name), userConfig, customizer);
};
