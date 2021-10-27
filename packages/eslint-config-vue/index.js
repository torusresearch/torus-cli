module.exports = {
  env: {
    es2020: true,
    browser: true,
    node: true,
    serviceworker: true,
  },
  extends: [
    "plugin:vue/vue3-recommended",
    "eslint:recommended",
    "@vue/typescript/recommended",
    "@vue/prettier",
    "@vue/prettier/@typescript-eslint",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "airbnb-typescript/base",
    "problems",
    "plugin:promise/recommended",
    "plugin:mocha/recommended",
  ],
  plugins: ["simple-import-sort", "import", "promise", "mocha", "eslint-plugin-tsdoc"],
  parserOptions: {
    ecmaVersion: 11,
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
    "import/extensions": [
      "error",
      "ignorePackages",
      {
        js: "never",
        ts: "never",
      },
    ],
    "import/prefer-default-export": 0,
    "simple-import-sort/imports": 2,
    "simple-import-sort/exports": 2,
    "no-unused-vars": 0,
    "@typescript-eslint/no-unused-vars": ["error", { args: "after-used", argsIgnorePattern: "_" }],
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
