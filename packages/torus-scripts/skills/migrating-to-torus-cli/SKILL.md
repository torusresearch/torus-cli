---
name: migrating-to-torus-cli
description: >-
  Use when moving an existing consumer project from old Torus scripts, ESLint
  presets, or build tools to current Torus CLI and Vite+ presets. Also use when
  planning a Web3Auth stack upgrade, an EMBED tooling/dependencies/security
  story, a torus-scripts 9 migration, or a forked-agent plan for that upgrade.
  The epic is always EMBED-573. Ask which story ticket to follow when the
  conversation does not already name it.
---

# Migrate a consumer to Torus CLI

If the user asked for a Web3Auth stack upgrade, an EMBED story, or a forked-agent plan, follow Stack upgrade and use the migration sections when a step points at them. Otherwise follow Inspect, Migrate, Monorepos, and Verify. Do not run the stack upgrade steps for a plain migration.

Use `node_modules/@toruslabs/torus-scripts/README.md` in an installed consumer, or `packages/torus-scripts/README.md` in this repository, as the current source for presets, commands, and known lint gaps. A successful diagnostic does not prove that a project is ready to migrate.

Do not commit this skill into the consumer repository. Read it from `node_modules`. A committed copy goes stale against the installed package version.

## Inspect before changes

1. Find the consumer's workspace root. Check `git status`, Node and npm versions, lockfile, scripts, TypeScript profiles, build output, package entry points, lint rules, format rules, tests, and release steps.
2. Use the installed `torus-scripts-upgrade <absolute-consumer-path>` diagnostic, or build this repository's `@toruslabs/torus-scripts` package first if working from source. The diagnostic reads files only. Record its output and exit code.
3. Also inspect files that the diagnostic does not cover. In particular, check `package.json` scripts and entry paths, `eslint.config.*`, `tsconfig.json`, and README claims. If the diagnostic reports nothing, do not skip this step.
4. Identify behavior the new presets do not provide. Stop and ask before removing or changing a required output format, path, browser target, polyfill, CSS behavior, release step, or custom transform. A diagnostic exit code of 1 requires separate review.

## Migrate

1. Agree on the required outputs and checks before editing. Preserve existing work; do not overwrite unrelated changes.
2. Run `vp help` and `vp help migrate` for the installed Vite+ version. Run `vp migrate` at the consumer workspace root, not in each package. Review its diff before manual edits. If it cannot run, report why; do not claim it ran.
3. Replace old `torus-scripts` commands with the documented `vp` tasks and package presets. Use a consumer-owned `vite.config.ts` for `pack`, `lint`, and `fmt`. Select the TypeScript profile that fits the package. Keep framework plugins in the consumer. If Vite+ cannot read a YAML Prettier config, compare its settings with `formatPreset()` before removing Prettier.
4. Do not assume `libraryPreset` preserves CJS paths, old bundles, browser targets, polyfills, or CDN output. Compare built files with `main`, `module`, `types`, `exports`, `unpkg`, and `jsdelivr`. Test both `require` and ESM import. A new ESM build can fail if it imports named exports from a CommonJS dependency. Do not describe an external-import ESM build as a standalone CDN script.
5. Replace removed ESLint packages only after testing equivalent Oxlint rules. Check Vue template-only and Vue script lint gaps separately. If Tailwind lint is used, merge `jsPlugins`, `rules`, and `settings` rather than spreading fragments over one another. Check that presets and TypeScript profiles exist in the target registry; use local packages only for an explicitly local test.
6. Keep or replace release automation deliberately. The current guide uses Changesets at the workspace root; a standalone package can retain `npm publish` until its release process is set up.
7. Review `vp migrate` warnings. It can skip YAML Prettier configs, ESLint rules, or plugin references and change Vitest versions. Check the new TypeScript profile for browser globals and stricter type errors. Check the selected Node runtime against preset engine requirements.

## Monorepos moving off Lerna

1. Map Lerna's workspace, build order, version, and publish tasks before removing it. Run `vp migrate` once at the workspace root. Give each package its own `build` task. Use `vp run -r build` at the root, and verify dependency order and each package's output. Put `vp run` options before the task name, as in `vp run -r --fail-if-no-match build`. `vp run` forwards arguments after the task name to the task, and npm lifecycle scripts fail on unknown options with `EUNKNOWNCONFIG`.
2. Preserve public package paths before changing their manifests. For packages that expose `dist/lib.esm/index.js` and `dist/lib.cjs/index.js`, use a consumer-owned `vite.config.ts` with explicit output directories. Vite+ writes the CJS declarations to `dist/lib.cjs/index.d.ts`. If the old manifest pointed `types` at `dist/lib.cjs/types/index.d.ts`, change the `types` field to the new path. Also change `exports["."].types` when it points at that old file. TypeScript uses the `exports` path and ignores the top-level `types` field. Packages such as `@toruslabs/constants` and the other fetch-node-details packages set `exports["."].types` to `./dist/lib.cjs/types/index.d.ts`. Leaving that path makes `import ... from "@toruslabs/constants"` fail typechecking after `vp pack`. A package with no `exports` map, such as `@toruslabs/torus-embed`, only needs the top-level `types` field. Do not copy the file back into the old folder. Adapt this pattern to the installed Vite+ version:

```ts
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: "src/index.ts",
    format: {
      esm: { outDir: "dist/lib.esm" },
      cjs: { outDir: "dist/lib.cjs" },
    },
    dts: true,
    outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
    sourcemap: true,
  },
});
```

3. Set up Changesets at the workspace root when replacing Lerna releases. Set `baseBranch` to the actual branch. Put only packages that must share a version in `fixed`. Use `access: "public"` for public scoped packages; decide whether private packages should version (`privatePackages.version`) and verify internal dependency updates. Check release scripts and published tarballs before removing old release tasks.
4. Select `@toruslabs/config/tsconfig.library.json` for libraries and `tsconfig.node.json` for Node packages only after confirming those files exist in the installed registry version. For a standalone server, set `rootDir: "./src"` in its package tsconfig if the shared profile resolves it against the wrong directory. Check output layout and type errors after changing profiles.
5. If a required preset has not been published, test with local packages only by explicit agreement. Keep local paths out of committed manifests and lockfiles. Separate local build results from clean registry installation; do not call the migration complete until the registry install and package checks pass.

## Verify and report

Run the consumer's install, build, lint/check, typecheck, and tests when available. Inspect package contents and import/require entry points if published files changed. If browser tests fail, separate missing browser executables from test failures and browser timeouts. Report each command and result, preserved behavior, manual follow-up, and any check you could not run. Never report a migration as complete if package outputs or lint coverage remain unverified.

Example: A project can get “No known unsupported behavior detected” while its `package.json` entry paths still point at old bundle folders. Inspect the scripts and published paths before changing it.

## Stack upgrade

Plan the upgrade. The user commits. Do one step at a time when they ask to implement.

### Tickets

The epic is always [EMBED-573](https://consensyssoftware.atlassian.net/browse/EMBED-573).

The story changes per repository. If this conversation does not already name the story key, ask which ticket to follow and wait. Do not guess from the open workspace or from an earlier repository.

Fetch both issues from `consensyssoftware.atlassian.net` before planning. Use the story for the repository, source, and repository-specific acceptance checks. Use the live epic text for the shared acceptance criteria.

Read the story's **Sequence and prerequisites** section before choosing dependency versions. That section is the list of releases this repository adopts. Classify each entry:

- **Release-adoption gate** or **direct runtime package prerequisite**: install that package's latest published release. Look it up with `npm view <package> version` during this run. Ignore the 3-day window (`min-release-age` and Dependabot cooldown) and install with `npm install --min-release-age=0`. A range already in `package.json` is not a reason to stay on an older major.
- **Shared tooling** (`torus-cli` / `@toruslabs/torus-scripts`): install the published `@toruslabs/torus-scripts` that contains this skill, also with `--min-release-age=0`. The epic text may still say `9.0.0`. Do not install an older release than the copy being read.
- **Anything else** in that section: follow the wording. Step 4 does not bump packages the section does not list. Step 7 raises those other direct ranges on the same major.

A release-adoption gate with no published release blocks the dependency bump. Name the package and stop that step. A publish date inside the 3-day window does not block it.

### Working agreement

- Default output is a step plan for forked agents. Do not edit, commit, push, publish, or open a PR unless the user asks to do a step.
- When they ask to do a step, do that step only, then stop. The user commits and pushes. Do not commit or push.
- Step 1 creates `feat/embed-<story-number>-stack-upgrade` from the default branch. Stay on a branch they already created.
- Write each step so a new agent can do it without this chat: repo, org, default branch, package manager, versions, files, and the stop condition.
- Read **Notes to consider** before planning or implementing. A fork does not report its later turns back to the parent chat.

### Version overrides

Versions for a new major come from **Sequence and prerequisites**, not from memory of another repository. Step 7 raises every other direct range on the same major.

`@types/node` is the exception. It follows major 26, the same major as `.nvmrc`, even when **Sequence and prerequisites** does not list it. Step 5 installs that major. Step 7 only raises it within 26.

Keep `cooldown.default-days: 3` in `dependabot.yml` and `min-release-age=3` in `.npmrc` for later updates. The install that resolves the section's packages uses `--min-release-age=0`.

### Plan

Copy this checklist into the plan and fill the repo-specific blanks.

```
- [ ] 1. GitHub policy files
- [ ] 2. Draft pull request body
- [ ] 3. Read-only diagnostic
- [ ] 4. Runtime prerequisites
- [ ] 5. Tooling migration
- [ ] 6. CI, release PR, and security scanner
- [ ] 7. Update dependencies and audit
- [ ] 8. Package.json cleanup
- [ ] 9. Verify and finish the draft
```

#### 1. GitHub policy files

Create `feat/embed-<story-number>-stack-upgrade` from the default branch when that branch does not already exist, and check it out. Stay on it when it already exists.

Touch only `.github/CODEOWNERS`, `.github/PULL_REQUEST_TEMPLATE.md`, and `.github/dependabot.yml`. Leave workflows for step 6.

CODEOWNERS follows `origin`'s org. See [reference.md](reference.md). Product owners cover directories that exist. A single package gets `src/` and `test/`. Add `packages/`, `demo/`, or `examples/` only when those directories exist.

PR template includes Motivation and Context above Jira Link. Dependabot covers npm (or the repo's package manager) and github-actions, weekly, with a 3-day cooldown.

Stop after the branch exists and those files are in place. Do not commit or push.

#### 2. Draft pull request body

Write the body from the template copied in step 1. Fill motivation, the story link, and the EMBED-573 link. Mark a breaking change when engines or published entries change. Leave testing as a checklist for step 9.

Create that pull request as a draft with `gh pr create --draft` against the default branch. Do not commit or push. If the branch is not on the remote, stop and give the user the body. The draft waits until they push.

#### 3. Read-only diagnostic

Read the Inspect, Migrate, Monorepos, and Verify sections in this skill, and the README from the same package version. To load this skill in Cursor, copy the skill directory from `node_modules/@toruslabs/torus-scripts/skills/migrating-to-torus-cli/` to `.cursor/skills/migrating-to-torus-cli/`. Do not commit that copy, and do not add it to `.gitignore`. The default `.git/info/exclude` is comments only, so an untracked `.cursor/` still shows in `git status`. Append `.cursor/` to `.git/info/exclude` when `git check-ignore` does not already match that path.

Run `torus-scripts-upgrade` on the repo root and record its exit code and findings. Also inspect `package.json` scripts and entry points, ESLint config, `tsconfig`, Babel, Prettier, and release scripts. Do not edit build files.

#### 4. Runtime prerequisites

Use the release-adoption gates and direct runtime package prerequisites from **Sequence and prerequisites**. Skip this step when that section lists none.

Bump each of those packages to the latest version resolved for this run, including a release inside the 3-day window. Install with `--min-release-age=0`. Fix call sites only where the new types fail. Leave every other direct range for step 7. Leave engines, tooling, and CI for later steps.

#### 5. Tooling migration

Follow the Migrate and Monorepos sections in this file, then apply the epic rules below. A single package copies its file shape from [eccrypto](https://github.com/torusresearch/eccrypto), including when `origin` is MetaMask. A monorepo copies its file shape from the newest completed sibling on `origin`'s org. CODEOWNERS still follows `origin`'s org. See [reference.md](reference.md).

Apply the epic rules that fit this repository:

- Keep the repo's npm or Yarn choice. Upgrade Yarn Classic to stable Yarn 4.16+ with the node-modules linker.
- `engines.node` `>=24.22.0`, `engines.npm` `>=12`, `.nvmrc` `26`.
- `@types/node` uses major 26, the same major as `.nvmrc`. Set the range to the newest `26` release older than `min-release-age` (3 days). Look it up with `npm view` during the run. A range already on 25, or any older major, still moves to 26. Install with `--min-release-age=0` only when that 26 release is still inside the window. Fix call sites only where the new types fail.
- `@lavamoat/harden` at moderate level, plus the `.npmrc` in [reference.md](reference.md).
- Latest stable TypeScript, `@toruslabs/config@5`, the `@toruslabs/oxlint-config-*` preset for the project type, and `formatPreset()`.
- `@toruslabs/config@5` sets `strictNullChecks` and drops DOM libs. Add DOM libs for browser packages and fix the new type errors.
- Extend `@toruslabs/config/tsconfig.library.json` or `@toruslabs/config/tsconfig.node.json`. Do not extend a relative `node_modules` path. Typecheck that package after the change.
- Remove a direct `eslint` devDependency. The Oxlint preset loads `eslint` as a transitive peer. After `npm run lint` reports 0 errors, remove `eslint-disable` comments for rules Oxlint does not run. Leave comments for rules Oxlint does run. `.eslintcache` stays gitignored. Delete the local file.
- `libraryPreset()` needs `entry`. Pass `format: ["esm", "cjs"]` with explicit `dist/lib.esm` and `dist/lib.cjs` dirs when consumers need CommonJS. Point `types` at `dist/lib.cjs/index.d.ts` when that is where Vite+ writes declarations.
- Keep required runtime dependencies external. Compare the build with `main`, `module`, `types`, `unpkg`, and `jsdelivr`.
- Replace `torus-scripts` CLI scripts with `vp` tasks. `version-packages` runs Changesets and then updates the lockfile. `release-packages` is `changeset publish` and is not run here.
- Changesets `baseBranch` is the real default branch. `access` is `public` for published packages.
- Retarget an existing lint-staged config to `vp fmt` and `vp lint --fix`.
- Record ESLint rules the Oxlint preset does not replace.
- For Vue, install `oxlint-plugin-vize` and add a separate template-only check. Merge a Tailwind lint fragment field by field.
- Remove a `@babel/runtime` peer only after the build shows it is unused, and record that in the changeset.

Run `vp help`, `vp help migrate`, and `vp migrate` at the workspace root, then review the diff before further edits.

#### 6. CI, release PR, and security scanner

Replace the old test workflows. Copy current action pins from the same reference at execution time: eccrypto for a single package, the newest completed sibling on `origin`'s org for a monorepo.

- `validate`: pull requests and the default branch; Node `24.22.0` and `26`; install npm 12 for npm repos; `npm ci` (or Yarn equivalent); `npm exec --no -- harden check --package-manager npm`; check; `npm run build`; typecheck; tests. Then `npm pack --dry-run --json`, or `npm pack --workspaces --dry-run --json` in a monorepo. Typecheck does not run `vp pack`. `npm run pack` writes tarballs. Skip `changeset status` on `changeset-release/*` and `dependabot/*`. On npm 12, `npx --no-install` still contacts the registry, so the harden step uses `npm exec --no`. Playwright install stays a separate `npm exec` step. `harden check` defaults to moderate.
- `release-pr`: `workflow_dispatch` only, job limited to the default branch, `changesets/action` v2 pinned to a commit SHA, version script updates the lockfile. It opens or updates the release PR. It does not publish.
- `security-code-scanner`: the MetaMask reusable workflow from [torus-cli #123](https://github.com/torusresearch/torus-cli/pull/123). Resolve the current pin from that reference's `.github/workflows/security-code-scanner.yml`. `scanner-ref` matches that pin. Ignore `node_modules`, `dist`, `build`, and `coverage`. Do not add a second CodeQL workflow. Do not copy the torus-cli package test or its changeset.

Drop `legacy-peer-deps` from `validate`, deploy, and `release-pr`. Confirm with `npm ci` on npm 12, not with `npm ls`. An optional peer mismatch is not a failed install. Add the flag only after a current install fails without it.

Add KICS and Trivy only for backend, container, or infrastructure. Add the AWS role and Wiz sensor only when this repo already deploys. Record items that do not apply.

#### 7. Update dependencies and audit

Update every direct dependency, devDependency, peerDependency, and override. Move each declared range to the newest release on the same major that is older than `min-release-age` (3 days). `npm view <pkg> version` ignores that window, so check the publish time. A range that already accepts the version still moves up to that release, including a peer range. `"vite": "^1.0.0"` becomes `"vite": "^1.4.0"` when `1.4.0` is that release. Refresh the lockfile with the npm major CI uses (npm 12). Update an `allowScripts` pin when the installed version changes.

Do not cross a major unless **Sequence and prerequisites** lists that package. `@types/node` is already on major 26 from step 5. Raise it only within 26, to the newest release older than the window. Do not move a version another tool pins exactly (`vite-plus` pins `vitest` and `@vitest/browser-playwright` at `5.0.5`). Also leave a direct dependency whose next release requires that pin: `@vitest/coverage-istanbul@5.1.0` requires `vitest@5.1.0`, so it stays at `5.0.5`. Leave a release inside the 3-day window for the next Dependabot pass, except packages from **Sequence and prerequisites**, which stay on the version installed in step 4.

Compare `npm audit` (or Yarn) with Dependabot. An in-range fix updates the lockfile only. Do not force a major with an override when that changes the API. Re-run `harden check` after each dependency update. List alerts left open and why. Leave Dependabot dismissal to the user.

#### 8. Package.json cleanup

Check every `package.json` entry and remove one only when this repository does not use it. Cover `dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`, `overrides`, and `allowScripts`. Leave `engines`, `devEngines`, and `scripts` alone unless a removed package is the only reason a script exists.

Search the repo outside `node_modules`, `dist`, and the lockfile. Then check the dependency list of each package you keep. A package another dependency already installs can still stay when this repo imports it or a script runs it.

- Remove a direct dependency that nothing imports and no script or CI step runs. `rimraf` and `tsx` are leftovers from the old `torus-scripts` scripts. Confirm the kept packages do not depend on them.
- Remove a direct `vite` or `vitest` devDependency when `vite-plus` already depends on those exact versions. Keep `vite-plus`. Keep the `vite` and `vitest` overrides: the `vite` override points every `vite` install at `@voidzero-dev/vite-plus-core`, and the `vitest` override holds the version `vite-plus` pins. Keep `@vitest/browser-playwright` and `@vitest/coverage-istanbul` while the test config uses them, on the versions from step 7.
- Keep `@lavamoat/harden`, `@changesets/cli`, `typescript`, `@toruslabs/config`, the Oxlint preset, `@toruslabs/torus-scripts`, `playwright`, and `@types/*` packages the compiler still resolves. Keep `husky` and `lint-staged` when `prepare` and the pre-commit hook use them.
- Remove an override when a lockfile refresh without it resolves the same version, and the override is not a security floor or a tool pin. The old `esbuild` override is that case once `tsx` is gone and Vite no longer installs `esbuild`. Confirm with `npm install --package-lock-only` on npm 12. Put the override back if the resolved version changes.
- Under `allowScripts`, remove a `pkg@version` pin that is not in the lockfile. `fsevents@2.3.2` leaves with `tsx`. Keep a pin for an installed package that has an install script. `false` means the script does not run, so `fsevents@2.3.3` stays while Vite installs that version. When a removal changes the installed version of a package that still has an install script, update that pin.

Leave `devEngines` as the reference writes it: `packageManager` `npm` `>=11.17.0` with `onFail` `error`. That check is for contributors. `engines.npm` stays `>=12`.

Refresh the lockfile with npm 12. Run check, build, and typecheck. Do not commit.

#### 9. Verify and finish the draft

Clean install, check, build, typecheck, and tests on Node 24 and 26. Inspect the packed tarball and both `require` and import when the package publishes both. Run browser and service checks the story asks for.

Do not publish.

Finish the step 2 PR body: majors, export and types paths, scan coverage, open alerts, checks that did not run, and the GitHub setting that lets Actions open the release PR. Publish stays manual on the default branch after that PR merges.

### Notes to consider

These were settled on torus-ui ([PR #370](https://github.com/torusresearch/torus-ui/pull/370), EMBED-592) by two forks of the review chat. Apply the lesson to the repository in front of you. A major upgrade is allowed for a package listed in **Sequence and prerequisites**, and for `@types/node` major 26. Step 7 raises every other direct range on the same major.

#### Forks on one branch

- The parent chat keeps only the turns from before the fork. Look up the other forks before editing the same branch.
- Pull before you commit. Name commits that were already on the branch. A push publishes every local commit, including ones another fork made.
- The torus-ui split after the shared comments: one fork took 6, 7, 8, and 10; the other took 5, 9, and 12. Comments 1, 2, and 4 landed once. There is no comment 11.

#### Step 5

- Declare every package a workspace imports. `oxfmt` and `@toruslabs/torus-scripts` in a child package are not covered by the root `package.json` or by hoisting. When adding `oxfmt`, pin the version already resolved by vite-plus. Leave unrelated lockfile `dev` flags alone.
- `oxfmt` formats SVG only when the filename passed to it ends in `.html`. The icons lint script already did that with Prettier. The files on disk stay `.svg`. Log the error in that script's `catch` before `process.exit(1)`.
- `@ts-expect-error` on `TS2590` fails typecheck with `TS2578` once the diagnostic disappears. `@ts-ignore` is acceptable there when the user will replace it with a real type later. Keep the `TS2590` explanation on the comment.
- `?? ""` changes runtime behavior. An empty string then matches a missing value. Guard with `!== undefined`.
- Type element refs as `ref<HTMLElement | null>`. Check them again after `await`. A check before `computePosition` does not cover the property read after it.
- The Vue template lint script must `throw result.error` when `spawnSync` fails. Ignore the temp oxlintrc it writes.
- Merge `tailwindLintPreset` into `vueLintPreset` field by field (`jsPlugins`, `rules`, `settings`). A single spread replaces `jsPlugins` and drops `oxlint-plugin-vize`. Install `oxlint-tailwindcss`. Record that those rules read JSX and `className`, and they do not read `class` inside a Vue `<template>`.
- Import a workspace package by its name when Node already resolves it. Skip a `tsconfig` path mapping for that package.

#### Step 6

- For a monorepo whose packages use `src/` and `test/`, copy those two lines from the newest wallet-services sibling on the same org. When product code lives in other folders, use the `packages/*/*/` pattern in the review notes below. The single-package block in [reference.md](reference.md) is the fallback. Do not assign a bare `packages/` line to the product team.

#### Short review comments on the same PR

These are the one-line comments on torus-ui PR #370. Apply the ones that match the repository in front of you.

- **`npm exec`.** Required in step 6. The harden step is `npm exec --no -- harden check --package-manager npm`.
- **`legacy-peer-deps`.** Required in step 6. Drop it from `validate`, deploy, and `release-pr` unless a current `npm ci` on npm 12 fails without it.
- **CODEOWNERS when packages are not `src/` and `test/`.** wallet-services uses `packages/*/src/` and `packages/*/test/`. torus-ui keeps source in other folders (`common/`, icon categories) and keeps config at the package root. Use:

  ```
  packages/*/*/                   @<org product team>
  ```

  A trailing slash matches that directory and everything inside it. Files in the package root (`package.json`, `vite.config.ts`, `tsconfig.json`, `index.ts`) stay with admins through the `*` fallback. `scripts/` and `.storybook/` match because they are directories. A bare `packages/` line gives product owners those root files too.

- **`tsconfig` `extends`.** Required in step 5. Extend `@toruslabs/config/tsconfig.library.json` or `@toruslabs/config/tsconfig.node.json`, not a relative `node_modules` path.
- **Update dependencies.** Required in step 7 for every direct dependency, not only packages a reviewer named. A declared range left below the newest same-major release outside the 3-day window makes `npm ci` fail with `ETARGET` once that release ages in.
- **Vue templates.** The separate check runs the `oxlint-vize` binary from `oxlint-plugin-vize`. Do not parse templates by hand.
- **Why `eslint` is still installed.** Required in step 5. Remove a direct `eslint` devDependency. Remove `eslint-disable` comments for rules Oxlint does not run only after lint reports 0 errors.

### Done when

Every shared EMBED-573 bullet is mapped to a step or marked as not applying to this repository, with the reason. Story-specific acceptance checks are included. The plan quotes **Sequence and prerequisites** and names the latest version installed for each package in it, including packages published inside the 3-day window. It also names the `@types/node` 26 release installed in step 5.
