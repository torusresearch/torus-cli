import path from "path";
import chalk from "chalk";
import { formatSize, getGzippedBufferSize } from "./utils.js";

export default function formatStats(stats, dir, time) {
  // First item in stats is the rollup file
  const chunks = stats.filter((x) => x.type === "chunk");
  const lastDir = dir.split("/").pop();
  return chunks.map((chunk) => {
    return [
      /js$/.test(chunk.fileName) ? chalk.green(path.join(lastDir, chunk.fileName)) : chalk.blue(path.join(lastDir, chunk.fileName)),
      formatSize(Buffer.byteLength(chunk.code, "utf8")),
      getGzippedBufferSize(Buffer.from(chunk.code, "utf8")),
      `${(Number(time) / 1000).toFixed(1)} sec`,
    ];
  });
}
