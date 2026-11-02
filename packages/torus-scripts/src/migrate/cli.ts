#!/usr/bin/env node

import path from "node:path";
import { stderr, stdout } from "node:process";

import { inspectProject } from "./inspect.js";
import { formatReport } from "./report.js";

const usage = "Usage: torus-scripts-upgrade <path>\n";
const inputPath = process.argv[2];
if (inputPath === "--help" || inputPath === "-h") {
  stdout.write(usage);
} else if (!inputPath || inputPath.startsWith("-") || process.argv.length > 3) {
  stderr.write(usage);
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
