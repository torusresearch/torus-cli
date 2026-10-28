# Separate Oxlint Package Presets

## Purpose

Replace the broad lint preset with four separate packages. Use TypeScript as the base, as the old React, Vue, and Node packages did. Do not create a JavaScript preset. Do not claim that Oxlint matches every old ESLint rule. The rule audit records known gaps.

## Public packages

Publish `@toruslabs/oxlint-config-typescript`, `@toruslabs/oxlint-config-react`, `@toruslabs/oxlint-config-vue`, and `@toruslabs/oxlint-config-node`. Do not publish `@toruslabs/oxlint-config-javascript`. Each package exports a function that returns a Vite+ `lint` config fragment. The TypeScript package owns the shared Oxlint rules and plugins; it can lint JavaScript and TypeScript files. React, Vue, and Node extend the TypeScript package and add only their own rules. Consumers choose one preset at the workspace root. Do not enable React or Node plugins in the TypeScript base.

Do not keep a shared lint base in `@toruslabs/torus-scripts`. Remove its `lintPreset()` and `/lint` export after consumers use the TypeScript package. React, Vue, and Node depend on `@toruslabs/oxlint-config-typescript`, as their old ESLint packages did. Keep dependencies acyclic and accept Vite+ as a peer. Put the Vue-only Vize dependency in the Vue package. Keep `formatPreset()` in `@toruslabs/torus-scripts/fmt`, separate from lint.

The Vue package uses Vize for Vue checks, with `oxlint-plugin-vize` as a Vue-only peer dependency. State that template-only files need a separate verified task. Keep Tailwind v4 lint as an independent opt-in fragment, not a shared lint base, so both React and Vue consumers can use it. Require each consumer to give its CSS entry point. Show how to combine Vue and Tailwind rules, plugins, and settings without losing nested fields.

## Limits and errors

Expose only rules that Vite+ can run and tests can prove. Keep the audit's known gaps visible: Vue i18n, Vue template-only files, CSS directives, import resolution, TypeScript naming, Node security, and export order. Reject an empty Tailwind CSS entry point with a clear error. Do not restore the old ESLint CLI or packages.

## Tests and documentation

Write tests before each package implementation. Check that the TypeScript package handles JS and TS without React or Node plugins. Check that each derived package adds its own plugin family. Keep the current Vue and Tailwind failure fixtures. Check package exports from installed workspace packages and dry-run the published archives. Update the root Vite+ config, `@toruslabs/torus-scripts` README, the rule audit, and Changesets data. Run `npm ci`, `npm run check`, `npm run build`, `npm run test`, and package dry-runs before the PR update.
