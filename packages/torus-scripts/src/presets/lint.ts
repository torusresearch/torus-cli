import type { OxlintConfig } from "vite-plus/lint";

export function lintPreset(): OxlintConfig {
  return {
    plugins: ["typescript"],
    ignorePatterns: ["**/node_modules/**", "**/coverage/**", "**/build/**", "**/dist/**", "**/examples/**", "**/types/**", "**/test/fixtures/**"],
    rules: {
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
