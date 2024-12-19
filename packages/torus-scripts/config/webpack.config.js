// gets the webpack config for build
// merges the user provided config with the default config
// and returns the merged config

// By default this generates cjs, umd builds
import merge from "lodash.mergewith";
import path from "path";
import fs from "fs";
import { BundleAnalyzerPlugin } from "webpack-bundle-analyzer";
import nodeExternals from "webpack-node-externals";
import webpack from "webpack";
import { createRequire } from "node:module";
import ESLintPlugin from "eslint-webpack-plugin";
import mergeWith from "lodash.mergewith";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";

const require = createRequire(import.meta.url);
import paths, { appModuleFileExtensions } from "./paths.js";
import babelConfig from "./babel.config.js";
import torusConfig from "./torus.config.js";
import { readFile, readJSONFile } from "../helpers/utils.js";
import tsconfigBuild from "./tsconfig.build.js";

const { appWebpackConfig, appBuild } = paths;
const { NODE_ENV = "production" } = process.env;

const pkg = readJSONFile(paths.appPackageJson);
const configImported = (await readFile(appWebpackConfig)).default || { baseConfig: {} };

const babelLoaderOptions = {
  ...babelConfig,
  babelrc: false,
  configFile: false,
  cacheDirectory: true,
  cacheCompression: false,
};

if (fs.existsSync(paths.appBrowserslistConfig)) {
  babelLoaderOptions.browserslistConfigFile = paths.appBrowserslistConfig;
} else {
  babelLoaderOptions.targets = torusConfig.browserslistrc;
}

export const babelLoader = {
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

const polyfillPlugins = [
  new webpack.ProvidePlugin({
    Buffer: ["buffer", "Buffer"],
  }),
  new webpack.ProvidePlugin({
    process: "process/browser.js",
  }),
];

export const resolveWebpackModule = (localPath) => {
  if (fs.existsSync(path.resolve(paths.ownNodeModules, localPath))) return new URL(paths.ownNodeModules + "/" + localPath, import.meta.url).pathname;
  else if (fs.existsSync(path.resolve(paths.appNodeModules, localPath)))
    return new URL(paths.appNodeModules + "/" + localPath, import.meta.url).pathname;

  return require.resolve(localPath);
};

const polyfillFallback = mergeWith(
  {
    http: resolveWebpackModule("stream-http/index.js"),
    https: resolveWebpackModule("https-browserify/index.js"),
    os: resolveWebpackModule("os-browserify/browser.js"),
    crypto: resolveWebpackModule("crypto-browserify/index.js"),
    assert: resolveWebpackModule("assert/build/assert.js"),
    stream: resolveWebpackModule("stream-browserify/index.js"),
    url: resolveWebpackModule("url/url.js"),
    buffer: resolveWebpackModule("buffer/index.js"),
    zlib: resolveWebpackModule("browserify-zlib/lib/index.js"),
    fs: false,
    path: false,
  },
  torusConfig.polyfillNodeDeps,
  (objValue, srcValue) => {
    if (srcValue === true) return objValue;
    if (typeof srcValue === "string") return srcValue;
    return undefined;
  },
);

function generateLibraryName(pkgName) {
  return pkgName.charAt(0).toUpperCase() + pkgName.slice(1);
}

// objValue is the first object (our default config)
function customizer(objValue, srcValue, key) {
  // merge plugins if they are not there
  if (Array.isArray(objValue) && (key === "plugins" || key === "rules")) {
    return [...objValue, ...(srcValue || [])];
  }
}

export default (pkgName) => {
  const { baseConfig: userBaseConfig, ...rest } = configImported;
  // create a copy of baseConfig every time so that loaders use new instances
  const umdConfig = merge(
    getDefaultUmdConfig(pkgName),
    merge(getDefaultBaseConfig(pkgName), userBaseConfig, customizer),
    rest.umdConfig || {},
    customizer,
  );
  const cjsConfig = merge(
    getDefaultCjsConfig(pkgName),
    merge(getDefaultBaseConfig(pkgName), userBaseConfig, customizer),
    rest.cjsConfig || {},
    customizer,
  );

  const finalConfigs = [];

  if (torusConfig.cjs) finalConfigs.push(cjsConfig);
  if (torusConfig.umd) finalConfigs.push(umdConfig);

  delete rest.cjsConfig;
  delete rest.umdConfig;

  return [
    ...finalConfigs,
    ...Object.values(rest || {}).map((x) => {
      const baseConfig = merge(getDefaultBaseConfig(pkgName), userBaseConfig, customizer);
      return merge(baseConfig, x, customizer);
    }),
  ];
};

export const getDefaultBaseConfig = () => {
  return {
    mode: NODE_ENV,
    devtool: NODE_ENV === "development" ? "eval" : false,
    entry: paths.appIndexFile,
    target: "web",
    output: {
      path: appBuild,
      library: {
        // Giving a name to builds aggregates all exports under that name
        // name:  generateLibraryName(pkgName)
      },
    },
    resolve: {
      extensions: appModuleFileExtensions.map((x) => `.${x}`),
      alias: {
        "bn.js": require.resolve("bn.js/lib/bn.js"),
        // lodash: require.resolve("lodash/index.js"),
      },
    },
    plugins: [new webpack.IgnorePlugin({ resourceRegExp: /^\.\/wordlists\/(?!english)/, contextRegExp: /bip39\/src$/ })],
    module: {
      rules: [babelLoader],
    },
    node: {},
  };
};

export const getDefaultUmdConfig = (pkgName) => {
  return {
    output: {
      filename: `${pkgName}.umd.min.js`,
      library: {
        type: "umd",
        // Giving a name to builds aggregates all exports under that name
        name: generateLibraryName(pkgName),
      },
    },
    plugins: [
      new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: 1,
      }),
      new BundleAnalyzerPlugin({
        analyzerMode: torusConfig.analyzerMode,
        openAnalyzer: false,
      }),
      ...polyfillPlugins, // always polyfill buffer and process
    ],
    resolve: {
      fallback: polyfillFallback,
    },
  };
};

export const getDefaultCjsConfig = (pkgName) => {
  const plugins = [];
  if (NODE_ENV === "production") {
    plugins.push(
      new ESLintPlugin({
        context: paths.appPath,
        threads: !process.env.CI,
        configType: 'flat',
        extensions: ["ts", "tsx"],
        emitError: true,
        emitWarning: true,
        failOnError: process.env.NODE_ENV === "production",
        cache: true,
        cacheLocation: path.resolve(paths.appNodeModules, ".cache/.eslintcache"),
      }),
    );
  }
  plugins.push(
    new ForkTsCheckerWebpackPlugin({
      typescript: {
        mode: "write-dts",
        context: paths.appPath,
        configFile: fs.existsSync(paths.appTsBuildConfig) ? "tsconfig.build.json" : "tsconfig.json",
        configOverwrite: tsconfigBuild,
      },
    }),
  );
  const allDeps = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})];
  return {
    ...optimization,
    output: {
      filename: `${pkgName}.cjs.js`,
      library: {
        // Giving a name to builds aggregates all exports under that name
        type: "commonjs2",
      },
    },
    plugins,
    externals: [...allDeps, /^(@babel\/runtime)/i, nodeExternals()],
    externalsPresets: { node: true },
    node: {
      // Buffer: false,
    },
  };
};
