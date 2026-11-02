import path from "node:path";
import { parseArgs } from "node:util";

import { inspectProject } from "./inspect.js";
import { type ExitCode, exitCodes, isBlocking } from "./model.js";
import { formatReport } from "./report.js";

export interface Output {
  stdout(text: string): void;
  stderr(text: string): void;
}

export const usage = "Usage: torus-scripts-upgrade <path>\n";

export async function run(args: string[], output: Output): Promise<ExitCode> {
  let parsed;
  try {
    parsed = parseArgs({ args, allowPositionals: true, strict: true, options: { help: { type: "boolean", short: "h" } } });
  } catch {
    output.stderr(usage);
    return exitCodes.failed;
  }
  if (parsed.values.help) {
    output.stdout(usage);
    return exitCodes.clean;
  }
  const [inputPath, ...extra] = parsed.positionals;
  if (inputPath === undefined || extra.length > 0) {
    output.stderr(usage);
    return exitCodes.failed;
  }

  const projectRoot = path.resolve(inputPath);
  try {
    const findings = await inspectProject(projectRoot);
    output.stdout(`${formatReport(findings)}\n`);
    return findings.some(isBlocking) ? exitCodes.blocked : exitCodes.clean;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.stderr(`Unable to inspect ${projectRoot}: ${message}\n`);
    return exitCodes.failed;
  }
}
