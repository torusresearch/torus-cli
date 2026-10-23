# Task 1 Report: Baseline Fixture and Contract Test

## Status

**Complete.** The fixture and contract test are in the requested Vite+ upgrade worktree. The test fails for the intended missing `./library` package export. No production code or consumer package changed.

## Commit

`984767c35fc1e88ce79192395d88b4665127ce8d` (`test: capture shared tooling migration contracts`). It contains only `packages/torus-scripts/test/**`.

## Runtime and baseline commands

- `node --version` → `v24.15.0`
- `npm --version` → `12.2.0`
- `git status --short` at the start showed `M package-lock.json`; the lockfile already differed in the worktree. It was restored before staging.
- `npm ci` was attempted in the worktree. It exited with `EPERM` while unlinking `node_modules/.package-lock.json`; npm warned about existing user config keys `devdir` and `always-auth`. The user-provided context records that the updated-lockfile clean install had passed earlier. No lockfile change is included.
- `npm ls --workspaces --depth=0` passed. It listed `@toruslabs/config@4.0.1`, five ESLint config workspaces at `5.0.2`, and `@toruslabs/torus-scripts@8.1.0`. Torus scripts had the legacy Babel, Rollup, release-it, and TypeScript dependencies.
- `npm pack --workspace @toruslabs/torus-scripts --dry-run --json` passed. It exposed 17 files: `README.md`, `bin/torus-scripts.js`, config files including `config/rollup.config.js` and `config/tsconfig.build.js`, helper files, `package.json`, and `scripts/{build,lint,release,start}.js`. Output artifact name: `toruslabs-torus-scripts-8.1.0.tgz` (dry-run only; no package was created).
- The first run of `node --test packages/torus-scripts/test/contracts.test.mjs` confirmed a clear test failure, not a test error: `AssertionError: @toruslabs/torus-scripts must export ./library`. The assertion is the expected missing feature.

## Inspected legacy configuration

- `packages/torus-scripts/config/rollup.config.js` builds ESM and CJS preserved-module outputs when enabled. It externalizes dependencies and peers, uses Node resolve, Babel, TypeScript/`ts-patch` in conditional paths, and can add analyzer and minifier plugins.
- `packages/torus-scripts/config/tsconfig.build.js` merges `@toruslabs/config/tsconfig.build.json`, package-level config, output/declaration paths, and `src` inclusion.
- `packages/torus-scripts/config/paths.js` resolves app entry and config paths from the current working directory. It uses `BUILD_DIR` or `dist` as output path.
- `packages/config/tsconfig.default.json` sets bundler resolution, ESNext module/target, ES2024 plus DOM libraries, strict mode with `strictNullChecks: false`, declarations, source maps, and additional strictness flags.

## Baseline matrix notes

The fixture contract sets **ESM-only output as the default**. The following remain opt-in consumer checks, and this task does not claim they pass: optional CJS output; explicit subpaths; external dependencies; version replacement; browser `Object.hasOwn`; CSS; `use client`; NodeNext; Metro.

## Changed files

- `packages/torus-scripts/test/contracts.test.mjs` — checks for the `./library` export and packed ESM/declaration files. It uses Node's built-in test runner and records the baseline matrix in a test comment.
- `packages/torus-scripts/test/fixtures/plain-sdk/package.json` — private ESM fixture package with a source entry, external `nanoid` runtime dependency, and expected dist exports/files.
- `packages/torus-scripts/test/fixtures/plain-sdk/src/index.ts` — exports `createPlainSdkId` and `PlainSdkOptions`.
- `packages/torus-scripts/test/fixtures/plain-sdk/tsconfig.json` — extends the planned `@toruslabs/config/tsconfig.library.json` profile.

## Self-review

- Scope remains limited to Task 1 test and fixture files; no consumer package or generated source changed.
- Fixture remains below `packages/torus-scripts/test/fixtures`, outside the root `packages/*` workspace glob.
- The expected red test proves the new export is absent before implementation. It stops at that assertion, so packed output assertions will exercise after the export exists and build implementation is added.
- The pack test expects `dist/index.js` and `dist/index.d.ts` in the tarball. The fixture has no `dist` output in the baseline, as intended.
- The prior lockfile delta was caused by the install attempt. It was restored and excluded.
- `npm ci` could not be freshly verified due to an operating-system unlink permission error in the worktree's existing `node_modules`; no workaround or path in the original checkout was used.

## Reviewer finding follow-up

**Status:** Fixed within Task 1's contract fixture and test only.

### Exact changes

- `packages/torus-scripts/test/contracts.test.mjs` now runs `npm exec -- vp pack` from the plain SDK fixture before packing it with `npm pack`.
- The test extracts `package/dist/index.js` and `package/dist/index.d.ts` from the tarball and checks for the named value `createPlainSdkId` and type `PlainSdkOptions`. It no longer relies on checking only file names.
- The test removes its temporary tarball directory and fixture `dist` output in `finally`.
- Added `packages/torus-scripts/test/fixtures/plain-sdk/vite.config.ts`. It imports `libraryPreset` from `@toruslabs/torus-scripts/library` and passes the fixture entry.
- No production source, package manifest, or task after Task 1 changed.

### Test evidence

- Command: `node --test packages/torus-scripts/test/contracts.test.mjs`
- Result: expected failure with exit code 1. The single test fails at the `./library` export assertion: `@toruslabs/torus-scripts must export ./library` (`actual: undefined`). This preserves red behavior while the export is missing. The pack/build and packed-content assertions run after the export exists.
- `git diff --check` passed.
