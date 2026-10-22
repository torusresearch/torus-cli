#!/usr/bin/env node

import path from "node:path";
import { inspectProject } from "./inspect.ts";
import { formatReport } from "./report.ts";

const projectPath = process.argv[2] ?? ".";

try {
  const result = await inspectProject(path.resolve(projectPath));
  console.log(formatReport(result));
  if (result.unsupported.length > 0) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
