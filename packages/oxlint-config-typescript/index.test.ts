import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, it } from "vite-plus/test";

import { repositoryDirectory, runVp, viteLintConfig, withFixture } from "../../test/lint-fixture.js";
import { typescriptLintPreset } from "./index.js";

const presetConfig = viteLintConfig(
  'import { typescriptLintPreset } from "../packages/oxlint-config-typescript/index.js";',
  "typescriptLintPreset()"
);

function lintDiagnostics(stdout: string): string[] {
  const { diagnostics } = JSON.parse(stdout) as { diagnostics: { code: string; message: string }[] };
  return diagnostics.map(({ code, message }) => `${code}: ${message}`);
}

it("provides JS and TS unused-variable checks without framework plugins", () => {
  const config = typescriptLintPreset();
  expect(config.plugins).toContain("typescript");
  expect(config.plugins).not.toEqual(expect.arrayContaining(["react", "jsx-a11y", "vue", "node"]));
  expect(config.rules).toHaveProperty("no-unused-vars");
  expect(config.jsPlugins?.map((plugin) => (typeof plugin === "string" ? plugin : plugin.name))).toEqual(["torus", "tsdoc", "simple-import-sort"]);
});

it("lints consumer source types and test fixtures", async () => {
  const files = {
    "vite.config.ts": presetConfig,
    "src/types/bad.ts": "const unusedValue = 1;\n",
    "test/fixtures/bad.ts": "const unusedValue = 1;\n",
  };
  await withFixture("typescript-lint-paths", files, (directory) => {
    for (const file of ["src/types/bad.ts", "test/fixtures/bad.ts"]) {
      const result = runVp(["lint", file], directory);
      expect(result.output).toContain("no-unused-vars");
      expect(result.status).not.toBe(0);
    }
  });
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
    const result = runVp(["lint", "--format", "json", "bad.ts"], fixtureDirectory);
    const output = lintDiagnostics(result.stdout).join("\n");
    expect(result.status).not.toBe(0);
    for (const diagnostic of [
      "torus(type-names): Type Alias name `snake_case` must match one of the following formats: camelCase, UPPER_CASE, PascalCase",
      "torus(type-names): Type Parameter name `_T`",
      "torus(member-ordering): Member field should be declared before all public constructor definitions.",
      "tsdoc(syntax)",
      "simple-import-sort(exports)",
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

it("reports duplicate class members when the source parses", async () => {
  await withFixture(
    "typescript-duplicate-member",
    {
      "vite.config.ts": presetConfig,
      "bad.js": "class Duplicate { method() {} method() {} }\nexport { Duplicate };\n",
    },
    (directory) => {
      const result = runVp(["lint", "--format", "json", "bad.js"], directory);
      const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: { code: string; message: string }[] };
      expect(result.status).not.toBe(0);
      expect(diagnostics.map(({ code }) => code)).toContain("eslint(no-dupe-class-members)");
    }
  );
});

it("accepts valid type names and member order", async () => {
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
    const result = runVp(["lint", "--format", "json", "good.test.ts"], fixtureDirectory);
    expect(lintDiagnostics(result.stdout)).toEqual([]);
    expect(result.status).toBe(0);
  } finally {
    await rm(fixtureDirectory, { recursive: true, force: true });
  }
}, 30_000);
