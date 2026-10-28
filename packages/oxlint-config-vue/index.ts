import { typescriptLintPreset } from "@toruslabs/oxlint-config-typescript";
import { createVizeLintConfig } from "oxlint-plugin-vize";
import type { OxlintConfig } from "vite-plus/lint";

export function vueLintPreset(): OxlintConfig {
  const base = typescriptLintPreset();
  const vize = createVizeLintConfig({ preset: "happy-path", plugins: [...(base.plugins ?? []), "vue"] });
  return {
    ...base,
    plugins: vize.plugins,
    jsPlugins: vize.jsPlugins,
    rules: { ...base.rules, ...vize.rules },
    settings: { ...base.settings, ...vize.settings },
  };
}
