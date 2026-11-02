# Tailwind lint in React and Vue packages

## Purpose

Consumers must not install a React-named package to use Tailwind lint with Vue.

## Package interfaces

Keep `tailwindLintPreset({ entryPoint })` in `@toruslabs/oxlint-config-react`. Add the same named export to `@toruslabs/oxlint-config-vue`. Each package owns its own implementation and `TailwindLintOptions` type. Do not add a shared Tailwind package or import one framework package from the other.

Both exports return an independent `OxlintConfig` fragment. They register `oxlint-tailwindcss`, set `settings.tailwindcss.entryPoint`, and enable the same four existing rules with the same severity. They reject an empty or whitespace-only entry point with the current error message. Keep Tailwind opt-in; neither `reactLintPreset()` nor `vueLintPreset()` enables it by default.

Declare `oxlint-tailwindcss` as an optional peer of the Vue package, as in the React package. Consumers install the plugin only when they use the Tailwind fragment. Do not change the TypeScript base or its framework presets.

## Tests and documentation

Test that the React and Vue exports return equivalent fragments and reject blank paths. Run a Vue and Tailwind fixture with both imports from the Vue package. Keep the React lint fixture to verify its export. Check packed Vue declarations and imports, then run source checks, build, typecheck, and the full test suite. Update consumer guidance to show the Vue package import.

## Scope

This change does not alter the known limits of Tailwind lint on Vue templates or CSS files. It does not add a general-purpose config merge helper.
