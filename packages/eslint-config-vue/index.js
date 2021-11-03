module.exports = {
  env: {
    es2021: true,
    browser: true,
    node: true,
  },
  extends: [
    "airbnb-typescript/base",
    "problems",
    "standard",
    "plugin:vue/vue3-recommended",
    "eslint:recommended",
    "@vue/airbnb",
    "@vue/typescript/recommended",
    "plugin:prettier/recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "plugin:promise/recommended",
    "prettier",
  ],
  plugins: [
    "prettier",
    "promise",
    "import",
    "simple-import-sort",
    "eslint-plugin-tsdoc",
  ],
  parserOptions: {
    ecmaVersion: 2021,
  },
  // Workaround https://eslint.vuejs.org/user-guide/#compiler-macros-such-as-defineprops-and-defineemits-are-warned-by-no-undef-rule
  globals: {
    defineProps: "readonly",
    defineEmits: "readonly",
    defineExpose: "readonly",
    withDefaults: "readonly",
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
      { args: "after-used", argsIgnorePattern: "_" },
    ],
    "no-console": 2,
    "prettier/prettier": [
      2,
      {
        singleQuote: false,
        printWidth: 150,
        semi: true,
      },
    ],
  },
};
