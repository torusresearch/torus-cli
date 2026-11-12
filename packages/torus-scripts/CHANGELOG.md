# @toruslabs/torus-scripts

## 9.0.2

### Patch Changes

- 7291658: `libraryPreset` now leaves sourcemaps off unless the caller sets `sourcemap: true`. The migration example uses the same setting.

## 9.0.1

### Patch Changes

- 4ee08c8: Keep the migration skill out of consumer git history, and point Vite+ package `types` and `exports` types at the real CJS declaration path.

## 9.0.0

### Major Changes

- 8b9d5dc: Remove the `torus-scripts release` command. Record and publish package versions with Changesets at the repository root.
- d43d0d0: Move shared lint rules into `@toruslabs/oxlint-config-typescript`. Add React, Vue, and Node packages that extend it. Remove `@toruslabs/torus-scripts/lint` and `/vue-lint`; keep `/fmt`. Remove the `@toruslabs/eslint-config-*` packages. Keep Tailwind v4 checks as an independent opt-in `tailwindLintPreset` fragment. The React and Vue packages each export their own copy, so Vue consumers do not need the React package. The Vue preset uses Vize's `incremental` preset with eight template rules that fixture tests prove, exported as `vueTemplateRules`. `vp lint` can skip template-only `.vue` files, so those files need a separate task.

  Restore the custom rules from the old ESLint packages. The TypeScript preset blocks all `console` calls, reports unused arguments after the last used one, and runs `no-useless-constructor`, `tsdoc/syntax`, `simple-import-sort/exports`, and `import/no-extraneous-dependencies` (as `import-js/`). Local `torus/type-names` and `torus/member-ordering` rules replace the `@typescript-eslint` rules, which cannot load with TypeScript 7. Vue keeps its stricter unused-variable options. Node adds `n/no-unsupported-features/es-syntax` for Node >=24. Oxfmt still sorts imports. This does not close the other known ESLint rule gaps.

- 66df5a5: Replace the Rollup build commands with explicit Vite+ presets for libraries, React, Node, and formatting. `@toruslabs/config` now exports TypeScript profiles only. These packages require Node.js >=24.22.0 and npm >=12. `npm pack` and `npm publish` build `dist` before they create the archive.

  Breaking changes:

  - `strictNullChecks` is now `true` in `tsconfig.base.json`. The old profile set `strict` to `true` and `strictNullChecks` to `false`.
  - DOM libraries are removed. `tsconfig.library.json` and `tsconfig.node.json` use the ES2024 library only. Add DOM libraries in a browser package.
  - The `torus-scripts` command is removed. Babel configs and `torus.config.js` are removed.
  - `libraryPreset()` requires an `entry` option, for example `libraryPreset({ entry: "src/index.ts" })`. Library builds default to ESM. Pass `format: ["esm", "cjs"]` when a package must also ship CommonJS. The old defaults emitted both formats.

  Use independent package versions. `@toruslabs/torus-scripts` and `@toruslabs/config` have no consumer requirement for synchronized releases.

### Minor Changes

- 5638433: Add the read-only `torus-scripts-upgrade` command. It inspects an old project and does not change files.
