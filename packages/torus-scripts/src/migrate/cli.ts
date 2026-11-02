#!/usr/bin/env node

import path from "node:path";
import { stderr, stdout } from "node:process";

import { inspectProject } from "./inspect.js";
import { formatReport } from "./report.js";

const inputPath = process.argv[2];
if (!inputPath || process.argv.length > 3) {
  stderr.write("Usage: torus-scripts-upgrade <path>\n");
  process.exitCode = 2;
} else {
  try {
    const projectRoot = path.resolve(inputPath);
    const result = await inspectProject(projectRoot);
    stdout.write(`${formatReport(result)}\n`);
    if (result.unsupported.length > 0) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`Unable to inspect ${path.resolve(inputPath)}: ${message}\n`);
    process.exitCode = 2;
  }
}
