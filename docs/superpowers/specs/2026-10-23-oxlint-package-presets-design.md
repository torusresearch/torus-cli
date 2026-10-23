# Separate Oxlint Package Presets

## Purpose

Replace the broad lint preset with five separate packages. Keep each package focused on one source type, as the old packages did. Do not claim that Oxlint matches every old ESLint rule. The rule audit records known gaps.

## Public packages

Publish `@toruslabs/oxlint-config-javascript`, `@toruslabs/oxlint-config-typescript`, `@toruslabs/oxlint-config-react`, `@toruslabs/oxlint-config-vue`, and `@toruslabs/oxlint-config-node`. Each package exports a function that returns a Vite+ `lint` config fragment. The JavaScript package supplies common rules. TypeScript extends JavaScript. React, Vue, and Node extend TypeScript and add only their own rules. Consumers choose one preset at the workspace root. Do not enable React or Node plugins in the shared base.

Place shared code in `@toruslabs/torus-scripts/lint` initially, so the five packages can reuse it without copying rules. Keep the package dependencies acyclic. The new packages depend on `@toruslabs/torus-scripts` and accept Vite+ as a peer. Do not require optional Vue or Tailwind tools for users of other packages. Keep `formatPreset()` separate from all lint presets.

The Vue package uses Vize for Vue checks, with `oxlint-plugin-vize` as a Vue-only peer dependency. State that template-only files need a separate verified task. Keep Tailwind v4 lint opt-in and require each consumer to give its CSS entry point. Show how to combine Vue and Tailwind rules, plugins, and settings without losing nested fields.

## Limits and errors

Expose only rules that Vite+ can run and tests can prove. Keep the audit's known gaps visible: Vue i18n, Vue template-only files, CSS directives, import resolution, TypeScript naming, Node security, and export order. Reject an empty Tailwind CSS entry point with a clear error. Do not restore the old ESLint CLI or packages.

## Tests and documentation

Write tests before each package implementation. Check that each package enables its own plugin family and does not enable unrelated families. Run lint fixtures for each available source type and keep the current Vue and Tailwind failure fixtures. Check package exports from installed workspace packages and dry-run the published archives. Update the root Vite+ config, `@toruslabs/torus-scripts` README, the rule audit, and Changesets data. Run `npm ci`, `npm run check`, `npm run build`, `npm run test`, and package dry-runs before the PR update.
