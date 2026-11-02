import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, it } from "vitest";

import { typescriptLintPreset } from "./index.js";

it("provides JS and TS unused-variable checks without framework plugins", () => {
  const config = typescriptLintPreset();
  expect(config.plugins).toContain("typescript");
  expect(config.plugins).not.toEqual(expect.arrayContaining(["react", "jsx-a11y", "vue", "node"]));
  expect(config.rules).toHaveProperty("no-unused-vars");
  expect(config.jsPlugins).toBeUndefined();
});

it("lints consumer source types and test fixtures", async () => {
  const repositoryDirectory = path.resolve(import.meta.dirname, "../..");
  const fixtureDirectory = await mkdtemp(path.join(repositoryDirectory, "oxlint-paths-"));
  const vp = path.join(repositoryDirectory, "node_modules", ".bin", "vp");

  try {
    await writeFile(
      path.join(fixtureDirectory, "vite.config.ts"),
      'import { defineConfig } from "vite-plus";\nimport { typescriptLintPreset } from "../packages/oxlint-config-typescript/index.js";\nexport default defineConfig({ lint: typescriptLintPreset() });\n'
    );
    for (const directory of ["src/types", "test/fixtures"]) {
      const targetDirectory = path.join(fixtureDirectory, directory);
      await mkdir(targetDirectory, { recursive: true });
      await writeFile(path.join(targetDirectory, "bad.ts"), "const unusedValue = 1;\n");
      const result = spawnSync(vp, ["lint", path.join(directory, "bad.ts")], { cwd: fixtureDirectory, encoding: "utf8" });
      expect(result.stdout + result.stderr).toContain("no-unused-vars");
      expect(result.status).not.toBe(0);
    }
  } finally {
    await rm(fixtureDirectory, { recursive: true, force: true });
  }
});
