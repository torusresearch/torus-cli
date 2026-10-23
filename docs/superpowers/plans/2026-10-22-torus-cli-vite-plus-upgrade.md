# Torus CLI Vite+ Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a new major `@toruslabs/torus-scripts` as small Vite+ presets and migration support, while moving `torus-cli` to npm workspaces, Changesets, current TypeScript, hardened installs, and verified security CI.

**Architecture:** Keep Vite+, Changesets, and npm as the commands consumers run. Publish one small preset package with public subpaths for library, React, Vue, Node, lint, format, and TypeScript defaults. Run migration diagnostics in a separate opt-in executable; keep framework plugins, release policy, and app settings in each consumer repository.

**Tech Stack:** Node 24/26, npm 12, Vite+ 1.3.0 as the initial tested baseline, tsdown via `vp pack`, Oxlint/Oxfmt via `vp check`, TypeScript 7.0.2 as the initial tested baseline, Changesets 3.0.3, LavaMoat harden, Vitest via Vite+, GitHub Actions.

## Global Constraints

- Scope: [EMBED-579](https://consensyssoftware.atlassian.net/browse/EMBED-579), within [EMBED-573](https://consensyssoftware.atlassian.net/browse/EMBED-573). Consumer repository migrations have separate stories; do not edit them as part of this plan.
- Preserve npm workspaces and `package-lock.json`; remove Lerna and release-it. Never delete a lockfile or install packages during release scripts.
- Set `engines.node` to `>=24.15.0`, `engines.npm` to `>=12`, and `.nvmrc` to `>=26.x` at the root and in published workspaces. CI must run on a supported Node 24 patch with npm 12 and on Node 26 with npm 12.
- Use `npm view` before installation to recheck latest stable versions. Update non-major dependencies to the latest compatible releases. Seek user approval for unrelated major dependency upgrades. Vite+, TypeScript latest, Oxlint/Oxfmt, Changesets, and removal of Rollup/Lerna/release-it are already in scope.
- Run `@lavamoat/harden defaults` at moderate level and commit its actual generated configuration. Preserve stronger settings. Audit every required install script rather than disabling hardening.
- No inline imports. Use exhaustive `never` defaults if a TypeScript discriminated-union switch is added.
- Do not apply browser DOM globals, polyfills, Babel transforms, `ts-patch`, `.env` loading, lint-before-build, CJS output, or minification to all consumers by default.
- Prefer ESM and explicit exports in the new major. Consumers may retain CJS only for verified users such as Metro. Keep TypeScript/decorator/metadata-sensitive backend builds with an appropriate compiler rather than forcing a single bundle.
- Do not copy Citadel's deployment infrastructure, disabled KICS setting, or ignored Trivy failures. `torus-cli` has no backend service/container to scan, so KICS and Trivy do not apply unless that scope changes.
- Do not publish, tag, or deploy automatically. Record and request approval before publishing or making paid/organization-wide GitHub security changes.

## File Structure and Ownership

- `packages/torus-scripts/src/presets/{library,node,react,vue,fmt}.ts`: build and format preset builders; application configuration stays in the consumer.
- `packages/oxlint-config-{typescript,react,vue,node}`: separate lint packages. TypeScript owns shared rules; React, Vue, and Node extend it. Do not create a JavaScript lint package or keep the shared lint base in `torus-scripts`.
- `packages/torus-scripts/src/migrate/{inspect,report,cli}.ts`: read-only migration inspection and reporting; no silent source rewrite.
- `packages/torus-scripts/src/index.ts`: small public exports. `packages/torus-scripts/package.json`: explicit export map, peer dependencies, published files, and executable entry.
- `packages/torus-scripts/vite.config.ts`: its own `vp pack`/`vp test` setup. `packages/torus-scripts/test/*.test.ts`: behavior tests and executable fixtures.
- `packages/config/tsconfig.{base,library,node}.json`: explicit TypeScript settings; remove legacy config only in the final cleanup task. `packages/config/package.json`: explicit subpath exports.
- `packages/eslint-config-{typescript,javascript,react,vue,node}`: plan removal or deprecation; verify no new preset silently imports them.
- Root `package.json`, `.nvmrc`, generated `.npmrc`, `package-lock.json`, `.changeset/config.json`, `vite.config.ts`, and `.github/workflows/*.yml`: npm/Changesets/runtime/hardening/CI contract.
- `packages/torus-scripts/README.md`: consumer usage, supported outputs, old-to-new mapping, unsupported cases, and release gates.

## Task 1: Freeze the Baseline and Build a Contract Fixture

**Files:** Create `packages/torus-scripts/test/fixtures/plain-sdk/{package.json,src/index.ts,tsconfig.json}`; create `packages/torus-scripts/test/contracts.test.mjs`; inspect existing `packages/torus-scripts/config/{rollup.config.js,tsconfig.build.js,paths.js}` and `packages/config/tsconfig.default.json`.

**Interfaces:** Produces `plain-sdk` fixture and test helpers for later preset tasks. Consumes no new presets.

- [ ] **Step 1: Record existing behavior without changing consumer packages.** From `torus-cli`, run `git status --short`, `npm ci`, `npm ls --workspaces --depth=0`, and `npm pack --workspace @toruslabs/torus-scripts --dry-run --json`. Save the output paths and exposed package surface in the task review notes, not as generated source files.
- [ ] **Step 2: Write the plain SDK fixture.** Set `package.json` to a private ESM fixture with a source entry and an external runtime dependency. Set `src/index.ts` to export both a value and a type; set `tsconfig.json` to extend the planned library config. Keep the fixture under `test/fixtures` so npm does not treat it as a workspace.
- [ ] **Step 3: Add a failing contract test.** Using `node:assert/strict`, check that the new `@toruslabs/torus-scripts/library` export exists and that a packed build exposes the named value and declaration. Expect failure before the preset exists. Add the test as `contracts.test.mjs` so `node --test packages/torus-scripts/test/contracts.test.mjs` runs without a TypeScript runner. After Task 2, also run it with `npm exec -- vp test packages/torus-scripts/test/contracts.test.mjs --run`.
- [ ] **Step 4: Define the baseline matrix.** Record default ESM-only output; optional CJS, explicit subpaths, external dependencies, version replacement, browser `Object.hasOwn`, CSS, `use client`, NodeNext, and Metro as opt-in consumer checks. Do not claim all outputs pass now.
- [ ] **Step 5: Commit the fixture and baseline test:** `git add packages/torus-scripts/test && git commit -m "test: capture shared tooling migration contracts"`.

## Task 2: Set the Runtime, Dependency, and Hardening Base

**Files:** Modify `package.json`, `.nvmrc`, `package-lock.json`, all published `packages/*/package.json`; create generated `.npmrc` and other files only if LavaMoat creates them; create `vite.config.ts`.

**Interfaces:** Provides local `vp` for subsequent tasks and an npm workspace that installs with npm 12. Does not change the published preset API yet.

- [ ] **Step 1: Capture tool versions.** Run `npm view vite-plus version`, `npm view typescript version`, `npm view @changesets/cli version`, `npm view @lavamoat/harden version`, and `npm outdated --workspaces --all`. Compare each proposed major against the approved set; stop for user approval on unrelated majors.
- [ ] **Step 2: Update manifests.** Set root and published `engines` to the agreed values, `packageManager` to the exact installed npm 12 release, root `devDependencies` to pinned tested Vite+, TypeScript, Changesets, and LavaMoat tools, and published `torus-scripts` peer dependency to a Vite+ 1.x range. Do not add Rollup or frontend plugins as shared runtime dependencies. Change `.nvmrc` to exactly `>=26.x`.
- [ ] **Step 3: Install from npm at the workspace root.** Run `npm install`, then `npm ci`. Verify `npm ls vite-plus typescript @changesets/cli` and that no `npm install` step rewrites unrelated workspaces. If a fresh install fails, diagnose before adding script exceptions.
- [ ] **Step 4: Apply actual LavaMoat defaults.** Run `npm exec -- harden defaults -p npm`, inspect the generated `.npmrc` and other changes, then run `npm exec -- harden check -p npm -l moderate` and `npm ci`. Review native tool installation and any prepack/prepare lifecycle paths; use an explicit build step for packaging instead of globally permitting install scripts.
- [ ] **Step 5: Add a minimal root Vite+ configuration** using `defineConfig` from `vite-plus`; run `npm exec -- vp check --no-fmt` to establish lint/type baseline. Do not enable type-check until TypeScript project configuration passes.
- [ ] **Step 6: Commit:** `git add package.json package-lock.json .nvmrc .npmrc vite.config.ts packages && git commit -m "chore: set npm 12 and hardened Vite+ baseline"`.

## Task 3: Publish Explicit TypeScript Profiles

**Files:** Create `packages/config/tsconfig.base.json`, `packages/config/tsconfig.library.json`, `packages/config/tsconfig.node.json`; modify `packages/config/package.json`; create `packages/torus-scripts/test/tsconfig-profiles.test.ts`.

**Interfaces:** Produces importable paths `@toruslabs/config/tsconfig.library.json` and `@toruslabs/config/tsconfig.node.json`. Consumers may extend either. The old `tsconfig.default.json` remains only until the major release cleanup.

- [ ] **Step 1: Write tests** that parse both profiles with TypeScript 7. Assert library resolution is `bundler`, Node resolution is `NodeNext`, the Node profile omits DOM libraries, and both retain `strictNullChecks: true`. Run `npm exec -- vp test packages/torus-scripts/test/tsconfig-profiles.test.ts --run`; expect missing-profile failure.
- [ ] **Step 2: Add focused JSON configs.** Base contains shared strict compiler behavior without DOM or module-resolution decisions. Library adds ESM/bundler and DOM only for browser-specific descendants; Node adds `module: NodeNext`, `moduleResolution: NodeNext`, `lib: ["ES2024"]`, and `types: ["node"]`. Do not duplicate an inherited `strictNullChecks: false`.
- [ ] **Step 3: Add explicit JSON subpath exports to `packages/config/package.json`; use the relative package file paths, not source aliases.** Test Node and TypeScript resolution from the fixture, then rerun the profile test and `npm exec -- vp check --no-fmt`.
- [ ] **Step 4: Commit:** `git add packages/config packages/torus-scripts/test && git commit -m "feat: add explicit library and Node TypeScript profiles"`.

## Task 4: Build the Plain Library Preset

**Files:** Create `packages/torus-scripts/src/presets/library.ts`, `packages/torus-scripts/src/index.ts`, `packages/torus-scripts/vite.config.ts`; modify `packages/torus-scripts/package.json`; extend `packages/torus-scripts/test/contracts.test.mjs`.

**Interfaces:** `libraryPreset(options: { entry: string | string[]; dts?: boolean; format?: Array<'esm' | 'cjs'>; sourcemap?: boolean }): { pack: ... }`. Export it at `@toruslabs/torus-scripts/library`. Return a plain config fragment for use in a consumer `defineConfig`; the consumer owns final `vite.config.ts` and all plugins.

- [ ] **Step 1: Add failing assertions** for one ESM entry, declarations enabled, CJS opt-in, and no browser polyfill, injected environment value, hidden lint task, or dependency bundling. Run `npm exec -- vp test packages/torus-scripts/test/contracts.test.mjs --run` and confirm failure before implementation.
- [ ] **Step 2: Implement the small builder** with `pack.entry`, `pack.dts`, `pack.format`, and `pack.sourcemap` from the documented Vite+ pack API. Default `format` to `["esm"]`. Keep non-builtin dependencies external as Vite+ defaults permit; if actual tsdown behavior bundles them, use documented external options after an observed failing fixture test. The proposed public contract is:

  ```ts
  export type LibraryOptions = {
    entry: string | string[];
    dts?: boolean;
    format?: Array<"esm" | "cjs">;
    sourcemap?: boolean;
  };

  export function libraryPreset(options: LibraryOptions) {
    return {
      pack: {
        entry: options.entry,
        dts: options.dts ?? true,
        format: options.format ?? ["esm"],
        sourcemap: options.sourcemap ?? true,
      },
    };
  }
  ```

- [ ] **Step 3: Add explicit package exports and published files.** Export the preset's built ESM file and generated declarations. Use `vp pack` in this package's own config; do not import `torus-scripts` from itself while packing. Run `npm exec -- vp pack` from its package directory, `npm pack --workspace @toruslabs/torus-scripts --dry-run --json`, and a Node ESM import from an installed tarball fixture.
- [ ] **Step 4: Verify `vp pack --watch` against the fixture** for one source edit; check rebuilt output. Ensure build remains separate from lint and that the entry path is not inferred from a package name.
- [ ] **Step 5: Commit:** `git add packages/torus-scripts && git commit -m "feat: publish explicit Vite+ library preset"`.

## Task 5: Add Opt-in React, Vue, and Node Profiles

**Files:** Create `packages/torus-scripts/src/presets/{react,vue,node}.ts`; modify `packages/torus-scripts/package.json` and `packages/torus-scripts/src/index.ts`; create `packages/torus-scripts/test/presets.test.ts` and fixtures under `packages/torus-scripts/test/fixtures/{react-sdk,vue-lib,node-sdk}`.

**Interfaces:** `reactPreset(): object`, `vuePreset(): object`, `nodePreset(options: { entry: string | string[] }): object`; public subpaths `/react`, `/vue`, `/node`. These are config fragments, not plugin installers or server bundlers.

- [ ] **Step 1: Write failing tests** for optional JSX and Vue boundaries and for a Node preset that does not include DOM, browser globals, CSS processing, or `process.env` replacement. Add a test that a consumer can supply its own Vite plugin without the preset removing it.
- [ ] **Step 2: Add minimal fragments.** Do not import `@vitejs/plugin-react` or `@vitejs/plugin-vue` as hard dependencies; document consumer-owned plugin setup. Keep CSS injection, `use client`, custom browser targets, assets, and SSR transforms consumer-local. For Node, keep builtins and native packages external and recommend `tsc`/Nest for decorator metadata.
- [ ] **Step 3: Run tests and fixture builds.** Run `npm exec -- vp test packages/torus-scripts/test/presets.test.ts --run` and `npm exec -- vp pack` in each fixture that has a pack config. Confirm the Node fixture runs with Node 24 and 26; do not claim Nest support from this plain fixture.
- [ ] **Step 4: Commit:** `git add packages/torus-scripts && git commit -m "feat: add opt-in framework and Node presets"`.

## Task 6: Replace Shared Lint with TypeScript-Based Packages

**Files:** Create `packages/oxlint-config-{typescript,react,vue,node}/{package.json,index.ts}` and package tests; modify `packages/torus-scripts/src/presets/{lint,vue-lint}.ts`, `packages/torus-scripts/src/index.ts`, `packages/torus-scripts/package.json`, root `vite.config.ts`, `packages/torus-scripts/test/check-presets.test.ts`, `packages/torus-scripts/README.md`, the lockfile, and the rule audit. Keep `packages/torus-scripts/src/presets/fmt.ts` and `/fmt` for Oxfmt.

**Interfaces:** `@toruslabs/oxlint-config-typescript` owns shared rules and exports `typescriptLintPreset(): OxlintConfig`; `@toruslabs/oxlint-config-react`, `-vue`, and `-node` export `reactLintPreset()`, `vueLintPreset()`, and `nodeLintPreset()`. Each derived package depends on the TypeScript package, like the old package graph. No JavaScript package, shared `torus-scripts` lint base, or `/lint` export remains. Keep `tailwindLintPreset({ entryPoint })` as an independent opt-in fragment for React and Vue consumers, not as a shared base. Root `vite.config.ts` owns the final `lint` and `fmt` blocks.

- [ ] **Step 1: Test the TypeScript base first.** Add failing tests for JS and TS unused variables and imports. Assert that the TypeScript preset excludes React, Vue, Node, and Tailwind plugins. Compare supported rules with the old TypeScript config and record gaps. Implement shared native rules inside `packages/oxlint-config-typescript` and rerun the focused tests.
- [ ] **Step 2: Test each derived package first.** Add failing tests for React and JSX rules, Vue Vize rules, and Node rules. Assert that each imports the TypeScript preset and adds only its own plugins and rules. Add the four packages and their export maps. Keep Vize as a Vue-only optional peer and Tailwind v4 as an independent opt-in fragment for React or Vue consumers; preserve the Vue and Tailwind diagnostic fixtures.
- [ ] **Step 3: Remove the superseded lint exports.** Move the lint and Vue code out of `torus-scripts`; remove `/lint` and `/vue-lint` exports and their old tests. Update the root to import `typescriptLintPreset()` and keep `formatPreset()`. Update README and audit to state known rule gaps, and update Changesets and `package-lock.json` using npm.
- [ ] **Step 4: Verify.** Run `npm ci`, `npm run check`, `npm run build`, `npm run test`, `npm exec -- changeset status`, and `npm pack --workspaces --dry-run --json`. Confirm root `vp lint` uses the TypeScript package. Check format failures with `vp fmt --check`; do not claim export sorting or full ESLint parity.
- [ ] **Step 5: Commit:** `git add packages/oxlint-config-* packages/torus-scripts vite.config.ts package-lock.json docs .changeset && git commit -m "feat: split Oxlint presets into TypeScript-based packages"`.

## Task 7: Add a Read-only Migration Diagnostic

**Files:** Create `packages/torus-scripts/src/migrate/{inspect,report,cli}.ts`; modify `packages/torus-scripts/package.json`; create `packages/torus-scripts/test/migrate.test.ts`.

**Interfaces:** `inspectProject(root: string): Promise<{ found: string[]; unsupported: string[]; next: string[] }>`; `formatReport(result): string`. `torus-scripts-upgrade <path>` prints a report and exits nonzero for unsupported configurations. It never edits files or invokes `vp migrate` on behalf of the user.

- [ ] **Step 1: Write failing tests** with temp fixtures for `torus.config.js`, `rollup.config.mjs`, `.browserslistrc`, `babel.config.js`, `tsconfig.build.json`, Lerna, and release-it scripts. Assert that custom Rollup plugins, transforms, polyfills, multi-entry assets, and nested workspace migration produce an explicit warning. Assert unchanged file bytes before and after inspection.
- [ ] **Step 2: Implement bounded inspection** using `node:fs/promises` and `node:path` only. Detect file presence and a small set of manifest scripts; do not execute or import user config. Return actionable next steps: run `vp migrate` at the workspace root, review rewritten files, select library/Node/React/Vue profiles, and configure Changesets at repository root.
- [ ] **Step 3: Pack and execute the diagnostic** in a temp npm fixture. Confirm useful output and nonzero exit for custom behavior; confirm zero exit for a plain fixture. Run `npm exec -- vp test packages/torus-scripts/test/migrate.test.ts --run`.
- [ ] **Step 4: Commit:** `git add packages/torus-scripts && git commit -m "feat: report legacy configuration migration risks"`.

## Task 8: Replace Lerna and release-it with Changesets

**Files:** Modify root `package.json`, `package-lock.json`, `lerna.json` (remove), `packages/torus-scripts/package.json`; create `.changeset/config.json` and one initial changeset; adjust published `packages/*/package.json` names/exports as needed after deciding which legacy ESLint presets remain in the transition release.

**Interfaces:** Root scripts `build`, `check`, `test`, `changeset`, `version-packages`, `release-packages`; release commands are manual and require an approval gate outside this plan.

- [ ] **Step 1: Add a failing workspace-order check.** List dependencies among packages and assert that `vp run -r build --fail-if-no-match` does not invoke Lerna. `@toruslabs/config` currently contains static JSON/JS, so do not invent a build task for it; if it gains generated output, declare its `build` task and a dependency edge before requiring build order. Run the check before replacing scripts; expect failure.
- [ ] **Step 2: Configure Changesets** with public access, `baseBranch: "main"`, private packages ignored, and an explicit decision on version grouping. Start with independent versions unless actual consumers require fixed versions; document the choice in the changeset. Add the first major changeset for `@toruslabs/torus-scripts` and `@toruslabs/config`; state the breaking export and engine changes. Do not blindly use a fixed group because the prior Lerna release was fixed.
- [ ] **Step 3: Replace Lerna scripts** with Vite+ recursive tasks for ordered builds and npm workspace selection for direct commands. Use `vp run -r build --fail-if-no-match`; use task dependency declarations where package build order is not inferred from runtime dependencies. Replace `torus-scripts release` with `changeset version` and `changeset publish` at root only. Delete the old release-it override.
- [ ] **Step 4: Verify non-publishing operations:** `npm ci`, `npm exec -- vp run -r build --fail-if-no-match`, `npm exec -- changeset status`, `npm pack --workspaces --dry-run --json`, and `npm ls lerna release-it rollup --all` (the last should have no _direct_ old tooling; transitive Rollup may exist under unrelated dependencies). Run `npm exec -- changeset status --since=main` on a feature branch when it has an actual changeset; do not require new changesets on every PR. Do not run `changeset publish` or `changeset version` against the working branch merely to test release automation.
- [ ] **Step 5: Commit:** `git add package.json package-lock.json .changeset packages/torus-scripts/package.json lerna.json && git commit -m "chore: replace Lerna and release-it with Changesets"`.

## Task 9: Remove the Legacy API and Verify the Published Package

**Files:** Remove `packages/torus-scripts/bin/torus-scripts.js`, `packages/torus-scripts/scripts/{build,start,release,lint}.js`, obsolete Rollup/Babel config and helpers used only by these commands; remove obsolete config and ESLint workspace packages only if their published replacement policy is agreed. Modify `packages/torus-scripts/README.md`, package exports, root workspaces/lockfile.

**Interfaces:** The new major exports only the documented preset and diagnostic subpaths. The old CLI must fail with an explicit migration instruction if kept as a stub; it must not silently run release-it or Rollup.

- [ ] **Step 1: Test the removal boundary.** In a packed consumer, import every documented subpath and assert legacy build/release entry points are unavailable. Verify the executable returns a diagnostic only. Run `npm exec -- vp test packages/torus-scripts/test/contracts.test.mjs --run` and inspect the tarball file list.
- [ ] **Step 2: Delete code and direct dependencies** only when `rg` and test fixtures show they have no remaining users. Remove `@babel/*`, `@rollup/*`, `rollup`, `ts-patch`, `release-it`, ESLint/Prettier, and old utility dependencies from `torus-scripts` unless a verified preset still uses them. Keep `@toruslabs/config` only if the published TypeScript profiles need it.
- [ ] **Step 3: Write concise README migration examples** for native `vp pack`, `vp check`, `vp run`, and Changesets. Include `vp migrate` workspace-root rule, ESM-by-default breaking changes, explicit exports/declarations, React/Vue/CSS/SSR exceptions, and Node/decorator/Metro exceptions. Remove outdated claims that `start` is a Vite dev server or that release-it is active.
- [ ] **Step 4: Verify `npm ci`, `vp check`, `vp test`, `vp run -r build`, `npm pack --workspaces --dry-run`, and `changeset status`.** Verify `git status --short` contains no unintentional generated output. Commit with `git commit -m "refactor!: remove legacy Rollup CLI and config"` after staging reviewed paths.

## Task 10: CI, Scanner Checks, and Publication Gate

**Files:** Create `.github/workflows/validate-pr.yml` and `.github/workflows/security-code-scanner.yml`; modify `.github/dependabot.yml`; add any repository-owned workflow test configuration only if required.

**Interfaces:** PR CI checks npm 12 on Node 24.15+ and Node 26, hardening, build, tests, pack, Changesets, and scanner results. It does not publish or deploy.

- [ ] **Step 1: Inspect GitHub settings through `gh`.** Check Dependabot alerts and security updates, secret scanning/push protection, Wiz integration coverage, code-scanning results, and current CodeQL default setup. Record enabled/disabled/unverified separately; do not retrieve secret contents. Request the needed admin/SSO rights rather than claiming an inaccessible setting is disabled.
- [ ] **Step 2: Adapt Citadel's `validatePR&deploy.yml` validation pattern, not its Docker/AWS deployment.** Use pinned SHA actions, read-only permissions on untrusted PR jobs, `npm ci`, `harden check`, `vp check`, `vp test`, `vp run -r build`, `changeset status`, and `npm pack --workspaces --dry-run`. Check `changeset status --since=main` for release-bearing changes; allow docs-only PRs without a changeset. Use explicit supported Node 24 and Node 26 matrix values, ensuring npm 12 on both. Keep publish as a separate, manually approved workflow outside this task.
- [ ] **Step 3: Adapt Citadel's MetaMask scanner with CodeQL and Semgrep OSS** or use existing GitHub CodeQL plus a separate Semgrep OSS workflow. Pick one CodeQL path; verify the scanner's nested actions and pinned references, permissions, and whether metrics/Slack tokens are optional. KICS and Trivy are excluded because this repository has no backend service or container.
- [ ] **Step 4: Run workflow validation and observe PR checks.** Check YAML syntax with an available action linter; use `gh run list`/`gh run view` to verify both languages are scanned and results upload. Enable missing GitHub settings where current access and licenses permit; seek approval for paid or organization-wide changes.
- [ ] **Step 5: Commit:** `git add .github && git commit -m "ci: validate hardened packages and run code scanners"`. Report any access blockers in the PR description.

## Task 11: Prove Representative Consumer Compatibility Before Release

**Files:** Add `packages/torus-scripts/test/consumer-matrix.test.ts` and targeted fixtures under `packages/torus-scripts/test/fixtures`; modify `packages/torus-scripts/README.md` with the verified compatibility matrix.

**Interfaces:** Consumes the packed preset tarball from Task 9. Does not change downstream repositories.

- [ ] **Step 1: Create failing tests** for the documented preset recipes: plain ESM SDK, optional CJS, React entry with `use client`, Vue entry with external CSS, and Node ESM with external builtins. Verify package exports and `.d.ts` resolution from a fresh fixture using `npm pack` plus local install.
- [ ] **Step 2: Run repository-level proof commands** without modifying their source: inspect `torus.js`, `fetch-node-details`, `tkey`, `Auth`, `wallet-services`, `web3auth-web`, and `web3auth-backend` for entry points, optional plugins, outputs, version constants, browser tests, NodeNext, and workspace order. Record a check as `proven` only after a packed fixture or a dedicated consumer branch builds/tests it. Record other cases as `requires consumer story`; do not claim global compatibility.
- [ ] **Step 3: Separate backend and native exceptions.** Include a metadata/decorator fixture that confirms why Nest/GraphQL stays on TypeScript/Nest compilation, and a Metro packaging note. Do not claim Vite replaces either build tool. Keep any custom Vue, PWA, Next.js, React Native, Docker, or AWS configuration out of the preset package.
- [ ] **Step 4: Re-run the full CI-equivalent matrix on supported Node 24 and 26.** Confirm npm 12 installs, changeset status, scanner checks, tarball import, and no unexpected produced files. Commit with `git commit -m "test: document verified preset consumer matrix"` after staging reviewed fixture/README paths.

## Review and Release Gate

- Review each task independently. In particular, reject unverified Vite+ option names, incomplete generated LavaMoat settings, or claims that a preset replaces Nest/Metro.
- Recheck the version registry just before implementation; recorded baseline versions were current on 22 October 2026, not immutable future targets.
- Before releasing the new major, present the packed tarball, new export map, Changesets preview, major-dependency approval list, security setting status, and representative consumer evidence for human approval.
- Begin downstream consumer migration only after the preset package is versioned and available. Consumer releases and security-setting changes remain in their own Jira stories.
