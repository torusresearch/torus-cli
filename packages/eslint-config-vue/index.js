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
  parserOptions: {
    ecmaVersion: 2021,
  },
  // Workaround https://eslint.vuejs.org/user-guide/#compiler-macros-such-as-defineprops-and-defineemits-are-warned-by-no-undef-rule
  globals: {
    defineProps: "readonly",
    defineEmits: "readonly",
    defineExpose: "readonly",
    withDefaults: "readonly"
  }
};
