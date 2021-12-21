// gets the rollup config for build
// merges the user provided config with the default config
// and returns the merged config

const mergewith = require("lodash.mergewith");
const babel = require("@babel/core");
const typescript = require("@rollup/plugin-typescript");
const babelPlugin = require("@rollup/plugin-babel").default;
const path = require("path");
const fs = require("fs");
const requireFromString = require("require-from-string");
const tsconfigBuild = require("./tsconfig.build");
const babelConfig = require("./babel.config");
const torusConfig = require("./torus.config");

const paths = require("./paths");
const pkg = require(paths.appPackageJson);

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
    external: [...Object.keys(pkg.dependencies), /@babel\/runtime/],
    output: [{ file: path.resolve(paths.appBuild, `${name}.esm.js`), format: "es", sourcemap: true }],
    plugins: [
      typescript({ ...tsconfigBuild.compilerOptions, tsconfig: fs.existsSync(paths.appTsBuildConfig) ? paths.appTsBuildConfig : paths.appTsConfig }),
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

module.exports = (name) => {
  const userConfig = fs.existsSync(paths.appRollupConfig)
    ? requireFromString(babel.transformFileSync(paths.appRollupConfig, { presets: ["@babel/env"] }).code).default
    : {};
  return mergewith(getDefaultConfig(name), userConfig, customizer);
};
