import paths from "../config/paths.js";
import { readJSONFile } from "../helpers/utils.js";

const pkg = readJSONFile(paths.appPackageJson);

function camelCase(input) {
  return input.toLowerCase().replace(/-(.)/g, (_, group1) => group1.toUpperCase());
}

function generatePackageName(name) {
  const splits = name.split("/");
  const pkgName = splits[splits.length - 1];
  const usableName = camelCase(pkgName);
  return usableName;
}

export default {
  name: generatePackageName(pkg.name),
  esm: true,
  cjs: true,
  umd: true,

  cjsBundled: false,
  bundledDeps: [],

  analyzerMode: "disabled",

  browserslistrc: pkg.browserslist && pkg.browserslist.production ? pkg.browserslist.production : pkg.browserslist || ["supports bigint", "not dead"],
};
