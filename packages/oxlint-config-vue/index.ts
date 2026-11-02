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

export interface TailwindLintOptions {
  /** CSS file containing `@import "tailwindcss"`, relative to the consumer root. */
  entryPoint: string;
}

/** Independent fragment for Vue consumers of Tailwind v4. */
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
