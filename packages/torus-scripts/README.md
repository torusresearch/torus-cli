# @toruslabs/torus-scripts

Vite+ config fragments for libraries, React, Vue, and Node packages. The presets do not install framework build plugins.

## Install

Install `@toruslabs/torus-scripts` and `vite-plus` in your project. Add optional lint plugins only where needed.

## Build presets

- `@toruslabs/torus-scripts/library`: `libraryPreset()` for ESM library builds.
- `@toruslabs/torus-scripts/react`: `reactPreset()` selects the automatic JSX runtime. Add `@vitejs/plugin-react` for Fast Refresh or its transforms.
- `@toruslabs/torus-scripts/vue`: `vuePreset()` is a small Vue fragment. Add `@vitejs/plugin-vue` to transform Vue files.
- `@toruslabs/torus-scripts/node`: `nodePreset({ entry: "src/index.ts" })` targets Node and keeps dependencies external. Use a separate build for decorator metadata.

These fragments do not set CSS injection, browser targets, assets, SSR transforms, or `use client`. Set these options in your project.

## Lint and format

Install one of `@toruslabs/oxlint-config-typescript`, `@toruslabs/oxlint-config-react`, `@toruslabs/oxlint-config-vue`, or `@toruslabs/oxlint-config-node`. The TypeScript preset checks both JS and TS. React, Vue, and Node extend it. No `/lint` or `/vue-lint` export remains in this package.

`formatPreset()` remains at `@toruslabs/torus-scripts/fmt`. It sets 150 columns, double quotes, semicolons, ES5 trailing commas, and import sorting. It does not sort exports.

Put the settings in your root `vite.config.ts`:

```ts
import { typescriptLintPreset } from "@toruslabs/oxlint-config-typescript";
import { formatPreset } from "@toruslabs/torus-scripts/fmt";
import { defineConfig } from "vite-plus";

export default defineConfig({ lint: typescriptLintPreset(), fmt: formatPreset() });
```

`vp lint` and `vp check` read this root config, not `.oxlintrc.json`. These presets run native Oxlint rules, not ESLint.

For Vue files, install `oxlint-plugin-vize` (a required peer because the preset imports it) and use `vueLintPreset()` from `@toruslabs/oxlint-config-vue`. It enables Vize's happy-path Vue rules. Vite+ can skip Vue files without scripts. For template-only Vue files, install `@vizejs/vite-plugin` and verify its native Vite+ lint task through `vp run`. Oxlint JS plugin output can report script positions for template errors.

For Tailwind v4, install `oxlint-tailwindcss`. Use `tailwindLintPreset({ entryPoint: "src/styles.css" })` from `@toruslabs/oxlint-config-react` in either React or Vue projects. The CSS file must contain `@import "tailwindcss"`. This checks classes in JS, TS, JSX, TSX, and Vue script-side class strings, not Vue templates or CSS directives. The Vue and Tailwind fragments can report both findings in one `.vue` file with a script block.

Merge Vue and Tailwind fragments without replacing nested data:

```ts
import { tailwindLintPreset } from "@toruslabs/oxlint-config-react";
import { vueLintPreset } from "@toruslabs/oxlint-config-vue";
import { formatPreset } from "@toruslabs/torus-scripts/fmt";
import { defineConfig } from "vite-plus";

const vue = vueLintPreset();
const tailwind = tailwindLintPreset({ entryPoint: "src/styles.css" });
export default defineConfig({
  lint: {
    ...vue,
    plugins: [...(vue.plugins ?? []), ...(tailwind.plugins ?? [])],
    jsPlugins: [...(vue.jsPlugins ?? []), ...(tailwind.jsPlugins ?? [])],
    rules: { ...vue.rules, ...tailwind.rules },
    settings: { ...vue.settings, ...tailwind.settings },
  },
  fmt: formatPreset(),
});
```

If both fragments set the same nested setting, merge that setting too. A plain top-level object spread loses rules and plugin lists.

Oxlint does not replace every old rule. In particular, external Vue i18n files, Tailwind CSS directives, import resolution policies, TypeScript naming and member ordering, Node security checks, and export ordering need separate verified checks. Read the [rule audit](https://github.com/torusresearch/torus-cli/blob/main/docs/superpowers/eslint-to-oxlint-rule-audit.md) for details. Do not assume equal rule behavior from similar names.

## Consumer proof and limits

`consumer-matrix.test.ts` copies the scripts package into a temporary project, builds it, packs it, and installs it in a new temporary project. It builds each recipe with that installed package. It then packs and installs each output in a new project. The full test suite passed locally on Node 24.15.0 and Node 26.12.1, each with npm 12.2.0.

- **Proven with local packed fixtures:** The scripts tarball exports `/library`, `/react`, `/vue`, `/node`, and `/fmt`. A TypeScript NodeNext check resolves the library preset declaration. The plain SDK exports ESM and resolves its `.d.mts` declaration through its installed package. It keeps `nanoid` external.
- **Proven with consumer options:** An explicit `format: ["esm", "cjs"]` produces loadable ESM and CJS. NodeNext resolves the installed CJS consumer's `.cts` import through the `require.types` condition to `.d.cts`. A React TSX entry retains `use client` only when the consumer sets a pack banner. A Vue TypeScript entry writes external `style.css`, exports its CSS path, and does not inject CSS into JavaScript. The Node ESM entry keeps `node:crypto`, `node:fs`, and `nanoid` external and runs in Node. These checks do not compile a `.vue` file or render a React component.
- **Compiler exception shown by fixture:** With `experimentalDecorators` and `emitDecoratorMetadata`, `tsc` emits `design:paramtypes`. The Node pack preset does not emit it. Use TypeScript or Nest compilation for a backend that needs constructor metadata. This does not prove a Nest or GraphQL application build.
- **Requires consumer story:** No downstream repository was built or tested against this tarball. The checks below read local files only. All downstream compatibility remains unverified.

Read-only inspection on 23 October 2026 (no downstream build, install, or test):

- `torus.js`: Read root `package.json`. It sets `main` to `dist/lib.cjs/index.js`, `module` to `dist/lib.esm/index.js`, and `types` to `dist/lib.cjs/types/index.d.ts`. Its build runs `torus-scripts build`; its test runs Vitest with Node coverage. Version constants and browser tests were not checked.
- `fetch-node-details`: Read root `package.json`, `lerna.json`, and `packages/fnd-base/package.json`. The root uses Lerna for build and parallel tests. `fnd-base` sets CJS, ESM, and declaration paths under `dist`; its build runs `torus-scripts build`. NodeNext code, browser tests, and version constants were not checked.
- `tkey`: Read root `package.json`, `lerna.json`, and `packages/seed-phrase/package.json`. The root builds with Lerna and lists browser test commands. `seed-phrase` sets CJS and ESM paths under `dist`. Version constants and test results were not checked.
- `Auth`: Read root `package.json` and locate `rollup.config.mjs`. Its exports include named subpaths and declaration paths under `dist/lib.cjs/types`; its build runs `torus-scripts build`. Rollup plugin contents and version constants were not checked.
- `wallet-services`: Read root `package.json`, `lerna.json`, and `packages/wallet-services-frontend/package.json`. The root builds with Lerna and lists Vue and CSS build dependencies. The frontend builds with Vite. The frontend build output, Node backend, and version constants were not checked.
- `web3auth-web`: Read root `package.json`, `lerna.json`, and `packages/no-modal/package.json`; locate `packages/no-modal/rollup.config.mjs`. The root builds and tests with Lerna; `no-modal` sets CJS, ESM, and declaration paths under `dist`. Next.js applications and version constants were not checked.
- `web3auth-backend`: Read root `package.json`, `tsconfig.json`, and `packages/node-sdk/package.json`; locate `packages/node-sdk/rollup.config.mjs`. The root uses NodeNext and Lerna; `node-sdk` builds with `torus-scripts build` and sets CJS, ESM, and declaration paths under `dist`. Rollup plugin contents and version constants were not checked.

Inspect version constants, test targets, and custom build behavior in each consumer before changing its output.

Metro and React Native remain separate: a CJS fixture alone does not prove Metro resolution or native transforms. Keep Metro configuration in the native consumer. PWA, Next.js, Vue SFC, Docker, and AWS setup also stay with their consumers. Scanner settings and downstream browser or native tests are not verified by this matrix.

## Upgrade from the old CLI

Run `torus-scripts-upgrade <path>` to inspect an old project without changing files. It reports unsupported custom behavior and exits nonzero for those cases. Run `vp migrate` at the **workspace root**, not inside each package, and review its changes. The diagnostic does not run `vp migrate` for you.

Replace the old commands:

- `torus-scripts build` → define `pack` in the consumer's `vite.config.ts`, then run `vp pack`.
- `torus-scripts lint` → select an Oxlint package, set root `lint` and `fmt` config, then run `vp check`.
- `torus-scripts start` → set the consumer's Vite+ dev task. No shared dev server ships.
- `torus-scripts release` → use Changesets at the repository root. Run `changeset` to record changes, `changeset version` to prepare versions, and `changeset publish` only after release approval.
- Lerna workspace tasks → run `vp run -r build` with explicit build tasks.

The new major builds ESM by default and has no root export or legacy CLI. Set explicit package exports and declaration outputs in each consumer. Add CJS only for verified users. Supply React or Vue plugins, CSS handling, `use client`, SSR, assets, and browser polyfills in consumer config; these presets do not add them. For Node decorator metadata, use TypeScript or Nest compilation. Keep Metro transforms in React Native projects; do not assume Vite+ replaces Metro.

`@toruslabs/config` now exports only `tsconfig.base.json`, `tsconfig.library.json`, and `tsconfig.node.json`. Replace `tsconfig.default.json` or `tsconfig.build.json` with the appropriate profile. The old Babel and `torus.config.js` files no longer ship. The old `torus-scripts` executable, Rollup scripts, ESLint packages, and Prettier settings no longer ship.
