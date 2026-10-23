import type { OxlintConfig } from "vite-plus/lint";

/** Common checks. Framework and CSS-specific plugins stay opt-in. */
export function lintPreset(): OxlintConfig {
  return {
    plugins: ["eslint", "typescript", "unicorn", "oxc", "import", "promise", "vitest", "react", "jsx-a11y", "node"],
    ignorePatterns: ["**/node_modules/**", "**/coverage/**", "**/build/**", "**/dist/**", "**/examples/**", "**/types/**", "**/test/fixtures/**"],
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
      "promise/always-return": "warn",
      "no-unused-vars": [
        "error",
        {
          args: "none",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
        },
      ],
    },
  };
}

export interface TailwindLintOptions {
  /** CSS file containing `@import "tailwindcss"`, relative to the consumer root. */
  entryPoint: string;
}

/** Merge this fragment into a Tailwind v4 consumer's root `lint` block. */
export function tailwindLintPreset({ entryPoint }: TailwindLintOptions): OxlintConfig {
  if (!entryPoint) throw new Error("Tailwind lint requires a CSS entry point");
  const base = lintPreset();
  return {
    ...base,
    jsPlugins: ["oxlint-tailwindcss"],
    settings: { tailwindcss: { entryPoint } },
    rules: {
      ...base.rules,
      "tailwindcss/no-conflicting-classes": "error",
      "tailwindcss/no-duplicate-classes": "warn",
      "tailwindcss/no-unknown-classes": "error",
      "tailwindcss/no-deprecated-classes": "error",
    },
  };
}
