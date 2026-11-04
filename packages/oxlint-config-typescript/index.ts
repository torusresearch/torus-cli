import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import type { OxlintConfig } from "vite-plus/lint";

const require = createRequire(import.meta.url);

/** Shared native Oxlint checks for JavaScript and TypeScript source. */
export function typescriptLintPreset(): OxlintConfig {
  return {
    plugins: ["eslint", "typescript", "unicorn", "oxc", "import", "promise", "vitest"],
    jsPlugins: [
      { name: "torus", specifier: fileURLToPath(new URL("./torus-plugin.mjs", import.meta.url)) },
      { name: "tsdoc", specifier: require.resolve("eslint-plugin-tsdoc") },
      { name: "simple-import-sort", specifier: require.resolve("eslint-plugin-simple-import-sort") },
    ],
    ignorePatterns: ["**/node_modules/**", "**/coverage/**", "**/build/**", "**/dist/**", "**/examples/**"],
    rules: {
      "no-console": "error",
      "no-dupe-class-members": "error",
      "no-useless-constructor": "error",
      "no-unused-vars": ["error", { args: "after-used", argsIgnorePattern: "_" }],
      "promise/always-return": "warn",
      "torus/type-names": "error",
      "torus/member-ordering": "warn",
      "tsdoc/syntax": "warn",
      "simple-import-sort/exports": "error",
    },
  };
}
