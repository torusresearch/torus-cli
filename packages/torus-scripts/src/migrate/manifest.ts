import { readFile } from "node:fs/promises";

import type { Blocker, Finding, InspectionResult } from "./model.js";

interface Manifest {
  scripts: string[];
  dependencies: Record<string, string>;
  hasWorkspaces: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringEntries(value: unknown): [string, string][] {
  if (!isRecord(value)) return [];
  return Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string");
}

async function readManifest(manifestPath: string): Promise<Manifest | undefined> {
  let data: unknown;
  try {
    data = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
  if (!isRecord(data)) return undefined;
  return {
    scripts: stringEntries(data.scripts).map(([, script]) => script),
    dependencies: Object.fromEntries([...stringEntries(data.dependencies), ...stringEntries(data.devDependencies)]),
    hasWorkspaces: data.workspaces !== undefined,
  };
}

function majorVersion(spec: string): number | undefined {
  const match = /^\s*[~^]?\s*(?:>=?\s*)?v?(\d+)/.exec(spec);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

export async function inspectManifest(manifestPath: string, relativePath: string): Promise<InspectionResult> {
  const manifest = await readManifest(manifestPath);
  if (manifest === undefined) return { findings: [], blockers: [{ code: "unreadable-manifest", path: relativePath }] };

  const { dependencies, scripts } = manifest;
  const findings: Finding[] = [];
  const blockers: Blocker[] = [];
  const uses = (tool: string) => Object.hasOwn(dependencies, tool) || scripts.some((script) => new RegExp(`\\b${tool}\\b`).test(script));

  if (relativePath !== "package.json" && manifest.hasWorkspaces) blockers.push({ code: "nested-workspaces", path: relativePath });
  if (uses("lerna")) findings.push({ kind: "tool", tool: "Lerna", path: relativePath });
  if (uses("release-it")) findings.push({ kind: "tool", tool: "release-it", path: relativePath });
  if (scripts.some((script) => /(?:^|[\s;&|(])torus-scripts(?=\s|$)/.test(script))) {
    findings.push({ kind: "legacy-scripts", path: relativePath });
    blockers.push({ code: "legacy-commands", path: relativePath });
  }

  const spec = dependencies["@toruslabs/torus-scripts"];
  if (spec !== undefined) {
    const major = majorVersion(spec);
    if (major === undefined) {
      blockers.push({ code: "unknown-dependency-version", path: relativePath });
    } else if (major < 8) {
      findings.push({ kind: "legacy-dependency", path: relativePath, spec });
      blockers.push({ code: "legacy-dependency", path: relativePath });
    }
  }
  return { findings, blockers };
}
