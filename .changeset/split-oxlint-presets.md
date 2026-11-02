---
"@toruslabs/torus-scripts": major
"@toruslabs/oxlint-config-typescript": minor
"@toruslabs/oxlint-config-react": minor
"@toruslabs/oxlint-config-vue": minor
"@toruslabs/oxlint-config-node": minor
---

Move shared lint rules into `@toruslabs/oxlint-config-typescript`. Add React, Vue, and Node packages that extend it. Remove `@toruslabs/torus-scripts/lint` and `/vue-lint`; keep `/fmt`. Remove the `@toruslabs/eslint-config-*` packages. Keep Tailwind v4 checks as an independent opt-in fragment in the React package, usable by React and Vue consumers.

Restore the custom rules from the old ESLint packages. The TypeScript preset blocks all `console` calls, reports unused arguments after the last used one, and runs `no-useless-constructor`, `tsdoc/syntax`, `simple-import-sort/exports`, and `import/no-extraneous-dependencies` (as `import-js/`). Local `torus/type-names` and `torus/member-ordering` rules replace the `@typescript-eslint` rules, which cannot load with TypeScript 7. Vue keeps its stricter unused-variable options. Node adds `n/no-unsupported-features/es-syntax` for Node >=24. Oxfmt still sorts imports. This does not close the other known ESLint rule gaps.
