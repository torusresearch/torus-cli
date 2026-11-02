import { typescriptLintPreset } from "@toruslabs/oxlint-config-typescript";
import type { OxlintConfig } from "vite-plus/lint";

export function reactLintPreset(): OxlintConfig {
  const base = typescriptLintPreset();
  return {
    ...base,
    plugins: [...(base.plugins ?? []), "react", "jsx-a11y"],
    rules: {
      ...base.rules,
      "react/rules-of-hooks": "error",
      "react/exhaustive-deps": "warn",
    },
  };
}

export interface TailwindLintOptions {
  /** CSS file containing `@import "tailwindcss"`, relative to the consumer root. */
  entryPoint: string;
}

/**
 * Independent fragment for React consumers of Tailwind v4.
 *
 * Merge each field into the React preset. A plain `{ ...reactLintPreset(), ...tailwindLintPreset() }`
 * replaces `jsPlugins`, `rules`, and `settings`, so the React Hooks rules disappear.
 *
 * @example
 * ```ts
 * const react = reactLintPreset();
 * const tailwind = tailwindLintPreset({ entryPoint: "src/styles.css" });
 * const lint = {
 *   ...react,
 *   jsPlugins: [...(react.jsPlugins ?? []), ...(tailwind.jsPlugins ?? [])],
 *   rules: { ...react.rules, ...tailwind.rules },
 *   settings: { ...react.settings, ...tailwind.settings },
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
