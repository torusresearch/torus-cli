module.exports = {
  env: {
    es2021: true,
    browser: true,
    node: true,
  },
  extends: [
    "plugin:vue/vue3-recommended",
    "eslint:recommended",
    "@vue/typescript/recommended",
    "@vue/prettier",
    "@vue/prettier/@typescript-eslint",
  ],
  plugins: ["simple-import-sort"],
  parserOptions: {
    ecmaVersion: 2021,
  },
  // Workaround https://eslint.vuejs.org/user-guide/#compiler-macros-such-as-defineprops-and-defineemits-are-warned-by-no-undef-rule
  globals: {
    defineProps: "readonly",
    defineEmits: "readonly",
    defineExpose: "readonly",
    withDefaults: "readonly"
  },
  rules: {
    "simple-import-sort/imports": 2,
    "simple-import-sort/exports": 2,
    "no-unused-vars": 0,
    "@typescript-eslint/no-unused-vars": ["error", { "args": "after-used", "argsIgnorePattern": "_" }],
    "no-console": 2,
    "prettier/prettier": [
      2,
      {
        singleQuote: false,
        printWidth: 150,
        semi: true,
      },
    ],
  }
};
