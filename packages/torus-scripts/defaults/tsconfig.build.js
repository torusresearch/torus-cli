import paths from "../config/paths.js";

export default {
  compilerOptions: {
    rootDir: "src",
    moduleResolution: "node",
    strict: false,
    module: "es6",
    target: "esnext",
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
