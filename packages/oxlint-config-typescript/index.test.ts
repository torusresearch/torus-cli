import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, it } from "vite-plus/test";

import { repositoryDirectory, runVp, viteLintConfig, withFixture } from "../../test/lint-fixture.js";
import { typescriptLintPreset } from "./index.js";
import tsdocPlugin from "./tsdoc-plugin.mjs";

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

it("applies custom tags from the nearest tsdoc.json", async () => {
  await withFixture(
    "typescript-tsdoc-config",
    {
      "package.json": '{ "name": "tsdoc-fixture" }\n',
      "tsdoc.json":
        '{ "$schema": "https://developer.microsoft.com/json-schemas/tsdoc/v0/tsdoc.schema.json", "tagDefinitions": [{ "tagName": "@unknownTag", "syntaxKind": "modifier" }] }\n',
      "vite.config.ts": presetConfig,
      "good.ts": "/** @unknownTag */\nexport const value = 1;\n",
    },
    (directory) => {
      const result = runVp(["lint", "--format", "json", "good.ts"], directory);
      expect(lintDiagnostics(result.stdout).join("\n")).not.toContain("tsdoc(syntax)");
      expect(result.status).toBe(0);
    }
  );
});

it("reports a tsdoc.json that fails to load", async () => {
  await withFixture(
    "typescript-tsdoc-config-error",
    {
      "package.json": '{ "name": "tsdoc-fixture" }\n',
      "tsdoc.json":
        '{ "$schema": "https://developer.microsoft.com/json-schemas/tsdoc/v0/tsdoc.schema.json", "tagDefinitions": [{ "tagName": "unknownTag", "syntaxKind": "modifier" }] }\n',
      "vite.config.ts": presetConfig,
      "good.ts": "export const value = 1;\n",
    },
    (directory) => {
      const result = runVp(["lint", "--format", "json", "good.ts"], directory);
      expect(lintDiagnostics(result.stdout).join("\n")).toContain("error loading TSDoc config file");
    }
  );
});

const tsdocSchema = "https://developer.microsoft.com/json-schemas/tsdoc/v0/tsdoc.schema.json";

function tsdocMessages(filename: string, source: string): string[] {
  const messages: string[] = [];
  const rule = tsdocPlugin.rules.syntax.create({
    filename,
    physicalFilename: filename,
    sourceCode: {
      text: source,
      getAllComments: () => [{ type: "Block", range: [0, source.indexOf("*/") + 2] }],
      getLocFromIndex: (offset: number) => ({ line: 1, column: offset }),
    },
    report: (diagnostic: { message: string }) => {
      messages.push(diagnostic.message);
    },
  });
  rule.Program();
  return messages;
}

it("reloads tsdoc.json after it changes in the same process", async () => {
  const source = "/** @unknownTag */\nexport const value = 1;\n";
  const directory = await mkdtemp(path.join(repositoryDirectory, "typescript-tsdoc-reload-"));
  const configPath = path.join(directory, "tsdoc.json");
  const sourcePath = path.join(directory, "good.ts");
  const defined = {
    $schema: tsdocSchema,
    tagDefinitions: [{ tagName: "@unknownTag", syntaxKind: "modifier" }],
  };

  try {
    await writeFile(path.join(directory, "package.json"), '{ "name": "tsdoc-fixture" }\n');
    await writeFile(configPath, `${JSON.stringify(defined)}\n`);
    expect(tsdocMessages(sourcePath, source).join("\n")).not.toContain("tsdoc-undefined-tag");

    await writeFile(configPath, `${JSON.stringify({ $schema: tsdocSchema })}\n`);
    await utimes(configPath, new Date(Date.now() + 1000), new Date(Date.now() + 1000));
    expect(tsdocMessages(sourcePath, source).join("\n")).toContain("tsdoc-undefined-tag");

    await rm(configPath);
    expect(tsdocMessages(sourcePath, source).join("\n")).toContain("tsdoc-undefined-tag");

    await writeFile(configPath, `${JSON.stringify(defined)}\n`);
    expect(tsdocMessages(sourcePath, source).join("\n")).not.toContain("tsdoc-undefined-tag");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("reports an unreadable tsdoc.json and loads it once the file is readable", async () => {
  const source = "/** @unknownTag */\nexport const value = 1;\n";
  const directory = await mkdtemp(path.join(repositoryDirectory, "typescript-tsdoc-unreadable-"));
  const configPath = path.join(directory, "tsdoc.json");
  const sourcePath = path.join(directory, "good.ts");
  const defined = {
    $schema: tsdocSchema,
    tagDefinitions: [{ tagName: "@unknownTag", syntaxKind: "modifier" }],
  };

  try {
    await writeFile(path.join(directory, "package.json"), '{ "name": "tsdoc-fixture" }\n');
    await mkdir(configPath);
    const failed = tsdocMessages(sourcePath, source).join("\n");
    expect(failed).toContain("error loading TSDoc config file");
    expect(failed).toContain("EISDIR");

    await rm(configPath, { recursive: true });
    await writeFile(configPath, `${JSON.stringify(defined)}\n`);
    await utimes(configPath, new Date(Date.now() + 1000), new Date(Date.now() + 1000));
    const recovered = tsdocMessages(sourcePath, source).join("\n");
    expect(recovered).not.toContain("error loading TSDoc config file");
    expect(recovered).not.toContain("tsdoc-undefined-tag");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

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
