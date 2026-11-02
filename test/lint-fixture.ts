import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const repositoryDirectory = path.resolve(import.meta.dirname, "..");
export const vp = path.join(repositoryDirectory, "node_modules", ".bin", "vp");

export interface VpResult {
  status: number | null;
  stdout: string;
  /** stdout followed by stderr. */
  output: string;
}

export function runVp(args: string[], cwd: string): VpResult {
  const result = spawnSync(vp, args, { cwd, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, output: result.stdout + result.stderr };
}

/** Reads the `npm pack --json` result. Lifecycle scripts such as `prepack` can print text before the JSON. */
export function parsePackResult(output: string): { filename: string } {
  const jsonStart = Math.max(output.lastIndexOf("\n["), output.lastIndexOf("\n{"));
  const packed = JSON.parse(jsonStart === -1 ? output : output.slice(jsonStart + 1)) as
    | { filename: string }[]
    | { filename: string }
    | Record<string, { filename: string }>;
  if (Array.isArray(packed)) return packed[0];
  if ("filename" in packed) return packed;
  return Object.values(packed)[0];
}

/** Builds a fixture `vite.config.ts`. Fixtures live in the repository root, so `importLine` paths start with `../packages/`. */
export function viteLintConfig(importLine: string, lint: string): string {
  return `import { defineConfig } from "vite-plus";\n${importLine}\nexport default defineConfig({ lint: ${lint} });\n`;
}

/**
 * Writes `files` to a new temporary directory, runs `check` in it, then removes the directory.
 * The directory is in the repository root unless `parent` is given, so fixtures resolve workspace packages.
 */
export async function withFixture<T>(
  name: string,
  files: Record<string, string>,
  check: (directory: string) => T | Promise<T>,
  parent = repositoryDirectory
): Promise<T> {
  const directory = await mkdtemp(path.join(parent, `${name}-`));
  try {
    for (const [file, contents] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
      await writeFile(path.join(directory, file), contents);
    }
    return await check(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
