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

exports.getDefaultBaseConfig = (pkgName) => {
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

exports.getDefaultUmdConfig = (pkgName) => {
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

exports.getDefaultCjsConfig = (pkgName) => {
  return {
    ...optimization,
    output: {
      filename: `${pkgName}.cjs.js`,
      libraryTarget: "commonjs2",
    },
    plugins: [
      new ESLintPlugin({
        context: paths.appPath,
        files: "src",
        extensions: ".ts",
      }),
    ],
    externals: [...Object.keys(pkg.dependencies), /^(@babel\/runtime)/i, nodeExternals()],
    node: {
      Buffer: false,
    },
  };
};

exports.getDefaultCjsBundledConfig = (pkgName) => {
  return {
    ...optimization,
    output: {
      filename: `${pkgName}-bundled.cjs.js`,
      libraryTarget: "commonjs2",
    },
    externals: [...Object.keys(pkg.dependencies), /^(@babel\/runtime)/i].filter((x) => !torusConfig.bundledDeps.includes(x)),
  };
};

module.exports = (pkgName) => {
  const baseConfig = merge(this.getDefaultBaseConfig(pkgName), userBaseConfig);
  const umdConfig = merge(this.getDefaultUmdConfig(pkgName), baseConfig, rest.umdConfig || {});
  const cjsConfig = merge(this.getDefaultCjsConfig(pkgName), baseConfig, rest.cjsConfig || {});
  const cjsBundledConfig = merge(this.getDefaultCjsBundledConfig(pkgName), baseConfig, rest.cjsBundledConfig || {});

  const finalConfigs = [];

  if (torusConfig.cjs) finalConfigs.push(cjsConfig);
  if (torusConfig.umd) finalConfigs.push(umdConfig);
  if (torusConfig.cjsBundled) finalConfigs.push(cjsBundledConfig);

  return [
    ...finalConfigs,
    ...Object.values(rest || {}).map((x) => {
      return merge(baseConfig, x);
    }),
  ];
};
