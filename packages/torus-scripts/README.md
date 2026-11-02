# @toruslabs/torus-scripts

Vite+ config fragments for libraries, React, and Node packages. The presets do not install framework build plugins.

## Install

Install `@toruslabs/torus-scripts` and `vite-plus` in your project.

## Build presets

- `@toruslabs/torus-scripts/library`: `libraryPreset({ entry: "src/index.ts" })` for ESM library builds.
- `@toruslabs/torus-scripts/react`: `reactPreset()` selects the automatic JSX runtime. Add `@vitejs/plugin-react` for Fast Refresh or its transforms.
- `@toruslabs/torus-scripts/node`: `nodePreset({ entry: "src/index.ts" })` targets Node and keeps dependencies external. Use a separate build for decorator metadata.

Compile Vue single-file components with `@vitejs/plugin-vue` in your project. Use `libraryPreset({ entry: "src/index.ts" })` for the pack.

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

The Vue preset enables only the Vize template rules in `vueTemplateRules`, and fixture tests prove each one. It uses the Vize Oxlint plugin through `vp lint` and `vp check`. These commands can skip a `.vue` file that has no `<script>` block, so they do not check template-only files. Run a separate task for those files, such as the native Vize lint task, and verify it in your project.

React and Vue each export an optional `tailwindLintPreset({ entryPoint: "src/styles.css" })` fragment. Install `oxlint-tailwindcss` if you use this fragment. Vue projects import it from `@toruslabs/oxlint-config-vue`, not the React package.

Do not combine the fragment and a framework preset with a plain object spread. `{ ...vueLintPreset(), ...tailwindLintPreset({ entryPoint }) }` replaces `jsPlugins`, `rules`, and `settings`. This removes the Vize rules and `oxlint-plugin-vize`, or the React Hooks rules, and lint can still exit 0. Merge each field:

```ts
import { tailwindLintPreset, vueLintPreset } from "@toruslabs/oxlint-config-vue";
import { defineConfig } from "vite-plus";

const framework = vueLintPreset();
const tailwind = tailwindLintPreset({ entryPoint: "src/styles.css" });

export default defineConfig({
  lint: {
    ...framework,
    jsPlugins: [...(framework.jsPlugins ?? []), ...(tailwind.jsPlugins ?? [])],
    rules: { ...framework.rules, ...tailwind.rules },
    settings: { ...framework.settings, ...tailwind.settings },
  },
});
```

For React, import `reactLintPreset` and `tailwindLintPreset` from `@toruslabs/oxlint-config-react` and merge the same fields. Tailwind class checks run on JS, TS, JSX, and TSX, including supported Vue script blocks; they do not check Vue template classes or CSS files.

The old `@toruslabs/eslint-config-*` packages are removed. Do not treat an Oxlint rule as equal to an old ESLint rule until you test it in your project.

## TypeScript profiles

`@toruslabs/config` exports `tsconfig.base.json`, `tsconfig.library.json`, and `tsconfig.node.json`. Replace `tsconfig.default.json` or `tsconfig.build.json` with the matching profile.
