import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { formatPreset } from "../src/presets/fmt.js";
import { lintPreset } from "../src/presets/lint.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(testDirectory, "..");
const repositoryDirectory = path.resolve(packageDirectory, "../..");
const vp = path.join(repositoryDirectory, "node_modules", ".bin", "vp");

describe("lint and format presets", () => {
  it("enables native checks for JavaScript and TypeScript source", () => {
    const config = lintPreset();

    expect(config.plugins).toContain("typescript");
    expect(config.rules).toMatchObject({
      "no-unused-vars": ["error", expect.any(Object)],
    });
    expect(config.options).toBeUndefined();
  });

  it("uses the formatter baseline and enables Oxfmt import sorting", () => {
    expect(formatPreset()).toEqual({
      printWidth: 150,
      semi: true,
      singleQuote: false,
      trailingComma: "es5",
      sortImports: true,
      sortPackageJson: false,
    });
  });

  it("exports reusable lint and format subpaths", async () => {
    const packageJson = JSON.parse(await readFile(path.join(packageDirectory, "package.json"), "utf8"));

    expect(packageJson.exports).toHaveProperty("./lint");
    expect(packageJson.exports).toHaveProperty("./fmt");
    expect(packageJson.exports["./lint"].import).toBe("./dist/index.mjs");
    expect(packageJson.exports["./fmt"].import).toBe("./dist/index.mjs");
  });

  it("rejects unused variables in JavaScript and TypeScript", async () => {
    const fixturesDirectory = await mkdtemp(path.join(tmpdir(), "task-6-fixtures-"));
    const jsFixture = path.join(fixturesDirectory, "unused.js");
    const tsFixture = path.join(fixturesDirectory, "unused.ts");

    try {
      await Promise.all([writeFile(jsFixture, "const unusedValue = 1;\n"), writeFile(tsFixture, "const unusedValue: number = 1;\n")]);

      for (const fixture of [jsFixture, tsFixture]) {
        const result = spawnSync(vp, ["lint", fixture], {
          cwd: repositoryDirectory,
          encoding: "utf8",
        });
        expect(result.status, `${fixture}: ${result.stdout}\n${result.stderr}`).not.toBe(0);
        expect(result.stdout + result.stderr).toContain("no-unused-vars");
      }

      const checkResult = spawnSync(vp, ["check", jsFixture], {
        cwd: repositoryDirectory,
        encoding: "utf8",
      });
      expect(checkResult.status, checkResult.stdout + checkResult.stderr).not.toBe(0);
    } finally {
      await rm(fixturesDirectory, { recursive: true, force: true });
    }
  });

  it("uses vp fmt --check for format and import-sort failures", async () => {
    const fixturesDirectory = await mkdtemp(path.join(tmpdir(), "task-6-fixtures-"));
    const unformattedFixture = path.join(fixturesDirectory, "unformatted.js");
    const unsortedFixture = path.join(fixturesDirectory, "unsorted-imports.js");

    try {
      await Promise.all([
        writeFile(unformattedFixture, "const value={answer:42}\nvoid value\n"),
        writeFile(unsortedFixture, 'import { zeta } from "zeta";\nimport { alpha } from "alpha";\nvoid [zeta, alpha];\n'),
      ]);
      for (const fixture of [unformattedFixture, unsortedFixture]) {
        const result = spawnSync(vp, ["fmt", "--check", fixture], {
          cwd: repositoryDirectory,
          encoding: "utf8",
        });
        expect(result.status, `${result.stdout}\n${result.stderr}`).not.toBe(0);
      }
    } finally {
      await rm(fixturesDirectory, { recursive: true, force: true });
    }
  });

  it("checks the root config from any workspace directory", () => {
    const result = spawnSync(vp, ["check", "src/presets"], {
      cwd: packageDirectory,
      encoding: "utf8",
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });
});
