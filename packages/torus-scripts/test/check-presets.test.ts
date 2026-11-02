import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { OxlintConfig } from "vite-plus/lint";
import { describe, expect, it } from "vite-plus/test";

import { parsePackResult, repositoryDirectory, runVp, viteLintConfig, withFixture } from "../../../test/lint-fixture.js";
import { nodeLintPreset } from "../../oxlint-config-node/index.js";
import { reactLintPreset, tailwindLintPreset } from "../../oxlint-config-react/index.js";
import { typescriptLintPreset } from "../../oxlint-config-typescript/index.js";
import { tailwindLintPreset as vueTailwindLintPreset, vueLintPreset, vueTemplateRules } from "../../oxlint-config-vue/index.js";
import { formatPreset } from "../src/presets/fmt.js";

const packageDirectory = path.resolve(import.meta.dirname, "..");
const vueConfig = viteLintConfig('import { vueLintPreset } from "../packages/oxlint-config-vue/index.js";', "vueLintPreset()");

function vueFile(template: string, script = ""): string {
  return `<template>${template}</template>\n<script setup lang="ts">\n${script}\n</script>\n`;
}

const vueTemplateFixtures: Record<keyof typeof vueTemplateRules, string> = {
  "vize/vue/no-duplicate-attributes": vueFile('<div class="a" class="b"></div>'),
  "vize/vue/no-mutating-props": vueFile('<button @click="props.count = 1">x</button>', "const props = defineProps<{ count: number }>();"),
  "vize/vue/no-use-v-if-with-v-for": vueFile('<div v-for="item in items" v-if="item" :key="item">{{ item }}</div>', "const items = [1];"),
  "vize/vue/require-v-for-key": vueFile('<div v-for="item in items">{{ item }}</div>', "const items = [1];"),
  "vize/vue/valid-v-for": vueFile('<div v-for="item" :key="item">x</div>'),
  "vize/vue/valid-v-if": vueFile("<div v-if>x</div>"),
  "vize/vue/valid-v-model": vueFile('<input v-model="1 + 1" />'),
  "vize/vue/valid-v-on": vueFile('<div v-on:click.badmod="go">x</div>', "function go() {}"),
};

function jsPluginNames(config: OxlintConfig): string[] {
  return (config.jsPlugins ?? []).map((plugin) => (typeof plugin === "string" ? plugin : plugin.name));
}

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
    expect(config.rules).toMatchObject({ "no-console": "error", "promise/always-return": expect.anything() });
  });

  it("keeps Vue and Tailwind integrations opt-in and tied to consumer settings", () => {
    const vue = vueLintPreset();
    const tailwind = tailwindLintPreset({ entryPoint: "src/styles.css" });
    expect(vueTailwindLintPreset({ entryPoint: "src/styles.css" })).toEqual(tailwind);
    expect(tailwind.plugins).toBeUndefined();
    expect(tailwind.rules).not.toHaveProperty("no-unused-vars");
    expect(jsPluginNames(vue)).toEqual([...jsPluginNames(typescriptLintPreset()), "oxlint-plugin-vize"]);
    expect(vue.jsPlugins).not.toContain("oxlint-tailwindcss");
    expect(jsPluginNames(reactLintPreset())).toEqual(jsPluginNames(typescriptLintPreset()));
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
    expect(JSON.stringify(config.jsPlugins)).not.toMatch(/tailwind|vize|eslint-plugin-n/);
    expect(config.settings?.tailwindcss).toBeUndefined();
  });

  it("enables only the Vize rules that fixtures prove", () => {
    const vizeRules = Object.entries(vueLintPreset().rules ?? {}).filter(([rule]) => rule.startsWith("vize/"));
    expect(Object.fromEntries(vizeRules)).toEqual(vueTemplateRules);
    expect(Object.keys(vueTemplateFixtures).sort()).toEqual(Object.keys(vueTemplateRules).sort());
  });

  it.each(Object.entries(vueTemplateFixtures))("reports %s through the Vue preset", async (rule, source) => {
    await withFixture("vue-template-rule", { "vite.config.ts": vueConfig, "Bad.vue": source }, (directory) => {
      const result = runVp(["lint", "--format", "json", "Bad.vue"], directory);
      const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: { code: string }[] };
      expect(diagnostics.map(({ code }) => code)).toContain(`vize(${rule.slice("vize/".length)})`);
    });
  });

  it("reports unused arguments and caught errors in Vue project TypeScript files", async () => {
    const files = {
      "vite.config.ts": vueConfig,
      "Bad.ts": "function use(unused: number, _ignored: number) { return 1; }\nuse(1, 2);\ntry { throw Error(); } catch (caught) {}\n",
    };
    await withFixture("vue-unused-vars", files, (directory) => {
      const result = runVp(["lint", "--format", "json", "Bad.ts"], directory);
      const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: { code: string; message: string }[] };
      const unused = diagnostics.filter(({ code }) => code.includes("no-unused-vars")).map(({ message }) => message);
      expect(result.status).not.toBe(0);
      expect(unused.join("\n")).toContain("unused");
      expect(unused.join("\n")).toContain("caught");
      expect(unused.join("\n")).not.toContain("_ignored");
    });
  });

  it("does not claim native unused-variable coverage in Vue script blocks", async () => {
    const files = { "vite.config.ts": vueConfig, "Bad.vue": vueFile("<div />", "const unusedValue = 1;") };
    await withFixture("vue-script-unused-gap", files, (directory) => {
      const result = runVp(["lint", "--format", "json", "Bad.vue"], directory);
      const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: { code: string }[] };
      expect(diagnostics.map(({ code }) => code)).not.toContain("eslint(no-unused-vars)");
    });
  });

  it("skips template-only Vue files, so they need a separate task", async () => {
    const files = { "vite.config.ts": vueConfig, "TemplateOnly.vue": '<template><div v-for="item in items">{{ item }}</div></template>\n' };
    await withFixture("vue-template-only", files, (directory) => {
      const result = runVp(["lint", "TemplateOnly.vue"], directory);
      expect(result.output).not.toContain("vize(vue/require-v-for-key)");
    });
  });

  it("reports React and JSX diagnostics with the React preset", async () => {
    const files = {
      "vite.config.ts": viteLintConfig('import { reactLintPreset } from "../packages/oxlint-config-react/index.js";', "reactLintPreset()"),
      "Bad.jsx": "export function Bad() { if (true) { useState(0); } return <div />; }\n",
    };
    await withFixture("react-lint", files, (directory) => {
      const result = runVp(["lint", "Bad.jsx"], directory);
      expect(result.status).not.toBe(0);
      expect(result.output).toContain("react-hooks(rules-of-hooks)");
    });
  });

  it("reports Node diagnostics with the Node preset", async () => {
    const files = {
      "vite.config.ts": viteLintConfig('import { nodeLintPreset } from "../packages/oxlint-config-node/index.js";', "nodeLintPreset()"),
      "Bad.cjs": "exports = { value: 1 };\n",
      "Syntax.ts": "export const kawi = /\\p{Script=Kawi}/u;\n",
    };
    await withFixture("node-lint", files, (directory) => {
      const result = runVp(["lint", "Bad.cjs"], directory);
      expect(result.status).not.toBe(0);
      expect(result.output).toContain("node(no-exports-assign)");
      const syntax = runVp(["lint", "Syntax.ts"], directory);
      expect(syntax.status).not.toBe(0);
      expect(syntax.output).toContain("n(no-unsupported-features/es-syntax)");
    });
  });

  it("reports Vue and Tailwind diagnostics together in script-side markup", async () => {
    const files = {
      "vite.config.ts": viteLintConfig(
        'import { vueLintPreset, tailwindLintPreset } from "../packages/oxlint-config-vue/index.js";\nconst vue = vueLintPreset();\nconst tailwind = tailwindLintPreset({ entryPoint: "styles.css" });',
        "{ ...vue, plugins: [...(vue.plugins ?? []), ...(tailwind.plugins ?? [])], jsPlugins: [...(vue.jsPlugins ?? []), ...(tailwind.jsPlugins ?? [])], rules: { ...vue.rules, ...tailwind.rules }, settings: { ...vue.settings, ...tailwind.settings } }"
      ),
      "styles.css": '@import "tailwindcss";\n',
      "Bad.vue": vueFile('<div v-for="item in items">{{ item }}</div>', 'const items = [1]; const className = "madeuputility";'),
    };
    await withFixture("vue-tailwind-lint", files, (directory) => {
      const result = runVp(["lint", "Bad.vue"], directory);
      expect(result.status).not.toBe(0);
      expect(result.output).toContain("vize(vue/require-v-for-key)");
      expect(result.output).toContain("tailwindcss(no-unknown-classes)");
    });
  }, 30_000);

  it("reports an unknown Tailwind class through the opt-in CSS profile", async () => {
    const files = {
      "vite.config.ts": viteLintConfig(
        'import { tailwindLintPreset } from "../packages/oxlint-config-react/index.js";',
        'tailwindLintPreset({ entryPoint: "styles.css" })'
      ),
      "styles.css": '@import "tailwindcss";\n',
      "Bad.tsx": 'export const View = () => <div className="madeuputility" />;\n',
    };
    await withFixture("tailwind-lint", files, (directory) => {
      const result = runVp(["lint", "Bad.tsx"], directory);
      expect(result.status).not.toBe(0);
      expect(result.output).toContain("tailwindcss(no-unknown-classes)");
    });
  });

  it("lists lint presets as separate packages in the root README", async () => {
    const readme = await readFile(path.join(repositoryDirectory, "README.md"), "utf8");
    expect(readme).not.toMatch(/torus-scripts[^\n]*build, lint, and format presets/);
    for (const name of ["typescript", "react", "vue", "node"]) {
      expect(readme).toContain(`@toruslabs/oxlint-config-${name}`);
    }
  });

  it("removes the old CLI, ESLint packages, and unused Vize packages from workspace metadata", async () => {
    const root = JSON.parse(await readFile(path.join(repositoryDirectory, "package.json"), "utf8"));
    const manifest = JSON.parse(await readFile(path.join(packageDirectory, "package.json"), "utf8"));
    const changesets = JSON.parse(await readFile(path.join(repositoryDirectory, ".changeset/config.json"), "utf8"));
    expect(manifest.bin).toBeUndefined();
    expect(manifest.peerDependencies).not.toHaveProperty("eslint");
    expect(root.devDependencies).not.toHaveProperty("eslint");
    expect(root.devDependencies).not.toHaveProperty("@vizejs/vite-plugin");
    expect(root.devDependencies).not.toHaveProperty("vize");
    expect(root.devDependencies).toHaveProperty("oxlint-plugin-vize");
    expect(root.scripts["check:styles"]).toBe("vp fmt --check .");
    expect(changesets.ignore).toEqual([]);
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
    const manifest = JSON.parse(await readFile(path.join(packageDirectory, "package.json"), "utf8"));
    expect(manifest.exports).not.toHaveProperty("./lint");
    expect(manifest.exports).not.toHaveProperty("./vue-lint");
    expect(manifest.exports).toHaveProperty("./fmt");
    expect(manifest.peerDependencies).not.toHaveProperty("oxlint-plugin-vize");
    for (const name of ["typescript", "react", "vue", "node"]) {
      const lintManifest = JSON.parse(await readFile(path.join(repositoryDirectory, `packages/oxlint-config-${name}/package.json`), "utf8"));
      expect(lintManifest.private).not.toBe(true);
      expect(lintManifest.exports["."].import).toBe("./dist/index.mjs");
      expect(lintManifest.exports["."].types).toBe("./dist/index.d.mts");
      expect(lintManifest.peerDependencies).toHaveProperty("vite-plus");
      expect(Boolean(lintManifest.dependencies?.["@toruslabs/oxlint-config-typescript"])).toBe(name !== "typescript");
      expect(Boolean(lintManifest.peerDependencies?.["oxlint-plugin-vize"])).toBe(name === "vue");
      expect(lintManifest.peerDependenciesMeta?.["oxlint-plugin-vize"]?.optional).not.toBe(true);
    }
    for (const name of ["react", "vue"]) {
      const lintManifest = JSON.parse(await readFile(path.join(repositoryDirectory, `packages/oxlint-config-${name}/package.json`), "utf8"));
      expect(lintManifest.peerDependencies?.["oxlint-tailwindcss"]).toBe("^1.14.0");
      expect(lintManifest.peerDependenciesMeta?.["oxlint-tailwindcss"]?.optional).toBe(true);
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
        tarballs.push(path.join(fixtureDirectory, parsePackResult(packed.stdout).filename));
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
      await writeFile(
        path.join(fixtureDirectory, "vue-tailwind.mjs"),
        'import { tailwindLintPreset } from "@toruslabs/oxlint-config-vue";\nif (typeof tailwindLintPreset !== "function") throw new Error("Missing Vue Tailwind preset");\n'
      );
      const vueTailwindRuntime = spawnSync("node", ["vue-tailwind.mjs"], { cwd: fixtureDirectory, encoding: "utf8" });
      expect(vueTailwindRuntime.stderr).toBe("");
      expect(vueTailwindRuntime.status).toBe(0);
      const runtime = spawnSync("node", ["consumer.mjs"], { cwd: fixtureDirectory, encoding: "utf8" });
      expect(runtime.stderr).toBe("");
      expect(runtime.status).toBe(0);
      for (const name of names) {
        const declaration = await readFile(path.join(fixtureDirectory, `node_modules/@toruslabs/oxlint-config-${name}/dist/index.d.mts`), "utf8");
        expect(declaration).toContain(`${name}LintPreset`);
      }
      await writeFile(
        path.join(fixtureDirectory, "vue-tailwind.mts"),
        'import { tailwindLintPreset } from "@toruslabs/oxlint-config-vue";\nimport type { OxlintConfig } from "vite-plus/lint";\nconst vueTailwindRules: OxlintConfig = tailwindLintPreset({ entryPoint: "styles.css" });\nvoid vueTailwindRules;\n'
      );
      const vueTailwindDeclaration = await readFile(
        path.join(fixtureDirectory, "node_modules/@toruslabs/oxlint-config-vue/dist/index.d.mts"),
        "utf8"
      );
      expect(vueTailwindDeclaration).toContain("tailwindLintPreset");
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
        [
          "--noEmit",
          "--strict",
          "--module",
          "nodenext",
          "--moduleResolution",
          "nodenext",
          "--target",
          "es2022",
          "--skipLibCheck",
          "consumer.mts",
          "vue-tailwind.mts",
        ],
        {
          cwd: fixtureDirectory,
          encoding: "utf8",
        }
      );
      expect(typecheck.stdout + typecheck.stderr).toBe("");
      expect(typecheck.status).toBe(0);
      await writeFile(
        path.join(fixtureDirectory, "vite.config.mjs"),
        'import { defineConfig } from "vite-plus";\nimport { typescriptLintPreset } from "@toruslabs/oxlint-config-typescript";\nexport default defineConfig({ lint: typescriptLintPreset() });\n'
      );
      await writeFile(path.join(fixtureDirectory, "Bad.ts"), "type snake_case = number;\nconsole.warn(1);\n");
      const lint = runVp(["lint", "--format", "json", "Bad.ts"], fixtureDirectory);
      expect(lint.status).not.toBe(0);
      const { diagnostics } = JSON.parse(lint.stdout) as { diagnostics: { code: string }[] };
      expect(diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining(["torus(type-names)", "eslint(no-console)"]));
      await writeFile(
        path.join(fixtureDirectory, "vite.config.mjs"),
        'import { defineConfig } from "vite-plus";\nimport { nodeLintPreset } from "@toruslabs/oxlint-config-node";\nexport default defineConfig({ lint: nodeLintPreset() });\n'
      );
      await writeFile(path.join(fixtureDirectory, "Syntax.ts"), "export const kawi = /\\p{Script=Kawi}/u;\n");
      const nodeLint = runVp(["lint", "--format", "json", "Syntax.ts"], fixtureDirectory);
      expect(nodeLint.status).not.toBe(0);
      const nodeDiagnostics = JSON.parse(nodeLint.stdout) as { diagnostics: { code: string }[] };
      expect(nodeDiagnostics.diagnostics.map(({ code }) => code)).toContain("n(no-unsupported-features/es-syntax)");
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
    expect(jsPluginNames(nodeLintPreset())).toEqual([...jsPluginNames(base), "n"]);
    expect(nodeLintPreset().rules).toHaveProperty("n/no-unsupported-features/es-syntax", ["error", { version: ">=24", ignores: ["modules"] }]);
    expect(vueLintPreset().rules?.["no-unused-vars"]).toEqual([
      "error",
      {
        args: "all",
        argsIgnorePattern: "^_",
        caughtErrors: "all",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      },
    ]);
  });

  it("rejects a blank Tailwind entry point in React and Vue", () => {
    expect(() => tailwindLintPreset({ entryPoint: "   " })).toThrow("Tailwind lint requires a CSS entry point");
    expect(() => vueTailwindLintPreset({ entryPoint: "   " })).toThrow("Tailwind lint requires a CSS entry point");
  });

  it("rejects unused imports and variables in JavaScript and TypeScript", async () => {
    const files = {
      "unused.js": "const unusedValue = 1;\n",
      "unused.ts": "const unusedValue: number = 1;\n",
      "unused-import.js": 'import { readFile } from "node:fs/promises";\n',
    };
    await withFixture(
      "unused-vars",
      files,
      (directory) => {
        for (const file of Object.keys(files)) {
          const result = runVp(["lint", path.join(directory, file)], repositoryDirectory);
          expect(result.status).not.toBe(0);
          expect(result.output).toContain("no-unused-vars");
        }
        const checkResult = runVp(["check", path.join(directory, "unused.js")], repositoryDirectory);
        expect(checkResult.status).not.toBe(0);
        expect(checkResult.output).toContain("no-unused-vars");
      },
      tmpdir()
    );
  });

  it("confirms native sort-imports detects an unsorted JS fixture", async () => {
    const files = { "unsorted-imports.js": 'import { zeta } from "zeta";\nimport { alpha } from "alpha";\nvoid [zeta, alpha];\n' };
    await withFixture(
      "sort-imports",
      files,
      (directory) => {
        const result = runVp(["lint", path.join(directory, "unsorted-imports.js"), "--deny", "sort-imports"], repositoryDirectory);
        expect(result.status).not.toBe(0);
        expect(result.output).toContain("sort-imports");
      },
      tmpdir()
    );
  });

  it("rejects a formatter violation through vp check", async () => {
    await withFixture(
      "check-format",
      { "unformatted.js": "const value={answer:42}\nvoid value\n" },
      (directory) => {
        const result = runVp(["check", path.join(directory, "unformatted.js")], repositoryDirectory);
        expect(result.status).not.toBe(0);
        expect(result.output).toContain("Formatting issues found");
      },
      tmpdir()
    );
  });

  it("uses vp fmt --check for format and import-sort failures", async () => {
    const files = {
      "unformatted.js": "const value={answer:42}\nvoid value\n",
      "unsorted-imports.js": 'import { zeta } from "zeta";\nimport { alpha } from "alpha";\nvoid [zeta, alpha];\n',
    };
    await withFixture(
      "fmt-check",
      files,
      (directory) => {
        for (const file of Object.keys(files)) {
          const result = runVp(["fmt", "--check", path.join(directory, file)], repositoryDirectory);
          expect(result.status).not.toBe(0);
          expect(result.output).toContain("Format issues found");
        }
      },
      tmpdir()
    );
  });

  it("checks the root config from any workspace directory", () => {
    expect(runVp(["check", "src/presets"], packageDirectory).status).toBe(0);
  });
});
