import type { OxlintConfig } from "vite-plus/lint";

/** Shared native Oxlint checks for JavaScript and TypeScript source. */
export function typescriptLintPreset(): OxlintConfig {
  return {
    plugins: ["eslint", "typescript", "unicorn", "oxc", "import", "promise", "vitest"],
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
