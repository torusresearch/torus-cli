#!/usr/bin/env node

import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(packageRoot, "src/migrate/cli.ts");
const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", cliPath, ...process.argv.slice(2)],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(result.error.message);
  process.exitCode = 2;
} else if (result.signal) {
  process.exitCode = 2;
} else {
  process.exitCode = result.status ?? 2;
}
