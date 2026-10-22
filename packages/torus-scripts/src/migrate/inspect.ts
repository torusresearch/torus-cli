import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

export interface InspectionResult {
  found: string[];
  unsupported: string[];
  next: string[];
}

const configFiles = [
  "torus.config.js",
  "rollup.config.js",
  "rollup.config.mjs",
  ".browserslistrc",
  "babel.config.js",
  "babel.config.cjs",
  "babel.config.mjs",
  "babel.config.cjs",
  "babel.config.json",
  ".babelrc",
  ".babelrc.json",
  ".babelrc.js",
  ".babelrc.cjs",
  ".babelrc.mjs",
  "tsconfig.build.json",
  "lerna.json",
];

const nextSteps = [
  "Run `vp migrate` at the workspace root.",
  "Review rewritten files before you accept the migration.",
  "Select the library, Node, React, or Vue profile that matches each package.",
  "Configure Changesets at the repository root.",
];

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, "$1");
}

function hasNonEmptyPlugins(source: string): boolean {
  return /\bplugins\s*:\s*(?!\[\s*\])\[[\s\S]*?\S[\s\S]*?\]/.test(source);
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
  if (/\binput\s*:\s*\{/.test(source) || /\binput\s*:\s*\[/.test(source)) {
    unsupported.add("Multi-entry builds need a separate review.");
  }
  if (/\bassetFileNames\s*:|\b(?:emitFile|this\.emitFile)\s*\(/.test(source)) {
    unsupported.add("Custom asset handling needs a separate review.");
  }
}

async function hasNestedWorkspaces(root: string, manifests: string[]): Promise<boolean> {
  for (const manifestPath of manifests) {
    if (manifestPath === path.join(root, "package.json")) continue;
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { workspaces?: unknown };
    if (manifest.workspaces) return true;
  }
  return false;
}

async function findRollupConfigs(root: string): Promise<string[]> {
  const configs: string[] = [];
  const queue = [root];
  let visited = 0;

  while (queue.length > 0 && visited < 10000) {
    visited += 1;
    const directory = queue.shift();
    if (!directory) continue;

    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".vite") continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory() && !(await exists(path.join(absolutePath, "node_modules"))) && visited + queue.length < 10000) {
        queue.push(absolutePath);
      } else if (entry.isFile() && /^rollup\.config\.(?:js|mjs|cjs)$/.test(entry.name)) {
        configs.push(absolutePath);
      }
    }
  }
  return configs;
}

async function findManifests(root: string): Promise<string[]> {
  const manifests: string[] = [];
  const queue = [root];
  let visited = 0;

  while (queue.length > 0 && visited < 10000) {
    visited += 1;
    const directory = queue.shift();
    if (!directory) continue;

    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") continue;
      throw error;
    }

    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".vite") continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory() && !(await exists(path.join(absolutePath, "node_modules")))) queue.push(absolutePath);
      else if (entry.isFile() && entry.name === "package.json") manifests.push(absolutePath);
    }
  }
  return manifests;
}

export async function inspectProject(root: string): Promise<InspectionResult> {
  const projectRoot = path.resolve(root);
  const rootStats = await stat(projectRoot);
  if (!rootStats.isDirectory()) throw new Error(`Inspection root is not a directory: ${projectRoot}`);

  const found = new Set<string>();
  const unsupported = new Set<string>();

  for (const fileName of configFiles) {
    const filePath = path.join(projectRoot, fileName);
    if (!(await exists(filePath))) continue;
    found.add(fileName);
    if (fileName === "lerna.json") found.add("Lerna");
    if (fileName.startsWith("rollup.config.")) await inspectRollupConfig(filePath, unsupported);
  }

  const rollupConfigs = await findRollupConfigs(projectRoot);
  for (const configPath of rollupConfigs) {
    found.add(path.relative(projectRoot, configPath));
    await inspectRollupConfig(configPath, unsupported);
  }

  const manifests = await findManifests(projectRoot);
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

  if (manifests.length > 1 && (await hasNestedWorkspaces(projectRoot, manifests))) {
    unsupported.add("Nested workspace migration needs a separate review.");
  }

  return {
    found: [...found].sort(),
    unsupported: [...unsupported].sort(),
    next: nextSteps,
  };
}
