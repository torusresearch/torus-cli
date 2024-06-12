import path from "path";
import chalk from "chalk";
import { formatSize, getGzippedBufferLength } from "./utils.js";

export default function formatStats(stats, fileName, dir, time) {
  // First item in stats is the rollup file
  const chunks = stats.filter((x) => x.type === "chunk");
  const lastDir = dir.split("/").pop();
  const finalSize = chunks.reduce((acc, chunk) => {
    return acc + Buffer.byteLength(chunk.code, "utf8");
  }, 0);
  const finalGzipSize = chunks.reduce((acc, chunk) => {
    return acc + getGzippedBufferLength(Buffer.from(chunk.code, "utf8"));
  }, 0);
  return [
    [
      /js$/.test(fileName) ? chalk.green(path.join(lastDir, fileName)) : chalk.blue(path.join(lastDir, fileName)),
      formatSize(finalSize),
      formatSize(finalGzipSize),
      `${(Number(time) / 1000).toFixed(1)} sec`,
    ],
  ];
}
