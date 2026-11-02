import type { Dirent } from "node:fs";
import { readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";

export type ProjectFileKind = "rollup" | "manifest" | "torus-config" | "lerna" | "config" | "escaped-link";

export interface ProjectFile {
  kind: ProjectFileKind;
  path: string;
}

export interface ProjectWalk {
  files: ProjectFile[];
  truncated: boolean;
}

export const skippedDirectories = ["node_modules", ".git", ".vite", "dist", "build", "coverage", "fixtures", "__fixtures__"] as const;

const skipped = new Set<string>(skippedDirectories);

const configFiles = new Set([
  ".browserslistrc",
  "babel.config.js",
  "babel.config.cjs",
  "babel.config.mjs",
  "babel.config.json",
  ".babelrc",
  ".babelrc.json",
  ".babelrc.js",
  ".babelrc.cjs",
  ".babelrc.mjs",
  "tsconfig.build.json",
]);

function classify(name: string): Exclude<ProjectFileKind, "escaped-link"> | undefined {
  if (/^rollup\.config\.[cm]?[jt]s$/.test(name)) return "rollup";
  if (name === "package.json") return "manifest";
  if (/^torus\.config\.(?:[cm]?[jt]s|json)$/.test(name)) return "torus-config";
  if (name === "lerna.json") return "lerna";
  if (configFiles.has(name)) return "config";
  return undefined;
}

function isMissing(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function readEntries(directory: string): Promise<Dirent[]> {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
}

interface EntryTarget {
  kind: "file" | "directory";
  realPath: string;
}

async function resolveEntry(entry: Dirent, absolutePath: string, realPath: string): Promise<EntryTarget | undefined> {
  if (entry.isDirectory()) return { kind: "directory", realPath };
  if (entry.isFile()) return { kind: "file", realPath };
  if (!entry.isSymbolicLink()) return undefined;
  try {
    const target = await realpath(absolutePath);
    const targetStats = await stat(target);
    if (targetStats.isDirectory()) return { kind: "directory", realPath: target };
    if (targetStats.isFile()) return { kind: "file", realPath: target };
    return undefined;
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

export async function walkProject(root: string, maxDirectories: number): Promise<ProjectWalk> {
  const files: ProjectFile[] = [];
  const rootRealPath = await realpath(root);
  const seen = new Set([rootRealPath]);
  const queue = [{ path: root, realPath: rootRealPath }];
  let truncated = false;

  for (const directory of queue) {
    for (const entry of await readEntries(directory.path)) {
      if (skipped.has(entry.name)) continue;
      const absolutePath = path.join(directory.path, entry.name);
      const target = await resolveEntry(entry, absolutePath, path.join(directory.realPath, entry.name));
      if (target === undefined) continue;
      const fileKind = target.kind === "file" ? classify(entry.name) : undefined;
      if (target.kind === "file" && fileKind === undefined) continue;
      if (!isInside(rootRealPath, target.realPath)) {
        files.push({ kind: "escaped-link", path: absolutePath });
        continue;
      }
      if (fileKind !== undefined) {
        files.push({ kind: fileKind, path: absolutePath });
        continue;
      }
      if (seen.has(target.realPath)) continue;
      if (seen.size >= maxDirectories) {
        truncated = true;
        continue;
      }
      seen.add(target.realPath);
      queue.push({ path: absolutePath, realPath: target.realPath });
    }
  }
  return { files, truncated };
}
