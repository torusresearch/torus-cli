# Tailwind Lint in React and Vue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export the opt-in Tailwind lint fragment independently from both the React and Vue packages.

**Architecture:** Preserve the existing React implementation. Add a separate implementation with the same contract in the Vue package. Keep each package self-contained and keep Tailwind optional. Verify Vue's package boundary with consumer lint and packed-module tests.

**Tech Stack:** TypeScript, Vite+ 1.4, Oxlint, Vitest, npm 12.

## Global Constraints

- Do not create a shared package or import either framework package from the other.
- Retain `tailwindLintPreset({ entryPoint })` in React and add the same export and `TailwindLintOptions` in Vue.
- Keep the four current rules, severities, plugin, settings, and blank-path error identical.
- Keep `reactLintPreset()` and `vueLintPreset()` free of Tailwind by default.
- Add an optional `oxlint-tailwindcss` peer to the Vue package.
- Do not claim lint coverage for Vue templates or CSS files.

---

### Task 1: Vue Tailwind fragment

**Files:** Modify `packages/torus-scripts/test/check-presets.test.ts`, `packages/oxlint-config-vue/index.ts`, `packages/oxlint-config-vue/package.json`, `package-lock.json`.

**Interfaces:** Consume existing `tailwindLintPreset({ entryPoint: string }): OxlintConfig` from React for parity checks. Produce the same function and `TailwindLintOptions` type from Vue.

- [ ] **Step 1: Write failing tests.** Add a named import of `tailwindLintPreset as vueTailwindLintPreset` from `../../oxlint-config-vue/index.js`. In the existing opt-in test, compare the Vue fragment to the React fragment and assert `vueLintPreset().jsPlugins` excludes `oxlint-tailwindcss`. Add a blank-path assertion for the Vue export. In the existing Vue/Tailwind fixture, import both functions from the Vue package. Check that Vue's manifest declares `oxlint-tailwindcss` as an optional peer.
- [ ] **Step 2: Confirm red.** Run `npm exec -- vp test packages/torus-scripts/test/check-presets.test.ts`. Expect a missing Vue export or failed parity assertions.
- [ ] **Step 3: Implement.** Add a local `TailwindLintOptions` interface and `tailwindLintPreset` implementation to `packages/oxlint-config-vue/index.ts`. Copy the React fragment's validation, plugin name, entryPoint setting, and four exact rule values. Set `oxlint-tailwindcss: ^1.14.0` in Vue's `peerDependencies` and mark it optional in `peerDependenciesMeta`. Run `npm install --package-lock-only --ignore-scripts` to update the lockfile.
- [ ] **Step 4: Confirm green.** Run `npm exec -- vp test packages/torus-scripts/test/check-presets.test.ts`. Expect all tests to pass, including both Vue and Tailwind diagnostics.

### Task 2: Packed consumer and guidance

**Files:** Modify `packages/torus-scripts/test/check-presets.test.ts`, `packages/torus-scripts/README.md`.

**Interfaces:** Vue's packed `dist/index.mjs` and `dist/index.d.mts` export `tailwindLintPreset`, and consumers can import the export without installing React.

- [ ] **Step 1: Extend the packed-install test.** In its `consumer.mjs`, import Vue's `tailwindLintPreset as vueTailwindLintPreset` and check it is a function. In `consumer.mts`, import the same symbol and type its result as `OxlintConfig`. Check Vue's declaration includes `tailwindLintPreset`.
- [ ] **Step 2: Confirm packed export.** Run `npm run build && npm exec -- vp test packages/torus-scripts/test/check-presets.test.ts`. Expect both the packed Vue runtime and declaration checks to pass.
- [ ] **Step 3: Document usage.** In `packages/torus-scripts/README.md`, state that React and Vue each export `tailwindLintPreset({ entryPoint: "src/styles.css" })`, that consumers opt in to `oxlint-tailwindcss`, and that Vue users import it from `@toruslabs/oxlint-config-vue`. State that it does not lint Vue templates or CSS files.
- [ ] **Step 4: Verify.** Run `npm run check && npm run build && npm run typecheck && npm run test && git diff --check`. Expect all checks and tests to pass. Do not commit or push unless requested.
