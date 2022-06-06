module.exports = {
  env: {
    es2020: true,
    node: true,
    mocha: true,
    commonjs: true,
  },
  extends: ["@toruslabs/eslint-config-typescript", "plugin:n/recommended", "plugin:security/recommended", "plugin:chai-expect/recommended"],
  plugins: ["chai-expect", "security"],
  parserOptions: {
    ecmaVersion: 11,
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
    "import/no-extraneous-dependencies": ["error", { devDependencies: ["**/*.test.ts", "**/*.test.tsx", "**/testHelpers.ts"] }],
  },
};
