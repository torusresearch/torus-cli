import globals from "globals";
import pluginVue from "eslint-plugin-vue";
import vueTsEslintConfig from "@vue/eslint-config-typescript";
import torusTypescriptConfig from "@toruslabs/eslint-config-typescript";
import tailwind from "eslint-plugin-tailwindcss";
import vueParser from "vue-eslint-parser";

export default [
  ...pluginVue.configs["flat/recommended"],
  ...vueTsEslintConfig(),
  ...tailwind.configs["flat/recommended"],
  ...torusTypescriptConfig,
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
      "tsdoc/syntax": 1,
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
