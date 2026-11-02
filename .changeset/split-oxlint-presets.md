---
"@toruslabs/torus-scripts": major
"@toruslabs/oxlint-config-typescript": minor
"@toruslabs/oxlint-config-react": minor
"@toruslabs/oxlint-config-vue": minor
"@toruslabs/oxlint-config-node": minor
---

Move shared lint rules into `@toruslabs/oxlint-config-typescript`. Add React, Vue, and Node packages that extend it. Remove `@toruslabs/torus-scripts/lint` and `/vue-lint`; keep `/fmt`. Remove the `@toruslabs/eslint-config-*` packages. Keep Tailwind v4 checks as an independent opt-in `tailwindLintPreset` fragment. The React and Vue packages each export their own copy, so Vue consumers do not need the React package. The Vue preset uses Vize's `incremental` preset with eight template rules that fixture tests prove, exported as `vueTemplateRules`. `vp lint` can skip template-only `.vue` files, so those files need a separate task. This does not close the known ESLint rule gaps.
