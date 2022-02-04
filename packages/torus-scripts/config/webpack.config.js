// gets the webpack config for build
// merges the user provided config with the default config
// and returns the merged config

// By default this generates cjs, umd builds
const merge = require("lodash.mergewith");
const path = require("path");
const fs = require("fs");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const nodeExternals = require("webpack-node-externals");

const paths = require("./paths");
const babelConfig = require("./babel.config");
const ESLintPlugin = require("eslint-webpack-plugin");
const torusConfig = require("./torus.config");

const { appWebpackConfig, appBuild } = paths;
const { NODE_ENV = "production" } = process.env;

const pkg = require(paths.appPackageJson);
const { baseConfig: userBaseConfig, ...rest } = fs.existsSync(appWebpackConfig) ? require(appWebpackConfig) : { baseConfig: {} };

const babelLoaderOptions = {
  ...babelConfig,
  babelrc: false,
  configFile: false,
  cacheDirectory: true,
};

if (fs.existsSync(paths.appBrowserslistConfig)) {
  babelLoaderOptions.browserslistConfigFile = paths.appBrowserslistConfig;
} else {
  babelLoaderOptions.targets = torusConfig.browserslistrc;
}

const babelLoader = {
  test: /\.(ts|js)x?$/,
  exclude: /(node_modules|bower_components)/,
  use: {
    loader: "babel-loader",
    options: babelLoaderOptions,
  },
};

const optimization = {
  optimization: {
    minimize: false,
  },
};

function generateLibraryName(pkgName) {
  return pkgName.charAt(0).toUpperCase() + pkgName.slice(1);
}

// objValue is the first object (our default config)
function customizer(objValue, srcValue, key) {
  // merge plugins if they are not there
  if (Array.isArray(objValue) && key === "plugins") {
    return [...objValue, ...(srcValue || [])];
  }
}

module.exports = (pkgName) => {
  // create a copy of baseConfig every time so that loaders use new instances
  const umdConfig = merge(
    getDefaultUmdConfig(pkgName),
    merge(getDefaultBaseConfig(pkgName), userBaseConfig, customizer),
    rest.umdConfig || {},
    customizer
  );
  const cjsConfig = merge(
    getDefaultCjsConfig(pkgName),
    merge(getDefaultBaseConfig(pkgName), userBaseConfig, customizer),
    rest.cjsConfig || {},
    customizer
  );
  const cjsBundledConfig = merge(
    getDefaultCjsBundledConfig(pkgName),
    merge(getDefaultBaseConfig(pkgName), userBaseConfig, customizer),
    rest.cjsBundledConfig || {},
    customizer
  );

  const finalConfigs = [];

  if (torusConfig.cjs) finalConfigs.push(cjsConfig);
  if (torusConfig.umd) finalConfigs.push(umdConfig);
  if (torusConfig.cjsBundled) finalConfigs.push(cjsBundledConfig);

  // console.log("%O", ...finalConfigs.map(x => x.plugins));

  return [
    ...finalConfigs,
    ...Object.values(rest || {}).map((x) => {
      const baseConfig = merge(getDefaultBaseConfig(pkgName), userBaseConfig, customizer);
      return merge(baseConfig, x, customizer);
    }),
  ];
};

module.exports.babelLoader = babelLoader;

const getDefaultBaseConfig = (pkgName) => {
  return {
    mode: NODE_ENV,
    devtool: "source-map",
    entry: paths.appIndexFile,
    target: "web",
    output: {
      path: appBuild,
      library: generateLibraryName(pkgName),
    },
    resolve: {
      extensions: paths.moduleFileExtensions.map((x) => `.${x}`),
      alias: {
        "bn.js": path.resolve(paths.appNodeModules, "bn.js"),
      },
    },
    plugins: [],
    module: {
      rules: [babelLoader],
    },
    node: {},
    // cache: {
    //   type: "filesystem",
    //   cacheDirectory: paths.appWebpackCache,
    //   store: "pack",
    //   buildDependencies: {
    //     defaultWebpack: ["webpack/lib/"],
    //     config: [__filename],
    //     tsconfig: paths.appTsConfig,
    //   },
    // },
  };
};

module.exports.getDefaultBaseConfig = getDefaultBaseConfig;

const getDefaultUmdConfig = (pkgName) => {
  return {
    output: {
      filename: `${pkgName}.umd.min.js`,
      libraryTarget: "umd",
    },
    plugins: [
      new BundleAnalyzerPlugin({
        analyzerMode: torusConfig.analyzerMode,
        openAnalyzer: false,
      }),
    ],
  };
};

module.exports.getDefaultUmdConfig = getDefaultUmdConfig;

const getDefaultCjsConfig = (pkgName) => {
  return {
    ...optimization,
    output: {
      filename: `${pkgName}.cjs.js`,
      libraryTarget: "commonjs2",
    },
    plugins: [
      new ESLintPlugin({
        context: paths.appPath,
        extensions: ["ts", "tsx"],
        emitError: true,
        emitWarning: true,
        failOnError: true,
      }),
    ],
    externals: [...Object.keys(pkg.dependencies), /^(@babel\/runtime)/i, nodeExternals()],
    node: {
      Buffer: false,
    },
  };
};

module.exports.getDefaultCjsConfig = getDefaultCjsConfig;

const getDefaultCjsBundledConfig = (pkgName) => {
  return {
    ...optimization,
    output: {
      filename: `${pkgName}-bundled.cjs.js`,
      libraryTarget: "commonjs2",
    },
    externals: [...Object.keys(pkg.dependencies), /^(@babel\/runtime)/i].filter((x) => !torusConfig.bundledDeps.includes(x)),
  };
};

module.exports.getDefaultCjsBundledConfig = getDefaultCjsBundledConfig;
