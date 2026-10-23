import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { formatPreset } from "../src/presets/fmt.js";
import { lintPreset, tailwindLintPreset } from "../src/presets/lint.js";
import { vueLintPreset } from "../src/presets/vue-lint.js";

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

  it("enables native rule families without dropping default plugins", () => {
    const config = lintPreset();
    expect(config.plugins).toEqual(
      expect.arrayContaining(["eslint", "typescript", "unicorn", "oxc", "import", "promise", "vitest", "react", "jsx-a11y", "node"])
    );
    expect(config.rules).toMatchObject({ "no-console": ["error", { allow: ["warn", "error"] }], "promise/always-return": expect.anything() });
  });

  it("keeps Vue and Tailwind integrations opt-in and tied to consumer settings", () => {
    const vue = vueLintPreset();
    const tailwind = tailwindLintPreset({ entryPoint: "src/styles.css" });
    expect(vue.jsPlugins).toEqual(expect.arrayContaining(["oxlint-plugin-vize"]));
    expect(vue.plugins).toContain("vue");
    expect(tailwind.jsPlugins).toEqual(["oxlint-tailwindcss"]);
    expect(tailwind.settings).toMatchObject({ tailwindcss: { entryPoint: "src/styles.css" } });
    expect(tailwind.rules).toHaveProperty("tailwindcss/no-unknown-classes", "error");
  });

  it("does not enable framework plugins or Tailwind until requested", () => {
    const config = lintPreset();
    expect(config.plugins).not.toContain("vue");
    expect(config.jsPlugins).toBeUndefined();
    expect(config.settings?.tailwindcss).toBeUndefined();
  });

  it("reports a Vize template diagnostic through the opt-in Vue profile", async () => {
    const fixtureDirectory = await mkdtemp(path.join(repositoryDirectory, "vize-fixture-"));
    try {
      await writeFile(
        path.join(fixtureDirectory, "vite.config.ts"),
        `import { defineConfig } from "vite-plus";\nimport { vueLintPreset } from "../packages/torus-scripts/src/presets/vue-lint.js";\nexport default defineConfig({ lint: vueLintPreset() });\n`
      );
      await writeFile(
        path.join(fixtureDirectory, "Bad.vue"),
        '<template><div v-for="item in items">{{ item }}</div></template>\n<script setup lang="ts">const items = [1];</script>\n'
      );
      const result = spawnSync(vp, ["lint", "Bad.vue"], { cwd: fixtureDirectory, encoding: "utf8" });
      expect(result.status).not.toBe(0);
      expect(result.stdout + result.stderr).toContain("vize(vue/require-v-for-key)");
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });

  it("reports an unknown Tailwind class through the opt-in CSS profile", async () => {
    const fixtureDirectory = await mkdtemp(path.join(repositoryDirectory, "tailwind-fixture-"));
    try {
      await writeFile(
        path.join(fixtureDirectory, "vite.config.ts"),
        `import { defineConfig } from "vite-plus";\nimport { tailwindLintPreset } from "../packages/torus-scripts/src/presets/lint.js";\nexport default defineConfig({ lint: tailwindLintPreset({ entryPoint: "styles.css" }) });\n`
      );
      await writeFile(path.join(fixtureDirectory, "styles.css"), '@import "tailwindcss";\n');
      await writeFile(path.join(fixtureDirectory, "Bad.tsx"), 'export const View = () => <div className="madeuputility" />;\n');
      const result = spawnSync(vp, ["lint", "Bad.tsx"], { cwd: fixtureDirectory, encoding: "utf8" });
      expect(result.status).not.toBe(0);
      expect(result.stdout + result.stderr).toContain("tailwindcss(no-unknown-classes)");
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });

  it("removes the old CLI and ESLint packages from published workspace metadata", async () => {
    const root = JSON.parse(await readFile(path.join(repositoryDirectory, "package.json"), "utf8"));
    const manifest = JSON.parse(await readFile(path.join(packageDirectory, "package.json"), "utf8"));
    const changesets = JSON.parse(await readFile(path.join(repositoryDirectory, ".changeset/config.json"), "utf8"));
    expect(manifest.bin).toEqual({ "torus-scripts-upgrade": "./dist/migrate/cli.mjs" });
    expect(manifest.peerDependencies).not.toHaveProperty("eslint");
    expect(root.devDependencies).not.toHaveProperty("eslint");
    expect(root.scripts["check:styles"]).toBe("vp fmt --check .");
    expect(changesets.ignore).toEqual([]);
  });

  it("runs hardened validation without publishing on pull requests", async () => {
    const workflow = await readFile(path.join(repositoryDirectory, ".github/workflows/validate-pr.yml"), "utf8");
    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("harden check --package-manager npm");
    expect(workflow).toContain("npm run check");
    expect(workflow).toContain("npm run test");
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain("npm pack --workspaces --dry-run");
    expect(workflow).not.toContain("changeset publish");
  });

  it("scans JavaScript and TypeScript with CodeQL and Semgrep without tokens", async () => {
    const workflow = await readFile(path.join(repositoryDirectory, ".github/workflows/security-code-scanner.yml"), "utf8");
    expect(workflow).toContain("security-extended");
    expect(workflow).toContain("javascript-typescript");
    expect(workflow).toContain("semgrep scan");
    expect(workflow).toContain("p/javascript");
    expect(workflow).toContain("p/typescript");
    expect(workflow).not.toContain("SEMGREP_APP_TOKEN");
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

  it("exports Vue lint only from its optional entry", async () => {
    const manifest = JSON.parse(await readFile(path.join(packageDirectory, "package.json"), "utf8"));
    expect(manifest.exports["./vue-lint"].import).toBe("./dist/vue-lint.mjs");
    expect(manifest.peerDependenciesMeta["oxlint-plugin-vize"].optional).toBe(true);
  });

  it("exports reusable lint and format subpaths", async () => {
    const packageJson = JSON.parse(await readFile(path.join(packageDirectory, "package.json"), "utf8"));

    expect(packageJson.exports).toHaveProperty("./lint");
    expect(packageJson.exports).toHaveProperty("./fmt");
    expect(packageJson.exports["./lint"].import).toBe("./dist/index.mjs");
    expect(packageJson.exports["./fmt"].import).toBe("./dist/index.mjs");
  });

  it("rejects unused imports and variables in JavaScript and TypeScript", async () => {
    const fixturesDirectory = await mkdtemp(path.join(tmpdir(), "task-6-fixtures-"));
    const jsFixture = path.join(fixturesDirectory, "unused.js");
    const tsFixture = path.join(fixturesDirectory, "unused.ts");
    const unusedImportFixture = path.join(fixturesDirectory, "unused-import.js");

    try {
      await Promise.all([
        writeFile(jsFixture, "const unusedValue = 1;\n"),
        writeFile(tsFixture, "const unusedValue: number = 1;\n"),
        writeFile(unusedImportFixture, 'import { readFile } from "node:fs/promises";\n'),
      ]);

      for (const fixture of [jsFixture, tsFixture, unusedImportFixture]) {
        const result = spawnSync(vp, ["lint", fixture], {
          cwd: repositoryDirectory,
          encoding: "utf8",
        });
        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain("no-unused-vars");
      }

      const checkResult = spawnSync(vp, ["check", jsFixture], {
        cwd: repositoryDirectory,
        encoding: "utf8",
      });
      expect(checkResult.status).not.toBe(0);
      expect(checkResult.stdout + checkResult.stderr).toContain("no-unused-vars");
    } finally {
      await rm(fixturesDirectory, { recursive: true, force: true });
    }
  });

  it("confirms native sort-imports detects an unsorted JS fixture", async () => {
    const fixturesDirectory = await mkdtemp(path.join(tmpdir(), "task-6-fixtures-"));
    const fixture = path.join(fixturesDirectory, "unsorted-imports.js");

    try {
      await writeFile(fixture, 'import { zeta } from "zeta";\nimport { alpha } from "alpha";\nvoid [zeta, alpha];\n');
      const result = spawnSync(vp, ["lint", fixture, "--deny", "sort-imports"], {
        cwd: repositoryDirectory,
        encoding: "utf8",
      });
      expect(result.status).not.toBe(0);
      expect(result.stdout + result.stderr).toContain("sort-imports");
    } finally {
      await rm(fixturesDirectory, { recursive: true, force: true });
    }
  });

  it("rejects a formatter violation through vp check", async () => {
    const fixturesDirectory = await mkdtemp(path.join(tmpdir(), "task-6-fixtures-"));
    const fixture = path.join(fixturesDirectory, "unformatted.js");

    try {
      await writeFile(fixture, "const value={answer:42}\nvoid value\n");
      const result = spawnSync(vp, ["check", fixture], {
        cwd: repositoryDirectory,
        encoding: "utf8",
      });
      expect(result.status).not.toBe(0);
      expect(result.stdout + result.stderr).toContain("Formatting issues found");
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
        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain("Format issues found");
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
    expect(result.status).toBe(0);
  });
});
