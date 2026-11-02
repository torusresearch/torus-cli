import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, it } from "vite-plus/test";

import { typescriptLintPreset } from "./index.js";

const repositoryDirectory = path.resolve(import.meta.dirname, "../..");
const vp = path.join(repositoryDirectory, "node_modules", ".bin", "vp");
const presetConfig =
  'import { defineConfig } from "vite-plus";\nimport { typescriptLintPreset } from "../packages/oxlint-config-typescript/index.js";\nexport default defineConfig({ lint: typescriptLintPreset() });\n';

it("provides JS and TS unused-variable checks without framework plugins", () => {
  const config = typescriptLintPreset();
  expect(config.plugins).toContain("typescript");
  expect(config.plugins).not.toEqual(expect.arrayContaining(["react", "jsx-a11y", "vue", "node"]));
  expect(config.rules).toHaveProperty("no-unused-vars");
  expect(config.jsPlugins?.map((plugin) => (typeof plugin === "string" ? plugin : plugin.name))).toEqual([
    "torus",
    "tsdoc",
    "simple-import-sort",
    "import-js",
  ]);
});

it("lints consumer source types and test fixtures", async () => {
  const fixtureDirectory = await mkdtemp(path.join(repositoryDirectory, "oxlint-paths-"));

  try {
    await writeFile(path.join(fixtureDirectory, "vite.config.ts"), presetConfig);
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

it("reports each restored custom rule", async () => {
  const fixtureDirectory = await mkdtemp(path.join(repositoryDirectory, "oxlint-custom-"));

  try {
    await writeFile(path.join(fixtureDirectory, "vite.config.ts"), presetConfig);
    await writeFile(
      path.join(fixtureDirectory, "bad.ts"),
      [
        'import tailwind from "oxlint-tailwindcss";',
        "",
        "type snake_case = { value: number };",
        "",
        "export class Thing<_T> {",
        "  constructor() {}",
        "  run(): void {}",
        "  public field = 1;",
        "}",
        "",
        "/**",
        " * Has an @unknownTag.",
        " */",
        "export function call(used: string, unusedAfter: number): snake_case {",
        "  console.warn(used, tailwind);",
        "  return { value: 1 };",
        "}",
        "",
        "export function keep(unusedBefore: number, used: string): string {",
        "  return used;",
        "}",
        "",
        "const b = 1;",
        "const a = 2;",
        "export { b, a };",
        "",
      ].join("\n")
    );
    const result = spawnSync(vp, ["lint", "bad.ts"], { cwd: fixtureDirectory, encoding: "utf8" });
    const output = result.stdout + result.stderr;
    expect(result.status).not.toBe(0);
    for (const diagnostic of [
      "torus(type-names): Type Alias name `snake_case` must match one of the following formats: camelCase, UPPER_CASE, PascalCase",
      "torus(type-names): Type Parameter name `_T`",
      "torus(member-ordering): Member field should be declared before all public constructor definitions.",
      "tsdoc(syntax)",
      "simple-import-sort(exports)",
      "import-js(no-extraneous-dependencies): 'oxlint-tailwindcss' should be listed in the project's dependencies, not devDependencies.",
      "eslint(no-console)",
      "eslint(no-useless-constructor)",
      "Parameter 'unusedAfter' is declared but never used.",
    ]) {
      expect(output).toContain(diagnostic);
    }
    expect(output).not.toContain("'unusedBefore'");
  } finally {
    await rm(fixtureDirectory, { recursive: true, force: true });
  }
}, 30_000);

it("accepts valid type names, member order, and test-only dev dependencies", async () => {
  const fixtureDirectory = await mkdtemp(path.join(repositoryDirectory, "oxlint-custom-ok-"));

  try {
    await writeFile(path.join(fixtureDirectory, "vite.config.ts"), presetConfig);
    await writeFile(
      path.join(fixtureDirectory, "good.test.ts"),
      [
        'import tailwind from "oxlint-tailwindcss";',
        "",
        "interface Shape {",
        "  [key: string]: unknown;",
        "  size: number;",
        "  area(): number;",
        "}",
        "type camelType = { value: number };",
        "enum HTTP_STATUS {",
        "  Ok = 200,",
        "}",
        "",
        "class Box<TValue> {",
        "  static count = 0;",
        '  protected label = "box";',
        "  #secret = 1;",
        "  constructor(readonly value: TValue) {}",
        "  get size(): number {",
        "    return this.#secret;",
        "  }",
        "  static create(): Box<number> {",
        "    return new Box(1);",
        "  }",
        "  read(): TValue {",
        "    return this.value;",
        "  }",
        "}",
        "",
        "const shape: Shape = { size: 1, area: () => 1 };",
        "const value: camelType = { value: HTTP_STATUS.Ok };",
        "export const values = [tailwind, shape, value, Box.create().read()];",
        "",
      ].join("\n")
    );
    const result = spawnSync(vp, ["lint", "good.test.ts"], { cwd: fixtureDirectory, encoding: "utf8" });
    expect(result.stdout + result.stderr).not.toMatch(/torus\(|import-js\(|tsdoc\(|simple-import-sort\(/);
    expect(result.status).toBe(0);
  } finally {
    await rm(fixtureDirectory, { recursive: true, force: true });
  }
}, 30_000);
