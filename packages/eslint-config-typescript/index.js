import js from "@eslint/js";
import tseslint from "typescript-eslint";

import { fixupConfigRules } from "@eslint/compat";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import importPlugin from "eslint-plugin-import";
import pluginPromise from "eslint-plugin-promise";
import mochaPlugin from "eslint-plugin-mocha";

import simpleImportSort from "eslint-plugin-simple-import-sort";
import tsdoc from "eslint-plugin-tsdoc";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

/** @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigFile} */
export default [
  ...fixupConfigRules(compat.extends("problems")),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  importPlugin.flatConfigs.recommended,
  pluginPromise.configs["flat/recommended"],
  mochaPlugin.configs.flat.recommended,
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
      ecmaVersion: es2024,
      sourceType: "module",
    },

    settings: {
      "import/resolver-next": {
        typescript: createTypeScriptImportResolver({
          alwaysTryTypes: true,
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
    },
  },
];
