import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

export type InspectionResult = { found: string[]; unsupported: string[]; next: string[] };

type ProjectFile = { relativePath: string; absolutePath: string };

const MAX_DIRECTORIES = 10_000;
const EXCLUDED_DIRECTORIES = new Set(["node_modules", ".git", ".vite"]);
const ROLLUP_CONFIG_PATTERN = /^rollup\.config\.(?:js|mjs|cjs)$/;
const KNOWN_FILES = new Set([
  "torus.config.js",
  ".browserslistrc",
  "babel.config.js",
  "tsconfig.build.json",
  "lerna.json",
]);

async function walkProject(root: string): Promise<ProjectFile[]> {
  const files: ProjectFile[] = [];
  const directories = [root];
  let visitedDirectories = 0;

  while (directories.length > 0 && visitedDirectories < MAX_DIRECTORIES) {
    const directory = directories.pop();
    if (!directory) break;
    visitedDirectories += 1;

    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name)) directories.push(absolutePath);
      } else if (entry.isFile()) {
        const relativePath = path.relative(root, absolutePath);
        if (
          entry.name === "package.json" ||
          KNOWN_FILES.has(entry.name) ||
          ROLLUP_CONFIG_PATTERN.test(entry.name)
        ) {
          files.push({ relativePath, absolutePath });
        }
      }
    }
  }

  return files;
}

function hasNonEmptyPluginList(config: string): boolean {
  const pluginList = /\bplugins\s*:\s*\[([\s\S]*?)\]/g;
  for (const match of config.matchAll(pluginList)) {
    const entries = match[1]
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/[^\n]*/g, "")
      .trim();
    if (entries.length > 0) return true;
  }
  return false;
}

export async function inspectProject(root: string): Promise<InspectionResult> {
  const absoluteRoot = path.resolve(root);
  let rootStats;
  try {
    rootStats = await stat(absoluteRoot);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") throw new Error(`Project root does not exist: ${absoluteRoot}`);
    if (code === "ENOTDIR") throw new Error(`Project root is not a directory: ${absoluteRoot}`);
    throw error;
  }
  if (!rootStats.isDirectory()) throw new Error(`Project root is not a directory: ${absoluteRoot}`);

  const files = await walkProject(absoluteRoot);
  const found = files.map((file) => file.relativePath).sort();
  const unsupported: string[] = [];
  const manifests = files.filter((file) => path.basename(file.relativePath) === "package.json");
  const rollupConfigs = files.filter((file) =>
    ROLLUP_CONFIG_PATTERN.test(path.basename(file.relativePath)),
  );

  for (const manifest of manifests) {
    const packageJson = JSON.parse(await readFile(manifest.absolutePath, "utf8")) as {
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    const scripts = Object.entries(packageJson.scripts ?? {});
    if (scripts.some(([name, command]) => /lerna|release-it/.test(`${name} ${command}`))) {
      unsupported.push(
        `${manifest.relativePath}: Lerna or release-it scripts need a manual Changesets migration.`,
      );
    }
    if (
      [
        ...Object.keys(packageJson.dependencies ?? {}),
        ...Object.keys(packageJson.devDependencies ?? {}),
      ].some((dependency) => /^(?:lerna|release-it)$/.test(dependency))
    ) {
      unsupported.push(
        `${manifest.relativePath}: Lerna or release-it dependencies need a manual Changesets migration.`,
      );
    }
  }

  for (const config of rollupConfigs) {
    const source = await readFile(config.absolutePath, "utf8");
    if (hasNonEmptyPluginList(source)) {
      unsupported.push(
        `${config.relativePath}: custom Rollup plugin behavior needs manual migration.`,
      );
    }
    if (/\btransform\s*\(/.test(source) || /\btransform\s*:/.test(source)) {
      unsupported.push(`${config.relativePath}: custom Rollup transforms need manual migration.`);
    }
    if (/polyfill|core-js|babel-plugin-transform-object-hasown/i.test(source)) {
      unsupported.push(
        `${config.relativePath}: polyfill or Babel behavior needs manual migration.`,
      );
    }
    if (/\binput\s*:\s*(?:\{|\[)/.test(source) || /\bassetFileNames\b|\bassetsDir\b/.test(source)) {
      unsupported.push(
        `${config.relativePath}: multi-entry or asset behavior needs manual migration.`,
      );
    }
  }

  const next = [
    "Run vp migrate at the workspace root, then review every rewritten file.",
    "Select the library, Node, React, or Vue profile that fits each package.",
    "Configure Changesets at the repository root for release management.",
  ];
  return { found, unsupported: [...new Set(unsupported)], next };
}
