import { stat } from "node:fs/promises";
import path from "node:path";

import { inspectManifest } from "./manifest.js";
import type { Blocker, Finding, InspectionResult } from "./model.js";
import { rollupConfigBlockers } from "./rollup.js";
import { type ProjectFile, walkProject } from "./walk.js";

export interface InspectionOptions {
  maxDirectories?: number;
}

async function inspectFile(file: ProjectFile, relativePath: string): Promise<InspectionResult> {
  const config: Finding = { kind: "config", path: relativePath };
  switch (file.kind) {
    case "rollup":
      return { findings: [config], blockers: await rollupConfigBlockers(file.path, relativePath) };
    case "manifest":
      return inspectManifest(file.path, relativePath);
    case "torus-config":
      return { findings: [config], blockers: [{ code: "torus-config", path: relativePath }] };
    case "lerna":
      return { findings: [{ kind: "tool", tool: "Lerna", path: relativePath }], blockers: [] };
    case "config":
      return { findings: [config], blockers: [] };
    default: {
      const unhandled: never = file.kind;
      throw new Error(`Unhandled project file kind: ${String(unhandled)}`);
    }
  }
}

function sortKey(item: Finding | Blocker): string {
  return `${"path" in item ? item.path : ""}\0${"kind" in item ? item.kind : item.code}`;
}

function byKey(left: Finding | Blocker, right: Finding | Blocker): number {
  const leftKey = sortKey(left);
  const rightKey = sortKey(right);
  return leftKey < rightKey ? -1 : Number(leftKey > rightKey);
}

export async function inspectProject(root: string, { maxDirectories = 10_000 }: InspectionOptions = {}): Promise<InspectionResult> {
  const projectRoot = path.resolve(root);
  if (!(await stat(projectRoot)).isDirectory()) throw new Error(`Inspection root is not a directory: ${projectRoot}`);

  const { files, escapedLinks, truncated } = await walkProject(projectRoot, maxDirectories);
  const walkBlockers: Blocker[] = escapedLinks.map((linkPath) => ({ code: "escaped-symlink", path: path.relative(projectRoot, linkPath) }));
  if (truncated) walkBlockers.push({ code: "truncated", limit: maxDirectories });

  const results = await Promise.all(files.map((file) => inspectFile(file, path.relative(projectRoot, file.path))));
  return {
    findings: results.flatMap(({ findings }) => findings).sort(byKey),
    blockers: [...walkBlockers, ...results.flatMap(({ blockers }) => blockers)].sort(byKey),
  };
}
