import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { nodeLintPreset } from "../../oxlint-config-node/index.js";
import { reactLintPreset, tailwindLintPreset } from "../../oxlint-config-react/index.js";
import { typescriptLintPreset } from "../../oxlint-config-typescript/index.js";
import { vueLintPreset } from "../../oxlint-config-vue/index.js";
import { formatPreset } from "../src/presets/fmt.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(testDirectory, "..");
const repositoryDirectory = path.resolve(packageDirectory, "../..");
const vp = path.join(repositoryDirectory, "node_modules", ".bin", "vp");

describe("lint and format presets", () => {
  it("enables native checks for JavaScript and TypeScript source", () => {
    const config = typescriptLintPreset();

    expect(config.plugins).toContain("typescript");
    expect(config.rules).toMatchObject({
      "no-unused-vars": ["error", expect.any(Object)],
    });
    expect(config.options).toBeUndefined();
  });

  it("enables native rule families without dropping default plugins", () => {
    const config = typescriptLintPreset();
    expect(config.plugins).toEqual(expect.arrayContaining(["eslint", "typescript", "unicorn", "oxc", "import", "promise", "vitest"]));
    expect(config.plugins).not.toEqual(expect.arrayContaining(["react", "jsx-a11y", "vue", "node"]));
    expect(config.rules).toMatchObject({ "no-console": ["error", { allow: ["warn", "error"] }], "promise/always-return": expect.anything() });
  });

  it("keeps Vue and Tailwind integrations opt-in and tied to consumer settings", () => {
    const vue = vueLintPreset();
    const tailwind = tailwindLintPreset({ entryPoint: "src/styles.css" });
    expect(tailwind.plugins).toBeUndefined();
    expect(tailwind.rules).not.toHaveProperty("no-unused-vars");
    expect(vue.jsPlugins).toEqual(expect.arrayContaining(["oxlint-plugin-vize"]));
    expect(vue.plugins).toContain("vue");
    expect(tailwind.jsPlugins).toEqual(["oxlint-tailwindcss"]);
    expect(tailwind.settings).toMatchObject({ tailwindcss: { entryPoint: "src/styles.css" } });
    expect(tailwind.rules).toHaveProperty("tailwindcss/no-unknown-classes", "error");
  });

  it("does not enable framework plugins or Tailwind until requested", () => {
    const config = typescriptLintPreset();
    expect(config.plugins).not.toContain("vue");
    expect(config.plugins).not.toContain("react");
    expect(config.plugins).not.toContain("node");
    expect(config.jsPlugins).toBeUndefined();
    expect(config.settings?.tailwindcss).toBeUndefined();
  });

  it("reports a Vize template diagnostic through the opt-in Vue profile", async () => {
    const fixtureDirectory = await mkdtemp(path.join(repositoryDirectory, "vize-fixture-"));
    try {
      await writeFile(
        path.join(fixtureDirectory, "vite.config.ts"),
        `import { defineConfig } from "vite-plus";\nimport { vueLintPreset } from "../packages/oxlint-config-vue/index.js";\nexport default defineConfig({ lint: vueLintPreset() });\n`
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

  it("reports React and JSX diagnostics with the React preset", async () => {
    const fixtureDirectory = await mkdtemp(path.join(repositoryDirectory, "react-lint-fixture-"));
    try {
      await writeFile(
        path.join(fixtureDirectory, "vite.config.ts"),
        `import { defineConfig } from "vite-plus";\nimport { reactLintPreset } from "../packages/oxlint-config-react/index.js";\nexport default defineConfig({ lint: reactLintPreset() });\n`
      );
      await writeFile(path.join(fixtureDirectory, "Bad.jsx"), "export function Bad() { if (true) { useState(0); } return <div />; }\n");
      const result = spawnSync(vp, ["lint", "Bad.jsx"], { cwd: fixtureDirectory, encoding: "utf8" });
      expect(result.status).not.toBe(0);
      expect(result.stdout + result.stderr).toContain("react-hooks(rules-of-hooks)");
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });

  it("reports Node diagnostics with the Node preset", async () => {
    const fixtureDirectory = await mkdtemp(path.join(repositoryDirectory, "node-lint-fixture-"));
    try {
      await writeFile(
        path.join(fixtureDirectory, "vite.config.ts"),
        `import { defineConfig } from "vite-plus";\nimport { nodeLintPreset } from "../packages/oxlint-config-node/index.js";\nexport default defineConfig({ lint: nodeLintPreset() });\n`
      );
      await writeFile(path.join(fixtureDirectory, "Bad.cjs"), "exports = { value: 1 };\n");
      const result = spawnSync(vp, ["lint", "Bad.cjs"], { cwd: fixtureDirectory, encoding: "utf8" });
      expect(result.status).not.toBe(0);
      expect(result.stdout + result.stderr).toContain("node(no-exports-assign)");
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });

  it("reports Vue and Tailwind diagnostics together in script-side markup", async () => {
    const fixtureDirectory = await mkdtemp(path.join(repositoryDirectory, "vue-tailwind-fixture-"));
    try {
      await writeFile(
        path.join(fixtureDirectory, "vite.config.ts"),
        `import { defineConfig } from "vite-plus";\nimport { vueLintPreset } from "../packages/oxlint-config-vue/index.js";\nimport { tailwindLintPreset } from "../packages/oxlint-config-react/index.js";\nconst vue = vueLintPreset();\nconst tailwind = tailwindLintPreset({ entryPoint: "styles.css" });\nexport default defineConfig({ lint: { ...vue, plugins: [...(vue.plugins ?? []), ...(tailwind.plugins ?? [])], jsPlugins: [...(vue.jsPlugins ?? []), ...(tailwind.jsPlugins ?? [])], rules: { ...vue.rules, ...tailwind.rules }, settings: { ...vue.settings, ...tailwind.settings } } });\n`
      );
      await writeFile(path.join(fixtureDirectory, "styles.css"), '@import "tailwindcss";\n');
      await writeFile(
        path.join(fixtureDirectory, "Bad.vue"),
        '<template><div v-for="item in items">{{ item }}</div></template>\n<script setup lang="ts">const items = [1]; const className = "madeuputility";</script>\n'
      );
      const result = spawnSync(vp, ["lint", "Bad.vue"], { cwd: fixtureDirectory, encoding: "utf8" });
      expect(result.status).not.toBe(0);
      expect(result.stdout + result.stderr).toContain("vize(vue/require-v-for-key)");
      expect(result.stdout + result.stderr).toContain("tailwindcss(no-unknown-classes)");
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });

  it("reports an unknown Tailwind class through the opt-in CSS profile", async () => {
    const fixtureDirectory = await mkdtemp(path.join(repositoryDirectory, "tailwind-fixture-"));
    try {
      await writeFile(
        path.join(fixtureDirectory, "vite.config.ts"),
        `import { defineConfig } from "vite-plus";\nimport { tailwindLintPreset } from "../packages/oxlint-config-react/index.js";\nexport default defineConfig({ lint: tailwindLintPreset({ entryPoint: "styles.css" }) });\n`
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

  it("lists lint presets as separate packages in the root README", async () => {
    const readme = await readFile(path.join(repositoryDirectory, "README.md"), "utf8");
    expect(readme).not.toMatch(/torus-scripts[^\n]*build, lint, and format presets/);
    for (const name of ["typescript", "react", "vue", "node"]) {
      expect(readme).toContain(`@toruslabs/oxlint-config-${name}`);
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
    expect(workflow).not.toContain("cache: npm");
    expect(workflow.indexOf("Install npm 12")).toBeLessThan(workflow.indexOf("npm ci"));
    expect(workflow).toContain("harden check --package-manager npm");
    expect(workflow).toContain("npm run check");
    expect(workflow).toContain("npm run typecheck");
    expect(workflow).toContain("npm run test");
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain("npm pack --workspaces --dry-run");
    expect(workflow).toContain("-- packages/");
    expect(workflow).not.toContain("changeset publish");
  });

  it("scans JavaScript and TypeScript with CodeQL and Semgrep without tokens", async () => {
    const workflow = await readFile(path.join(repositoryDirectory, ".github/workflows/security-code-scanner.yml"), "utf8");
    expect(workflow).not.toContain("github/codeql-action/");
    expect(workflow).toContain("setuptools<81");
    expect(workflow).toContain("semgrep scan");
    expect(workflow).toMatch(/semgrep scan[^\n]*\s\.(?:\s|$)/m);
    expect(workflow).not.toMatch(/semgrep scan[^\n]*\spackages(?:\s|$)/m);
    for (const generated of ["node_modules", "dist", "build", "coverage"]) {
      expect(workflow).toContain(`--exclude '**/${generated}/**'`);
    }
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

  it("publishes four independent lint packages with a TypeScript base", async () => {
    const scripts = JSON.parse(await readFile(path.join(packageDirectory, "package.json"), "utf8"));
    expect(scripts.exports).not.toHaveProperty("./lint");
    expect(scripts.exports).not.toHaveProperty("./vue-lint");
    expect(scripts.exports).toHaveProperty("./fmt");
    expect(scripts.peerDependencies).not.toHaveProperty("oxlint-plugin-vize");
    for (const name of ["typescript", "react", "vue", "node"]) {
      const manifest = JSON.parse(await readFile(path.join(repositoryDirectory, `packages/oxlint-config-${name}/package.json`), "utf8"));
      expect(manifest.private).not.toBe(true);
      expect(manifest.exports["."].import).toBe("./dist/index.mjs");
      expect(manifest.exports["."].types).toBe("./dist/index.d.mts");
      expect(manifest.peerDependencies).toHaveProperty("vite-plus");
      expect(Boolean(manifest.dependencies?.["@toruslabs/oxlint-config-typescript"])).toBe(name !== "typescript");
      expect(Boolean(manifest.peerDependencies?.["oxlint-plugin-vize"])).toBe(name === "vue");
      expect(manifest.peerDependenciesMeta?.["oxlint-plugin-vize"]?.optional).not.toBe(true);
    }
  });

  it("type-checks all five source projects without publishing their local configs", async () => {
    const root = JSON.parse(await readFile(path.join(repositoryDirectory, "package.json"), "utf8"));
    const names = ["torus-scripts", "oxlint-config-typescript", "oxlint-config-react", "oxlint-config-vue", "oxlint-config-node"];
    for (const name of names) {
      const packagePath = path.join(repositoryDirectory, `packages/${name}`);
      const config = JSON.parse(await readFile(path.join(packagePath, "tsconfig.json"), "utf8"));
      const manifest = JSON.parse(await readFile(path.join(packagePath, "package.json"), "utf8"));
      expect(config.extends).toBe(`../config/tsconfig.${name === "torus-scripts" ? "node" : "library"}.json`);
      expect(config.include).toContain(name === "torus-scripts" ? "src/**/*.ts" : "index.ts");
      expect(manifest.files).not.toContain("tsconfig.json");
      expect(root.scripts.typecheck).toContain(`tsc --noEmit -p packages/${name}/tsconfig.json`);
    }
  });

  it("builds workspaces recursively in dependency order", async () => {
    const root = JSON.parse(await readFile(path.join(repositoryDirectory, "package.json"), "utf8"));
    expect(root.scripts.build).toBe("vp run -r build --fail-if-no-match");
    for (const name of ["typescript", "react", "vue", "node"]) {
      const manifest = JSON.parse(await readFile(path.join(repositoryDirectory, `packages/oxlint-config-${name}/package.json`), "utf8"));
      expect(manifest.scripts?.build).toBe("vp pack");
      expect(Boolean(manifest.dependencies?.["@toruslabs/oxlint-config-typescript"])).toBe(name !== "typescript");
    }
  });

  it("resolves every published lint entry from installed workspaces", async () => {
    for (const [name, exportName] of [
      ["typescript", "typescriptLintPreset"],
      ["react", "reactLintPreset"],
      ["vue", "vueLintPreset"],
      ["node", "nodeLintPreset"],
    ]) {
      const entry = await import(`@toruslabs/oxlint-config-${name}`);
      expect(entry[exportName]).toBeTypeOf("function");
    }
  });

  it("imports and type-checks installed lint tarballs", async () => {
    const fixtureDirectory = await mkdtemp(path.join(tmpdir(), "lint-tarball-install-"));
    try {
      const tarballs: string[] = [];
      for (const name of ["typescript", "react", "vue", "node"]) {
        const packed = spawnSync("npm", ["pack", "--json", "--pack-destination", fixtureDirectory], {
          cwd: path.join(repositoryDirectory, `packages/oxlint-config-${name}`),
          encoding: "utf8",
        });
        expect(packed.stderr + packed.stdout).not.toContain("npm error");
        expect(packed.status).toBe(0);
        tarballs.push(path.join(fixtureDirectory, (Object.values(JSON.parse(packed.stdout)) as { filename: string }[])[0].filename));
      }
      const install = spawnSync(
        "npm",
        ["install", "--ignore-scripts", "--no-audit", "--no-fund", "vite-plus@1.4.0", "typescript@7.0.2", "oxlint-plugin-vize@0.485.0", ...tarballs],
        {
          cwd: fixtureDirectory,
          encoding: "utf8",
        }
      );
      expect(install.stderr).not.toContain("npm error");
      expect(install.status).toBe(0);
      const names = ["typescript", "react", "vue", "node"];
      const exports = ["typescriptLintPreset", "reactLintPreset", "vueLintPreset", "nodeLintPreset"];
      await writeFile(
        path.join(fixtureDirectory, "consumer.mjs"),
        names
          .map(
            (name, i) =>
              `import { ${exports[i]} } from "@toruslabs/oxlint-config-${name}";\nif (typeof ${exports[i]} !== "function") throw new Error("Missing ${name} preset");`
          )
          .join("\n")
      );
      const runtime = spawnSync("node", ["consumer.mjs"], { cwd: fixtureDirectory, encoding: "utf8" });
      expect(runtime.stderr).toBe("");
      expect(runtime.status).toBe(0);
      for (const name of names) {
        const declaration = await readFile(path.join(fixtureDirectory, `node_modules/@toruslabs/oxlint-config-${name}/dist/index.d.mts`), "utf8");
        expect(declaration).toContain(`${name}LintPreset`);
      }
      await writeFile(
        path.join(fixtureDirectory, "consumer.mts"),
        names
          .map(
            (name, i) =>
              `import { ${exports[i]} } from "@toruslabs/oxlint-config-${name}";\nconst ${name}Rules: import("vite-plus/lint").OxlintConfig = ${exports[i]}();\nvoid ${name}Rules;`
          )
          .join("\n")
      );
      const typecheck = spawnSync(
        path.join(repositoryDirectory, "node_modules/.bin/tsc"),
        ["--noEmit", "--strict", "--module", "nodenext", "--moduleResolution", "nodenext", "--target", "es2022", "--skipLibCheck", "consumer.mts"],
        {
          cwd: fixtureDirectory,
          encoding: "utf8",
        }
      );
      expect(typecheck.stdout + typecheck.stderr).toBe("");
      expect(typecheck.status).toBe(0);
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  }, 30_000);

  it("adds only framework-specific plugins to the TypeScript base", () => {
    const base = typescriptLintPreset();
    expect(reactLintPreset().plugins).toEqual([...(base.plugins ?? []), "react", "jsx-a11y"]);
    expect(nodeLintPreset().plugins).toEqual([...(base.plugins ?? []), "node"]);
    expect(vueLintPreset().plugins).toContain("vue");
    expect(reactLintPreset().rules).toHaveProperty("react/rules-of-hooks");
    expect(nodeLintPreset().rules).toHaveProperty("node/no-exports-assign");
    expect(vueLintPreset().rules).toHaveProperty("vize/vue/require-v-for-key");
  });

  it("rejects a blank Tailwind entry point", () => {
    expect(() => tailwindLintPreset({ entryPoint: "   " })).toThrow("Tailwind lint requires a CSS entry point");
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
