module.exports = {
  name: "index.js",
  esm: true,
  cjs: true,
  umd: true,

  analyzerMode: "disabled",

  browserslistrc: ["supports bigint", "not dead"],
  polyfillNodeDeps: {
    http: false,
    https: false,
    os: false,
    crypto: false,
    assert: false,
    stream: false,
    url: false,
    zlib: false,
  },
};
