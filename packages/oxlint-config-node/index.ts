import { typescriptLintPreset } from "@toruslabs/oxlint-config-typescript";
import type { OxlintConfig } from "vite-plus/lint";

export function nodeLintPreset(): OxlintConfig {
  const base = typescriptLintPreset();
  return {
    ...base,
    plugins: [...(base.plugins ?? []), "node"],
    rules: { ...base.rules, "node/no-exports-assign": "error" },
  };
}
