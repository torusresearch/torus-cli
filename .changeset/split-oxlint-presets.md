---
"@toruslabs/torus-scripts": major
"@toruslabs/oxlint-config-typescript": minor
"@toruslabs/oxlint-config-react": minor
"@toruslabs/oxlint-config-vue": minor
"@toruslabs/oxlint-config-node": minor
---

Move shared lint rules into `@toruslabs/oxlint-config-typescript`. Add React, Vue, and Node packages that extend it. Remove `@toruslabs/torus-scripts/lint` and `/vue-lint`; keep `/fmt`. Remove the `@toruslabs/eslint-config-*` packages. Keep Tailwind v4 checks as an independent opt-in fragment in the React package, usable by React and Vue consumers. This does not close the known ESLint rule gaps.
