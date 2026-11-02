import { typescriptLintPreset } from "@toruslabs/oxlint-config-typescript";
import { createVizeLintConfig } from "oxlint-plugin-vize";
import type { OxlintConfig } from "vite-plus/lint";

/** Vize template rules that fixture tests prove through `vp lint`. Add a fixture before you add a rule. */
export const vueTemplateRules = {
  "vize/vue/no-duplicate-attributes": "error",
  "vize/vue/no-mutating-props": "error",
  "vize/vue/no-use-v-if-with-v-for": "warn",
  "vize/vue/require-v-for-key": "error",
  "vize/vue/valid-v-for": "error",
  "vize/vue/valid-v-if": "error",
  "vize/vue/valid-v-model": "error",
  "vize/vue/valid-v-on": "error",
} as const;

/**
 * Vue preset for `.vue` files that have a script block.
 *
 * `vp lint` and `vp check` can skip a `.vue` file with no script block, so template-only files need a separate task.
 */
export function vueLintPreset(): OxlintConfig {
  const base = typescriptLintPreset();
  const vize = createVizeLintConfig({ preset: "incremental", plugins: [...(base.plugins ?? []), "vue"], rules: vueTemplateRules });
  return {
    ...base,
    plugins: vize.plugins,
    jsPlugins: vize.jsPlugins,
    rules: { ...base.rules, ...vize.rules },
    settings: { ...base.settings, ...vize.settings },
  };
}

export interface TailwindLintOptions {
  /** CSS file containing `@import "tailwindcss"`, relative to the consumer root. */
  entryPoint: string;
}

/**
 * Independent fragment for Vue consumers of Tailwind v4.
 *
 * Merge each field into the Vue preset. A plain `{ ...vueLintPreset(), ...tailwindLintPreset() }`
 * replaces `jsPlugins`, `rules`, and `settings`, so the Vize rules and `oxlint-plugin-vize` disappear.
 *
 * @example
 * ```ts
 * const vue = vueLintPreset();
 * const tailwind = tailwindLintPreset({ entryPoint: "src/styles.css" });
 * const lint = {
 *   ...vue,
 *   jsPlugins: [...(vue.jsPlugins ?? []), ...(tailwind.jsPlugins ?? [])],
 *   rules: { ...vue.rules, ...tailwind.rules },
 *   settings: { ...vue.settings, ...tailwind.settings },
 * };
 * ```
 */
export function tailwindLintPreset({ entryPoint }: TailwindLintOptions): OxlintConfig {
  if (!entryPoint.trim()) throw new Error("Tailwind lint requires a CSS entry point");
  return {
    jsPlugins: ["oxlint-tailwindcss"],
    settings: { tailwindcss: { entryPoint } },
    rules: {
      "tailwindcss/no-conflicting-classes": "error",
      "tailwindcss/no-duplicate-classes": "warn",
      "tailwindcss/no-unknown-classes": "error",
      "tailwindcss/no-deprecated-classes": "error",
    },
  };
}
