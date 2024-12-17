import chaiExpectPlugin from "eslint-plugin-chai-expect";
import nodePlugin from "eslint-plugin-n";
import pluginSecurity from "eslint-plugin-security";
import torusTypescriptConfig from "@toruslabs/eslint-config-typescript";
import globals from "globals";

export default [
  ...torusTypescriptConfig,
  chaiExpectPlugin.configs["recommended-flat"],
  nodePlugin.configs["flat/recommended-script"],
  pluginSecurity.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.mocha,
        ...globals.commonjs,
        ...globals.es2020,
      },

      ecmaVersion: es2024,
      sourceType: "module",
    },

    rules: {
      "import/extensions": [
        "error",
        "ignorePackages",
        {
          js: "never",
          ts: "never",
        },
      ],

      "n/no-unsupported-features/es-syntax": [
        "error",
        {
          version: ">=16",
          ignores: ["modules"],
        },
      ],

      "n/no-missing-import": 0,

      "import/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: ["**/*.test.ts", "**/*.test.tsx", "**/testHelpers.ts"],
        },
      ],
    },
  },
];
