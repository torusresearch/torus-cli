import globals from "globals";
import pluginVue from "eslint-plugin-vue";
import { vueTsConfigs, defineConfigWithVueTs } from "@vue/eslint-config-typescript";
import torusTypescriptConfig from "@toruslabs/eslint-config-typescript";
import tailwind from "eslint-plugin-tailwindcss";
import vueParser from "vue-eslint-parser";

// Remove the base/setup and base/setup-for-vue configs from the pluginVue config
// These items are already exist in pluginVue.configs["flat/recommended"]
// This cause issue when we redefine vue() plugin
const duplicateConfigs = ["vue/base/setup", "vue/base/setup-for-vue"];
const pluginVueConfig = pluginVue.configs["flat/recommended"].filter((config) => !duplicateConfigs.includes(config.name));

// TODO: Add back eslint-vue when it's ready
export default [
  ...torusTypescriptConfig,
  ...defineConfigWithVueTs(pluginVueConfig, vueTsConfigs.recommended),
  ...tailwind.configs["flat/recommended"],
  {
    plugins: {},

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        defineProps: "readonly",
        defineEmits: "readonly",
        defineExpose: "readonly",
        withDefaults: "readonly",
      },

      ecmaVersion: 2024,
      sourceType: "module",

      parser: vueParser,
      parserOptions: {
        parser: "@typescript-eslint/parser",
        sourceType: "module",
      },
    },

    rules: {
      "vue/multi-word-component-names": 0,
      "@typescript-eslint/member-ordering": 1,
      "import/prefer-default-export": 0,
      "no-dupe-class-members": 0,
      "@typescript-eslint/no-dupe-class-members": 2,
      "no-useless-constructor": 0,
      "@typescript-eslint/no-useless-constructor": 2,
      "no-unused-vars": 0,

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
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
