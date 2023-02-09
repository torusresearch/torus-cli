import path from "path";
import chalk from "chalk";
import { formatSize, getGzippedSize } from "./utils.js";

export default function formatStats(stats, dir) {
  const json = stats.toJson({
    hash: false,
    modules: false,
    chunks: false,
  });

  let assets = json.assets ? json.assets : json.children.reduce((acc, child) => acc.concat(child.assets), []);

  const seenNames = new Map();
  const isJS = (val) => /\.js$/.test(val);
  const isCSS = (val) => /\.css$/.test(val);
  const isMinJS = (val) => /\.min\.js$/.test(val);
  assets = assets
    .map((a) => {
      a.name = a.name.split("?")[0];
      return a;
    })
    .filter((a) => {
      if (seenNames.has(a.name)) {
        return false;
      }
      seenNames.set(a.name, true);
      return isJS(a.name) || isCSS(a.name);
    })
    .sort((a, b) => {
      if (isJS(a.name) && isCSS(b.name)) return -1;
      if (isCSS(a.name) && isJS(b.name)) return 1;
      if (isMinJS(a.name) && !isMinJS(b.name)) return -1;
      if (!isMinJS(a.name) && isMinJS(b.name)) return 1;
      return b.size - a.size;
    });

  const lastDir = dir.split("/").pop();
  return assets.map((asset) => [
    /js$/.test(asset.name) ? chalk.green(path.join(lastDir, asset.name)) : chalk.blue(path.join(lastDir, asset.name)),
    formatSize(asset.size),
    getGzippedSize(asset, dir),
    `${(json.time / 1000).toFixed(1)} sec`,
  ]);
}
