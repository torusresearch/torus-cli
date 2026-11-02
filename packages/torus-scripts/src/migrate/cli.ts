#!/usr/bin/env node

import { argv, stderr, stdout } from "node:process";

import { exitCodes } from "./model.js";

function isMissingPeer(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ERR_MODULE_NOT_FOUND" && error.message.includes("'vite-plus'");
}

try {
  // run.js loads the vite-plus peer dependency. A dynamic import lets a missing peer exit as a failure, not as "blocked".
  const { run } = await import("./run.js");
  process.exitCode = await run(argv.slice(2), {
    stdout: (text) => stdout.write(text),
    stderr: (text) => stderr.write(text),
  });
} catch (error) {
  const message = isMissingPeer(error)
    ? "torus-scripts-upgrade needs the vite-plus peer dependency. Install vite-plus in this project, then run the command again."
    : `torus-scripts-upgrade failed: ${error instanceof Error ? error.message : String(error)}`;
  stderr.write(`${message}\n`);
  process.exitCode = exitCodes.failed;
}
