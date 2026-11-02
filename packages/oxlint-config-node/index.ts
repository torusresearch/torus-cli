import { createRequire } from "node:module";

import { typescriptLintPreset } from "@toruslabs/oxlint-config-typescript";
import type { OxlintConfig } from "vite-plus/lint";

const require = createRequire(import.meta.url);

export function nodeLintPreset(): OxlintConfig {
  const base = typescriptLintPreset();
  return {
    ...base,
    plugins: [...(base.plugins ?? []), "node"],
    jsPlugins: [...(base.jsPlugins ?? []), { name: "n", specifier: require.resolve("eslint-plugin-n") }],
    rules: {
      ...base.rules,
      "node/no-exports-assign": "error",
      "n/no-unsupported-features/es-syntax": ["error", { version: ">=24", ignores: ["modules"] }],
    },
  };
}
