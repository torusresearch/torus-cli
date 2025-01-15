module.exports = {
  name: "index.js",
  umd: true,
  libEsm: true,
  libCjs: true,
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
