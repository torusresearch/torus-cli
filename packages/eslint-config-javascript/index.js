import js from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import importPlugin from "eslint-plugin-import";
import pluginPromise from "eslint-plugin-promise";
import vitest from "@vitest/eslint-plugin";

import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";

export default [
  js.configs.recommended,
  eslintPluginPrettierRecommended,
  importPlugin.flatConfigs.recommended,
  pluginPromise.configs["flat/recommended"],
  vitest.configs.recommended,
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
    },

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },

      ecmaVersion: 2024,
      sourceType: "module",
    },

    rules: {
      "import/prefer-default-export": 0,
      "simple-import-sort/imports": 2,
      "simple-import-sort/exports": 2,
      "no-dupe-class-members": 0,
      "no-useless-constructor": 0,

      "import/extensions": ["error", "ignorePackages"],

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
      "linebreak-style": ["error", "unix"],
      quotes: ["error", "double"],
      semi: ["error", "always"],
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
];
