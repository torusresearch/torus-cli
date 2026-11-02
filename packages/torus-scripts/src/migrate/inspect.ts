import { stat } from "node:fs/promises";
import path from "node:path";

import { inspectManifest } from "./manifest.js";
import type { Finding } from "./model.js";
import { inspectRollupConfig } from "./rollup.js";
import { type ProjectFile, walkProject } from "./walk.js";

export interface InspectionOptions {
  maxDirectories?: number;
}

async function inspectFile(file: ProjectFile, relativePath: string): Promise<Finding[]> {
  switch (file.kind) {
    case "rollup":
      return [{ code: "config", path: relativePath }, ...(await inspectRollupConfig(file.path, relativePath))];
    case "manifest":
      return inspectManifest(file.path, relativePath);
    case "torus-config":
      return [{ code: "torus-config", path: relativePath }];
    case "lerna":
      return [{ code: "lerna", path: relativePath }];
    case "config":
      return [{ code: "config", path: relativePath }];
    case "escaped-link":
      return [{ code: "escaped-symlink", path: relativePath }];
    default: {
      const unhandled: never = file.kind;
      throw new Error(`Unhandled project file kind: ${String(unhandled)}`);
    }
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : Number(left > right);
}

export async function inspectProject(root: string, { maxDirectories = 10_000 }: InspectionOptions = {}): Promise<Finding[]> {
  const projectRoot = path.resolve(root);
  if (!(await stat(projectRoot)).isDirectory()) throw new Error(`Inspection root is not a directory: ${projectRoot}`);

  const { files, truncated } = await walkProject(projectRoot, maxDirectories);
  const findings = (await Promise.all(files.map((file) => inspectFile(file, path.relative(projectRoot, file.path))))).flat();
  if (truncated) findings.push({ code: "truncated", path: ".", detail: `${maxDirectories} directories` });
  return findings.sort((left, right) => compareText(left.path, right.path) || compareText(left.code, right.code));
}
