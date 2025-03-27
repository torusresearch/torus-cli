import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import importPlugin from "eslint-plugin-import";
import pluginPromise from "eslint-plugin-promise";
import vitest from "@vitest/eslint-plugin";

import simpleImportSort from "eslint-plugin-simple-import-sort";
import tsdoc from "eslint-plugin-tsdoc";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";

// TODO: Add back eslint-config-airbnb-typescript, eslint-config-airbnb-base, eslint-config-problems when it's ready

/** @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigFile} */
export default [
  // ...compat.extends("eslint-config-problems"),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  importPlugin.flatConfigs.recommended,
  pluginPromise.configs["flat/recommended"],
  vitest.configs.recommended,
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
      tsdoc,
    },

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },

      parser: tsParser,
      ecmaVersion: 2024,
      sourceType: "module",
    },

    settings: {
      "import/resolver": {
        typescript: createTypeScriptImportResolver({
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        }),
      },
    },

    rules: {
      "tsdoc/syntax": 1,

      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "typeLike",
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
        },
      ],

      "@typescript-eslint/member-ordering": 1,
      "import/prefer-default-export": 0,
      "simple-import-sort/imports": 2,
      "simple-import-sort/exports": 2,
      "no-dupe-class-members": 0,
      "@typescript-eslint/no-dupe-class-members": 2,
      "no-useless-constructor": 0,
      "@typescript-eslint/no-useless-constructor": 2,
      "no-unused-vars": 0,

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "_",
        },
      ],

      "import/extensions": [
        "error",
        "ignorePackages",
        {
          js: "never",
          ts: "never",
        },
      ],

      "no-console": 2,

      "prettier/prettier": [
        2,
        {
          singleQuote: false,
          printWidth: 150,
          semi: true,
          trailingComma: "es5",
        },
      ],

      "import/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: [
            // ignore all eslint.config.mjs files
            "**/**/eslint.config.mjs",
            // ignore all test files
            "**/*.test.ts",
            "**/*.test.tsx",
            // ignore all test helpers
            "**/testHelpers.ts",
            // ignore all test configs
            "**/test/configs/**",
            // ignore all storybook files
            "**/*.stories.tsx",
          ],
        },
      ],
    },

    ignores: [
      // See https://help.github.com/ignore-files/ for more about ignoring files.
      // dependencies
      "/node_modules",
      // testing
      "/coverage",
      //production
      "/build",
      // misc
      ".DS_Store",
      ".env.local",
      ".env.development.local",
      ".env.test.local",
      ".env.production.local",

      "npm-debug.log*",
      "yarn-debug.log*",
      "yarn-error.log*",
      "examples/",
      "types/*",
      "dist/*",
    ],
  },
  {
    files: ["**/*.json"],
    rules: {
      "no-unused-expressions": "off",
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
];
