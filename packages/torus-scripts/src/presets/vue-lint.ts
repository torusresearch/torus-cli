import { createVizeLintConfig } from "oxlint-plugin-vize";
import type { OxlintConfig } from "vite-plus/lint";

import { lintPreset } from "./lint.js";

/** Vue lint requires an opt-in Vize installation in the consumer. */
export function vueLintPreset(): OxlintConfig {
  const base = lintPreset();
  const vize = createVizeLintConfig({ preset: "happy-path", plugins: base.plugins });
  return {
    ...base,
    plugins: vize.plugins,
    jsPlugins: vize.jsPlugins,
    rules: { ...base.rules, ...vize.rules },
    settings: vize.settings,
  };
}
