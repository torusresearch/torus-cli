# @toruslabs/torus-scripts

Vite+ config fragments for libraries, React, Vue, and Node packages. The presets do not install framework build plugins.

## Install

Install `@toruslabs/torus-scripts` and `vite-plus` in your project.

## Build presets

- `@toruslabs/torus-scripts/library`: `libraryPreset()` for ESM library builds.
- `@toruslabs/torus-scripts/react`: `reactPreset()` selects the automatic JSX runtime. Add `@vitejs/plugin-react` for Fast Refresh or its transforms.
- `@toruslabs/torus-scripts/vue`: `vuePreset()` is a small Vue fragment. Add `@vitejs/plugin-vue` to transform Vue files.
- `@toruslabs/torus-scripts/node`: `nodePreset({ entry: "src/index.ts" })` targets Node and keeps dependencies external. Use a separate build for decorator metadata.

These fragments do not set CSS injection, browser targets, assets, SSR transforms, or `use client`. Set these options in your project.

## Format

`formatPreset()` is at `@toruslabs/torus-scripts/fmt`. It sets 150 columns, double quotes, semicolons, ES5 trailing commas, and import sorting. It does not sort exports.

```ts
import { formatPreset } from "@toruslabs/torus-scripts/fmt";
import { defineConfig } from "vite-plus";

export default defineConfig({ fmt: formatPreset() });
```

## Lint

Install one of `@toruslabs/oxlint-config-typescript`, `@toruslabs/oxlint-config-react`, `@toruslabs/oxlint-config-vue`, or `@toruslabs/oxlint-config-node`. The TypeScript preset checks both JavaScript and TypeScript. React, Vue, and Node extend it. This package does not export `/lint` or `/vue-lint`.

The old `@toruslabs/eslint-config-*` packages are removed. Read the [rule audit](https://github.com/torusresearch/torus-cli/blob/main/docs/superpowers/eslint-to-oxlint-rule-audit.md) before you treat an Oxlint rule as equal to an old ESLint rule.

## Upgrade from the old CLI

Run `torus-scripts-upgrade <path>` to inspect an old project without changing files. It reports unsupported custom behavior and exits nonzero for those cases. Run `vp migrate` at the workspace root, not inside each package, and review its changes. The diagnostic does not run `vp migrate` for you.

Replace the old commands:

- `torus-scripts build` → define `pack` in the consumer's `vite.config.ts`, then run `vp pack`.
- `torus-scripts lint` → select an Oxlint package, set root `lint` and `fmt` config, then run `vp check`.
- `torus-scripts start` → set the consumer's Vite+ dev task. No shared dev server ships.
- `torus-scripts release` → use Changesets at the repository root.
- Lerna workspace tasks → run `vp run -r build` with explicit build tasks.

## TypeScript profiles

`@toruslabs/config` exports `tsconfig.base.json`, `tsconfig.library.json`, and `tsconfig.node.json`. Replace `tsconfig.default.json` or `tsconfig.build.json` with the matching profile.
