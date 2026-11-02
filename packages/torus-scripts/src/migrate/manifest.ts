import { readFile } from "node:fs/promises";

import type { Code, Finding } from "./model.js";

interface Manifest {
  commands: Set<string>;
  dependencies: Map<string, string[]>;
  hasWorkspaces: boolean;
}

const dependencyFields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringEntries(value: unknown): [string, string][] {
  if (!isRecord(value)) return [];
  return Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string");
}

function commandWords(script: string): string[] {
  return script
    .split(/[\s;&|()]+/)
    .filter(Boolean)
    .map((word) => word.replace(/^(?:.*\/)?node_modules\/\.bin\//, ""));
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

  const dependencies = new Map<string, string[]>();
  for (const field of dependencyFields) {
    for (const [name, spec] of stringEntries(data[field])) dependencies.set(name, [...(dependencies.get(name) ?? []), spec]);
  }
  return {
    commands: new Set(stringEntries(data.scripts).flatMap(([, script]) => commandWords(script))),
    dependencies,
    hasWorkspaces: data.workspaces !== undefined,
  };
}

function torusScriptsSpecCode(spec: string): Code | undefined {
  const target = spec.replace(/^npm:@toruslabs\/torus-scripts@/, "");
  if (/^(?:workspace|file|link|portal):/.test(target)) return "local-dependency";
  const major = /^\s*[~^]?\s*(?:>=?\s*)?v?(\d+)/.exec(target)?.[1];
  if (major === undefined) return "unknown-dependency-version";
  return Number(major) < 8 ? "legacy-dependency" : undefined;
}

export async function inspectManifest(manifestPath: string, relativePath: string): Promise<Finding[]> {
  const manifest = await readManifest(manifestPath);
  if (manifest === undefined) return [{ code: "unreadable-manifest", path: relativePath }];

  const findings: Finding[] = [];
  const add = (code: Code, detail?: string) => findings.push({ code, path: relativePath, ...(detail === undefined ? {} : { detail }) });
  const uses = (tool: string) => manifest.dependencies.has(tool) || manifest.commands.has(tool);

  if (relativePath !== "package.json" && manifest.hasWorkspaces) add("nested-workspaces");
  if (uses("lerna")) add("lerna");
  if (uses("release-it")) add("release-it");
  if (manifest.commands.has("torus-scripts")) add("legacy-commands");
  for (const spec of manifest.dependencies.get("@toruslabs/torus-scripts") ?? []) {
    const code = torusScriptsSpecCode(spec);
    if (code !== undefined) add(code, spec);
  }
  return findings;
}
