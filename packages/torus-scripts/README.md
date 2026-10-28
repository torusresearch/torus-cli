# @toruslabs/torus-scripts

Vite+ config fragments for libraries, React, and Node packages. The presets do not install framework build plugins.

## Install

Install `@toruslabs/torus-scripts` and `vite-plus` in your project.

## Build presets

- `@toruslabs/torus-scripts/library`: `libraryPreset()` for ESM library builds.
- `@toruslabs/torus-scripts/react`: `reactPreset()` selects the automatic JSX runtime. Add `@vitejs/plugin-react` for Fast Refresh or its transforms.
- `@toruslabs/torus-scripts/node`: `nodePreset({ entry: "src/index.ts" })` targets Node and keeps dependencies external. Use a separate build for decorator metadata.

Compile Vue single-file components with `@vitejs/plugin-vue` in your project. Use `libraryPreset()` for the pack.

These fragments do not set CSS injection, browser targets, assets, SSR transforms, or `use client`. Set these options in your project.

## Format

`formatPreset()` is at `@toruslabs/torus-scripts/fmt`. It sets 150 columns, double quotes, semicolons, ES5 trailing commas, and import sorting. It does not sort exports.

```ts
import { formatPreset } from "@toruslabs/torus-scripts/fmt";
import { defineConfig } from "vite-plus";

export default defineConfig({ fmt: formatPreset() });
```

## TypeScript profiles

`@toruslabs/config` exports `tsconfig.base.json`, `tsconfig.library.json`, and `tsconfig.node.json`. Replace `tsconfig.default.json` or `tsconfig.build.json` with the matching profile.
