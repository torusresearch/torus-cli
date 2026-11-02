import type { Dirent } from "node:fs";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";

export interface InspectionResult {
  found: string[];
  unsupported: string[];
  next: string[];
}

export interface InspectionOptions {
  maxDirectories?: number;
}

const configFiles = [
  "torus.config.js",
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
  "lerna.json",
];

const ignoredDirectories = new Set(["node_modules", ".git", ".vite", "dist", "build", "coverage", "fixtures", "__fixtures__"]);

const nextSteps = [
  "Run `vp migrate` at the workspace root.",
  "Review rewritten files before you accept the migration.",
  "Select the library, Node, React, or Vue profile that matches each package.",
  "Configure Changesets at the repository root.",
];

function isMissing(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, "$1");
}

function hasNonEmptyPlugins(source: string): boolean {
  return /\bplugins\s*:\s*(?!\[\s*\])\[[\s\S]*?\S[\s\S]*?\]/.test(source);
}

function countTopLevelItems(source: string, openIndex: number): number {
  let depth = 0;
  let items = 0;
  let hasContent = false;
  let quote: string | undefined;

  for (let index = openIndex; index < source.length; index += 1) {
    const character = source.charAt(index);
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = undefined;
      continue;
    }
    if (character === "," && depth === 1) {
      if (hasContent) items += 1;
      hasContent = false;
      continue;
    }
    if ("([{".includes(character)) {
      depth += 1;
      if (depth === 1) continue;
    } else if (")]}".includes(character)) {
      depth -= 1;
      if (depth === 0) return items + Number(hasContent);
    } else if ("\"'`".includes(character)) {
      quote = character;
    }
    if (!/\s/.test(character)) hasContent = true;
  }
  return items + Number(hasContent);
}

function hasMultipleEntries(source: string): boolean {
  const listPatterns = [/\binput\s*:\s*[[{]/g, /\b(?:export\s+default|module\.exports\s*=)\s*(?:defineConfig\s*\(\s*)?\[/g];
  for (const pattern of listPatterns) {
    for (const match of source.matchAll(pattern)) {
      if (countTopLevelItems(source, match.index + match[0].length - 1) > 1) return true;
    }
  }
  return false;
}

async function inspectRollupConfig(filePath: string, unsupported: Set<string>): Promise<void> {
  const source = stripComments(await readFile(filePath, "utf8"));

  if (hasNonEmptyPlugins(source) || /\b(?:plugin[A-Z_a-z0-9]*|custom[A-Z_a-z0-9]*)\s*\(/.test(source)) {
    unsupported.add("Custom Rollup plugins need a separate review.");
  }
  if (/\b(?:transform|transformCode|renderChunk|load)\s*\(/.test(source)) {
    unsupported.add("Custom transforms need a separate review.");
  }
  if (/\b(?:polyfill|core-js|babel-polyfill|process\s*:\s*["']|Buffer\s*:\s*["'])/i.test(source)) {
    unsupported.add("Polyfills or runtime replacements need a separate review.");
  }
  if (hasMultipleEntries(source)) {
    unsupported.add("Multi-entry builds need a separate review.");
  }
  if (/\bassetFileNames\s*:|\b(?:emitFile|this\.emitFile)\s*\(/.test(source)) {
    unsupported.add("Custom asset handling needs a separate review.");
  }
}

async function entryKind(entry: Dirent, absolutePath: string): Promise<"directory" | "file" | undefined> {
  if (entry.isDirectory()) return "directory";
  if (entry.isFile()) return "file";
  if (!entry.isSymbolicLink()) return undefined;
  try {
    const target = await stat(absolutePath);
    if (target.isDirectory()) return "directory";
    if (target.isFile()) return "file";
    return undefined;
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

interface ProjectFiles {
  rollupConfigs: string[];
  manifests: string[];
  truncated: boolean;
}

async function walkProject(root: string, maxDirectories: number): Promise<ProjectFiles> {
  const rollupConfigs: string[] = [];
  const manifests: string[] = [];
  const seen = new Set([await realpath(root)]);
  const queue = [root];
  let truncated = false;

  for (const directory of queue) {
    let entries: Dirent[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (isMissing(error)) continue;
      throw error;
    }

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const kind = await entryKind(entry, absolutePath);
      if (kind === "directory") {
        if (ignoredDirectories.has(entry.name)) continue;
        const resolvedPath = await realpath(absolutePath);
        if (seen.has(resolvedPath)) continue;
        if (seen.size >= maxDirectories) {
          truncated = true;
          continue;
        }
        seen.add(resolvedPath);
        queue.push(absolutePath);
      } else if (kind === "file") {
        if (/^rollup\.config\.(?:js|mjs|cjs)$/.test(entry.name)) rollupConfigs.push(absolutePath);
        else if (entry.name === "package.json") manifests.push(absolutePath);
      }
    }
  }
  return { rollupConfigs, manifests, truncated };
}

export async function inspectProject(root: string, { maxDirectories = 10_000 }: InspectionOptions = {}): Promise<InspectionResult> {
  const projectRoot = path.resolve(root);
  const rootStats = await stat(projectRoot);
  if (!rootStats.isDirectory()) throw new Error(`Inspection root is not a directory: ${projectRoot}`);

  const found = new Set<string>();
  const unsupported = new Set<string>();

  for (const fileName of configFiles) {
    if (!(await exists(path.join(projectRoot, fileName)))) continue;
    found.add(fileName);
    if (fileName === "lerna.json") found.add("Lerna");
  }

  const { rollupConfigs, manifests, truncated } = await walkProject(projectRoot, maxDirectories);
  if (truncated) {
    unsupported.add(`Inspection stopped after ${maxDirectories} directories. Review the remaining directories by hand.`);
  }

  for (const configPath of rollupConfigs) {
    found.add(path.relative(projectRoot, configPath));
    await inspectRollupConfig(configPath, unsupported);
  }

  for (const manifestPath of manifests) {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      scripts?: Record<string, unknown>;
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
      workspaces?: unknown;
    };
    if (manifestPath !== path.join(projectRoot, "package.json") && manifest.workspaces !== undefined) {
      unsupported.add("Nested workspace migration needs a separate review.");
    }
    const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
    const scripts = manifest.scripts ?? {};

    if ("lerna" in dependencies || Object.values(scripts).some((script) => typeof script === "string" && /\blerna\b/.test(script))) {
      found.add("Lerna");
    }
    if ("release-it" in dependencies || Object.values(scripts).some((script) => typeof script === "string" && /\brelease-it\b/.test(script))) {
      found.add("release-it");
    }
  }

  return {
    found: [...found].sort(),
    unsupported: [...unsupported].sort(),
    next: nextSteps,
  };
}
