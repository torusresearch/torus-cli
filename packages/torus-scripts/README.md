# torus-scripts

Torus scripts provide you a convenient way to build, release & create a dev server for building ts libraries.
It offers a modern build setup with no configuration

The CLI Service is built on top of rollup, webpack and webpack-dev-server. It contains:

- The core service that loads other CLI Plugins;
- An internal webpack and rollup config that is optimized for most apps;
- The torus-scripts binary inside the project, which comes with the basic start, build and release commands.

If you are familiar with create-react-app, @toruslabs/torus-scripts is roughly the equivalent of react-scripts, although the feature set is different.

## Installation

To install the package, use one of the following commands

```sh
npm install --save-dev @toruslabs/torus-scripts
# OR
yarn add -D @toruslabs/torus-scripts
```

You can check if you have the right version using

```sh
npx torus-scripts --version
```

## Usage

You can create scripts inside package.json as follows

```json
{
  "scripts": {
    "start": "torus-scripts start",
    "build": "torus-scripts build"
  }
}
```

You can invoke these scripts using either npm or Yarn:

```sh
npm run build
# OR
yarn build
```

If you have npx available (should be bundled with an up-to-date version of npm), you can also invoke the binary directly with:

```sh
npx torus-scripts build
```

### torus.config.js

`torus.config.js` is an optional config file that will be automatically loaded by `torus-scripts` service if it's present in your project root (next to `package.json`).

The following options are supported

```ts
interface IOptions {
  name: string; // Name of bundles in dist folder. Default: name in package.json with casing changes
  libEsm: boolean; // Whether to generate an lib esm build. Default: true
  libCjs: boolean; // Whether to generate a lib cjs build. Default: true
  analyzerMode: "disabled" | "static" | "server" | "json"; // Whether to analyze the umd build. Internally uses webpack-bundle-analyzer. Default: "disabled". Refer to full options here: https://github.com/webpack-contrib/webpack-bundle-analyzer
  browserslistrc: string | string[]; // The browserlist to target. Default: ["> 0.25%", "not dead", "not ie 11"]. Full list: https://github.com/browserslist/browserslist
  // This option allows you to skip polyfilling node deps by default. You can set it to true or a specific path to
  // polyfill correctly. This change has been done to prevent unnecessary polyfilling of node deps in browser builds
  polyfillNodeDeps: {
    http: boolean | string;
    https: boolean | string;
    os: boolean | string;
    crypto: boolean | string;
    assert: boolean | string;
    stream: boolean | string;
    url: boolean | string;
    zlib: boolean | string;
  };
}
```

### Config precedence

<b> browserslist </b>
The order of preference for browserslist config is as follows:

1. `.browserslistrc` file at package root
2. `browserslistrc` key in `torus.config.js`
3. `browserslist.production` key in `package.json`
4. `browserslist` key in `package.json`
5. [Default](./defaults/torus.config.js)

<b> typescript </b>
The tsconfig is generated as follows:

1. `tsconfig.build.json` file at package root
2. [Default](./defaults/tsconfig.build.js)

Both 1 & 2 are merged using `lodash.mergewith` and the generated config is used.
So, it's okay to specify partial config in tsconfig.build.json

<b> babel </b>
The babel config is generated as follows:

1. `babel.config.js` file at package root
2. [Default](./defaults/babel.config.js)

Both 1 & 2 are merged using `babel-merge` and the generated config is used.
So, it's okay to specify partial config in babel.config.js

<b> rollup </b>
The rollup config is generated as follows:

1. `rollup.config.js` file at package root
2. [Default](./config/rollup.config.js)

Both 1 & 2 are merged using `lodash.mergewith` and the generated config is used.
So, it's okay to specify partial config in rollup.config.js
you can also specify newer build types in this case using outputs

eg:

To add other plugins

```js
import replace from "@rollup/plugin-replace";

// This adds `replace` plugin to the existing plugins used by torus-scripts
export const baseConfig = {
  plugins: [
    replace({
      "process.env.INFURA_PROJECT_ID": `"${process.env.INFURA_PROJECT_ID}"`,
      preventAssignment: true,
    }),
  ],
};
```

<b> webpack </b>
The webpack config is generated as follows:

1. `webpack.config.js` file at package root
2. [Default](./config/webpack.config.js)

Both 1 & 2 are merged using `lodash.mergewith` and the generated config is used.
So, it's okay to specify partial config in webpack.config.js
you can also specify newer build types in this case by adding a new key in the exports

eg:

To create a new build type

```js
const pkg = require("./package.json");

const pkgName = "fetchNodeDetails";

// Adding this creates a new build type in the dist/ folder
exports.nodeConfig = {
  optimization: {
    minimize: false,
  },
  output: {
    filename: `${pkgName}-node.js`,
    libraryTarget: "commonjs2",
  },
  externals: [...Object.keys(pkg.dependencies), /^(@babel\/runtime)/i],
  target: "node",
};
```

To add plugins or other config to all build types

```js
const path = require("path");
const { EnvironmentPlugin } = require("webpack");

exports.baseConfig = {
  resolve: {
    alias: {
      "bn.js": path.resolve(__dirname, "node_modules/bn.js"),
      lodash: path.resolve(__dirname, "node_modules/lodash"),
      "js-sha3": path.resolve(__dirname, "node_modules/js-sha3"),
    },
  },
  plugins: [new EnvironmentPlugin(["INFURA_PROJECT_ID"])],
};
```

### torus-scripts build

```
Usage: torus-scripts build [options]
Use e.g. "torus-scripts build" directly".
Options:
  -h --help              Print this help
  -n --name              Name of the project

```

`torus-scripts build` produces a production-ready bundle in `dist/` directory

The build is produced in the following formats depending on the options specified in `torus.config.js`

- `lib.esm` - Built using rollup. (partial rollup config can be specified in `rollup.config.js` at project root)
- `lib.cjs` - Built using rollup. (partial rollup config can be specified in `rollup.config.js` at project root)
- `umd` - Built using webpack. (partial webpack config can be specified in `webpack.config.js` at project root)

### torus-scripts start

```
Usage: torus-scripts start [options]
Use e.g. "torus-scripts start" directly".
Options:
  -h --help              Print this help
  -n --name              Name of the project

```

`torus-scripts start` command starts a dev server (based on rollup & webpack-dev-server)
that comes with HMR (Hot-Module-Replacement) working out of the box.

The dev server build is produced in the following formats depending on the options specified in `torus.config.js`

- `lib.esm` - Built using rollup. (partial rollup config can be specified in `rollup.config.js` at project root)
- `lib.cjs` - Built using rollup. (partial rollup config can be specified in `rollup.config.js` at project root)
- `umd` - Built using webpack. (partial webpack config can be specified in `webpack.config.js` at project root)

you can use npm folder links to install this to any other project and
watch it live updated as you change code in your torus-scripts project

### torus-scripts release

```
Usage: torus-scripts release [options]
Use e.g. "torus-scripts release" directly".

```

`torus-scripts release` command internally uses [release-it](https://github.com/release-it/release-it) for release management
All options from `release-it` are supported by default

you're recommended to add `prepack` command to build before calling release

```json
{
  "scripts": {
    "build": "torus-scripts build",
    "prepack": "npm run build",
    "release": "torus-scripts release"
  }
}
```

## Migration Notes

- babel.config files must be extending babel.config.js and import the default config from @toruslabs/config
- tsconfig files must be extending tsconfig.default.json and import the default config from @toruslabs/config
- Add include (`["src", "test"]`), outDir, declarationDir in imported files of tsconfig.json
- If repo also includes tests, add tsconfig.build.json and in that, `include` must contain `src` only.
- Start by default doesn't build umd anymore. To build umd, set`umd` to true in torus.config.js
