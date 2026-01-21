import reactPlugin from "eslint-plugin-react";
import torusTypescriptConfig from "@toruslabs/eslint-config-typescript";
import tailwind from "eslint-plugin-tailwindcss";

import reactHooks from "eslint-plugin-react-hooks";
import jsxA11Y from "eslint-plugin-jsx-a11y";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";

// TODO: Add back eslint-config-airbnb when it's ready
/** @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigFile} */
export default [
  reactHooks.configs.flat.recommended,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat["jsx-runtime"],
  jsxA11Y.flatConfigs.recommended,
  ...tailwind.configs["flat/recommended"],
  ...torusTypescriptConfig,
  {
    languageOptions: {
      ...reactPlugin.configs.flat.recommended.languageOptions,
      ...jsxA11Y.flatConfigs.recommended.languageOptions,
      globals: {
        ...globals.browser,
        ...globals.node,
      },

      parser: tsParser,
      ecmaVersion: 2024,
      sourceType: "module",

      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },

    settings: {
      react: {
        version: "detect",
      },
      "import/resolver": {
        node: {
          extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
        },
      },
    },

    rules: {
      "no-restricted-exports": 0,
      "react/require-default-props": 0,

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
          jsx: "never",
          tsx: "never",
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
