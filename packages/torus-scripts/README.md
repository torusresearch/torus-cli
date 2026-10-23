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

`lintPreset()` returns a shared Oxlint config. `formatPreset()` returns Oxfmt settings: 150 columns, double quotes, semicolons, ES5 trailing commas, and import sorting. Export sorting is not available.

Put the settings in your root `vite.config.ts`:

```ts
import { formatPreset } from "@toruslabs/torus-scripts/fmt";
import { lintPreset } from "@toruslabs/torus-scripts/lint";
import { defineConfig } from "vite-plus";

export default defineConfig({ lint: lintPreset(), fmt: formatPreset() });
```

`vp lint` and `vp check` read this root config, not `.oxlintrc.json`. The shared preset enables native Oxlint plugins. It does not run ESLint.

For Vue files, install `oxlint-plugin-vize` and import `vueLintPreset()` from `@toruslabs/torus-scripts/vue-lint` in the root `lint` block. This enables Vize's happy-path Vue rules and the native Vue plugin. Vite+ can skip Vue files without scripts. For template-only Vue files, install `@vizejs/vite-plugin` and use its native Vite+ lint task through `vp run`. Test this task in each Vue project. Oxlint JS plugin output can give a script location instead of the template location.

For Tailwind v4, install `oxlint-tailwindcss`. Use `tailwindLintPreset({ entryPoint: "src/styles.css" })`, with a project CSS file containing `@import "tailwindcss"`. It checks classes in JS, TS, JSX, and TSX. It does not check classes in Vue templates or CSS directives. Set the path in each project.

To use Vue and Tailwind together, merge plugin lists, rule maps, and settings from both fragments in the root config. A plain object spread replaces nested settings and rules.

Oxlint does not replace every old rule. In particular, external Vue i18n files, Tailwind CSS directives, import resolution policies, TypeScript naming and member ordering, Node security checks, and export ordering need separate verified checks. Read the [rule audit](../../docs/superpowers/eslint-to-oxlint-rule-audit.md) for details. Do not assume equal rule behavior from similar names.

## Consumer proof and limits

Local Vite+ fixtures built a plain ESM SDK with declarations, a plain React TSX library, a Vue TypeScript helper, and a Node ESM library with external `node:` and `nanoid` imports. The plain SDK also passed an install and import from its packed archive. The React output did not retain a `use client` directive; set and verify it in your project when required. The Vue fixture does not compile a `.vue` file or external CSS. These checks do not prove CJS, Nest, Metro, SSR, or real downstream projects. Those cases need their own consumer build.

## Upgrade from the old CLI

Run `torus-scripts-upgrade` to inspect an old project without changing files. Run `vp migrate` at the workspace root and review the changes. Replace `torus-scripts build` with `vp pack`, use `vp check` for lint and format checks, and use `vp run -r build` for workspace builds.

Vite+ builds ESM by default. Set exports and declaration outputs for each project. Add framework transforms, CSS, SSR, and assets in project config. Use a separate tool for Node decorator metadata or Metro transforms.

The old `torus-scripts` executable, Rollup scripts, ESLint packages, and Prettier settings no longer ship. Use root Changesets commands (`npm run changeset`, `npm run version-packages`, `npm run release-packages`) for release work.
