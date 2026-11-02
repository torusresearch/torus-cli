import { expect, it } from "vitest";

import { runVp, viteLintConfig, withFixture } from "../../test/lint-fixture.js";
import { typescriptLintPreset } from "./index.js";

it("provides JS and TS unused-variable checks without framework plugins", () => {
  const config = typescriptLintPreset();
  expect(config.plugins).toContain("typescript");
  expect(config.plugins).not.toEqual(expect.arrayContaining(["react", "jsx-a11y", "vue", "node"]));
  expect(config.rules).toHaveProperty("no-unused-vars");
  expect(config.jsPlugins).toBeUndefined();
});

it("lints consumer source types and test fixtures", async () => {
  const files = {
    "vite.config.ts": viteLintConfig(
      'import { typescriptLintPreset } from "../packages/oxlint-config-typescript/index.js";',
      "typescriptLintPreset()"
    ),
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
