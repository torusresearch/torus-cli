#!/usr/bin/env node

import path from "node:path";
import { stdout } from "node:process";

import { inspectProject } from "./inspect.js";
import { formatReport } from "./report.js";

const inputPath = process.argv[2];
if (!inputPath || process.argv.length > 3) {
  console.error("Usage: torus-scripts-upgrade <path>");
  process.exitCode = 2;
} else {
  try {
    const projectRoot = path.resolve(inputPath);
    const result = await inspectProject(projectRoot);
    stdout.write(`${formatReport(result)}\n`);
    if (result.unsupported.length > 0) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Unable to inspect ${path.resolve(inputPath)}: ${message}`);
    process.exitCode = 2;
  }
}
