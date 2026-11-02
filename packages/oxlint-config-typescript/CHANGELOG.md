# @toruslabs/oxlint-config-typescript

## 1.0.0

### Major Changes

- d43d0d0: Move shared lint rules into `@toruslabs/oxlint-config-typescript`. Add React, Vue, and Node packages that extend it. Remove `@toruslabs/torus-scripts/lint` and `/vue-lint`; keep `/fmt`. Remove the `@toruslabs/eslint-config-*` packages. Keep Tailwind v4 checks as an independent opt-in `tailwindLintPreset` fragment. The React and Vue packages each export their own copy, so Vue consumers do not need the React package. The Vue preset uses Vize's `incremental` preset with eight template rules that fixture tests prove, exported as `vueTemplateRules`. `vp lint` can skip template-only `.vue` files, so those files need a separate task.

  Restore the custom rules from the old ESLint packages. The TypeScript preset blocks all `console` calls, reports unused arguments after the last used one, and runs `no-useless-constructor`, `tsdoc/syntax`, `simple-import-sort/exports`, and `import/no-extraneous-dependencies` (as `import-js/`). Local `torus/type-names` and `torus/member-ordering` rules replace the `@typescript-eslint` rules, which cannot load with TypeScript 7. Vue keeps its stricter unused-variable options. Node adds `n/no-unsupported-features/es-syntax` for Node >=24. Oxfmt still sorts imports. This does not close the other known ESLint rule gaps.
