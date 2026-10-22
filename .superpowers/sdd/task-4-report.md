# Task 4 Report: Plain Library Preset

## Result

Implemented and committed the Vite+ library preset in `packages/torus-scripts`. The package now exports `@toruslabs/torus-scripts/library` from its packed ESM entry and declaration. The preset returns only the `pack` config block, with ESM, declarations, and source maps enabled by default. It also accepts CJS and explicit false values.

## Vite+ pack API observations

- The installed Vite+ 1.3.0 documentation describes `pack` configuration in `vite.config.ts` with `entry`, `dts`, `format`, and `sourcemap`.
- `vp pack` emitted `.mjs` and `.d.mts` for ESM, not `.js` and `.d.ts`. The package export and fixture exports point to those actual paths.
- The plain SDK fixture import from `nanoid` stayed external in the packed JavaScript. Its installed-tarball ESM import passed.
- The package-local config packs `src/index.ts` directly. It does not import the package from itself. Vite+ emitted the configured package index as `dist/index.mjs` and `dist/index.d.mts`.
- Vite+ help lists pack flags such as `--deps.never-bundle`, but this task did not need an external option because observed tsdown output kept `nanoid` external by default.

## Commands and results

- `npm exec -- vp test packages/torus-scripts/test/contracts.test.mjs --run` — passed (1 test). This checks the preset defaults and overrides, build output, declarations, tarball contents, external dependency handling, no browser/env additions, installed ESM import, and `--watch` rebuild after a fixture source edit. The test restores the source and removes generated fixture output.
- `npm exec -- vp test packages/torus-scripts/test/tsconfig-profiles.test.ts --run` — passed (5 tests).
- `npm exec -- vp pack` from `packages/torus-scripts` — passed. Emitted `dist/index.mjs`, `dist/index.d.mts`, and source map.
- `npm pack --workspace @toruslabs/torus-scripts --dry-run --json` — passed. It listed the package entry, declaration, map, bin, package metadata, and README.
- The contract test was first converted from `node:test` to the installed Vitest runner. Its first meaningful red run failed because the `./library` export did not exist. The green run passed after adding the preset and package export.

## Notes

The environment prints npm warnings for existing `devdir` and `always-auth` config keys. These warnings did not stop tests, pack, or the dry run.

## Task 4 review cleanup-race fix

Updated the `--watch` cleanup to attach its `exit` listener before sending `SIGTERM`, then await the exit promise. This avoids missing a fast child-process exit.

Command: `npm exec -- vp test packages/torus-scripts/test/contracts.test.mjs --run`

Exact output:

```text
npm warn Unknown env config "devdir". This will error in a future major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown user config "always-auth". This will stop working in a future major version of npm. See `npm help npmrc` for supported config options.
npm notice run npx
npm notice run 'vp' test packages/torus-scripts/test/contracts.test.mjs --run

 RUN  v5.0.5 /Users/chai/source/torus/torus-cli.worktrees/vite-plus-upgrade


 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  21:33:06
   Duration  3.42s (tests 99%)
```

### Follow-up: exit promise timing

Created the watcher exit promise immediately after `spawn`, before attaching build listeners or awaiting build events. This lets cleanup await an exit that occurs before the test reaches its `finally` block.

Command: `npm exec -- vp test packages/torus-scripts/test/contracts.test.mjs --run`

Exact output:

```text
npm warn Unknown env config "devdir". This will error in a future major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown user config "always-auth". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm notice run npx
npm notice run 'vp' test packages/torus-scripts/test/contracts.test.mjs --run

 RUN  v5.0.5 /Users/chai/source/torus/torus-cli.worktrees/vite-plus-upgrade


 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  21:38:42
   Duration  3.20s (tests 100%)
```
