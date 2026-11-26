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

The Vue preset enables only the Vize template rules in `vueTemplateRules`, and fixture tests prove each one. It uses the Vize Oxlint plugin through `vp lint` and `vp check`. These commands can skip a `.vue` file that has no `<script>` block, so they do not check template-only files. The preset's native `no-unused-vars` options report unused arguments and caught errors in `.ts` files, but `vp lint` does not report that rule for `.vue` script blocks. Run a separate check for these gaps and verify it in your project.

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

## Upgrade from the old CLI

The package includes agent skills in `skills/`. In a consumer project, read them at `node_modules/@toruslabs/torus-scripts/skills/<name>/SKILL.md`. To make one available as a project skill in Cursor, copy its directory to `.cursor/skills/<name>/` in that project, but do not commit that copy. The skills belong to this package; a committed copy goes stale and the consumer repository then carries two versions. Keep the skills and this README from the same package version.

Pick the skills by repository type. The stack upgrade and the CI move are separate pull requests.

| Repository                                                                                         | Stack upgrade                                                         | CI and release flow                            |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| Torus library or SDK that publishes to npm                                                         | `torus-library-upgrade`                                               | the release PR step in `torus-library-upgrade` |
| Torus frontend app that deploys to S3 and CloudFront (auth-service, auth-dashboard)                | `torus-library-upgrade` and `torus-frontend-upgrade`                  | `torus-frontend-ci-upgrade`                    |
| Torus backend service that deploys to ECS (broadcast-channel-server, torus-signer, citadel-server) | `torus-library-upgrade` and `torus-backend-upgrade`                   | `torus-backend-ci-upgrade`                     |
| consensys-vertical-apps backend (va-mmcx-rule-engine-api, va-mmcx-subscription-api)                | `consensys-vertical-apps-backend-upgrade` and `torus-backend-upgrade` | —                                              |

- `torus-library-upgrade` is the full Torus CLI, Vite+, lint, and repository rules plan. `reference.md` in that directory holds the CODEOWNERS, Dependabot, and `.npmrc` lookup tables.
- `torus-frontend-upgrade` and `torus-backend-upgrade` are not full plans. They add the frontend or backend steps to `torus-library-upgrade`, and list where they replace its guidance.
- `consensys-vertical-apps-backend-upgrade` does the repository rules only: GitHub policy files, engines, `.npmrc`, tsconfig profiles, Changesets, CI, and dependency updates. No Vite+ and no lint.
- `torus-frontend-ci-upgrade` moves a frontend app's CI to one `master` trunk, Changesets release PRs, and GitHub Environment approvals, as in [Web3Auth/auth-service#406](https://github.com/Web3Auth/auth-service/pull/406).
- `torus-backend-ci-upgrade` moves a backend's CI to one `master` trunk: every merge deploys LRC, then waits for approval before staging and production. No release PR, no Changesets, and no version tags.

Run `torus-scripts-upgrade <path>` to inspect an old project without changing files. It reports unsupported custom behavior and exits nonzero for those cases. Run `vp migrate` at the workspace root, not inside each package, and review its changes. The diagnostic does not run `vp migrate` for you.

Replace the old commands:

- `torus-scripts build` → define `pack` in the consumer's `vite.config.ts`, then run `vp pack`.
- `torus-scripts lint` → select an Oxlint package, set root `lint` and `fmt` config, then run `vp check`.
- `torus-scripts start` → set the consumer's Vite+ dev task. No shared dev server ships.
- `torus-scripts release` → use Changesets at the repository root.
- Lerna workspace tasks → run `vp run -r build` with explicit build tasks.

## TypeScript profiles

`@toruslabs/config` exports `tsconfig.base.json`, `tsconfig.library.json`, and `tsconfig.node.json`. Replace `tsconfig.default.json` or `tsconfig.build.json` with the matching profile.
