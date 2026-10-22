# Task 8 Report: Replace Lerna and release-it with Changesets

## Scope and decisions

- Replaced the root Lerna commands with Vite+ and Changesets scripts. Recursive builds use `vp run -r build --fail-if-no-match`.
- Added `vp pack` as the `@toruslabs/torus-scripts` build task. `@toruslabs/config` remains static JSON/JS; it has no build task.
- Removed the root `lerna` development dependency and `lerna.json`. Removed the `release-it` dependency from `@toruslabs/torus-scripts`, its root override, the legacy release script and CLI route.
- Kept the ESLint preset packages and their package manifests unchanged. Changesets ignores `@toruslabs/eslint-config-javascript`, `@toruslabs/eslint-config-node`, `@toruslabs/eslint-config-react`, `@toruslabs/eslint-config-typescript`, and `@toruslabs/eslint-config-vue` until Task 9 decides their future.
- Chose independent versions. No known consumer requires synchronized versions. The initial changeset marks `@toruslabs/torus-scripts` and `@toruslabs/config` as major. It documents breaking exports and Node.js/npm engine changes.
- Root release and version scripts are manual only. A release approval gate is external. No publishing or versioning command was run.

## Workspace-order test (TDD)

Before changing scripts, ran a Node assertion against the required root build script, Lerna references, and static config task status. It failed as expected because the root had no recursive Vite+ build script. Separately, ran `npm exec -- vp run -r build --fail-if-no-match` before adding a package build task; it failed with `Task "build" not found`. After adding only the `torus-scripts` build task, the recursive command passed and built that package. The config package did not receive a build task.

## Verification

- `npm ci` — passed. npm reported 18 audit findings and blocked install scripts for `fsevents` and `unrs-resolver` under the current allowScripts policy.
- `npm exec -- vp run -r build --fail-if-no-match` — passed; built `@toruslabs/torus-scripts`.
- `npm exec -- changeset status` — passed; reports major bumps for `@toruslabs/config` and `@toruslabs/torus-scripts`.
- `npm exec -- changeset status --since=main` — passed after staging the changeset; reports the same major bumps.
- Reviewer P1 correction: set `privatePackages.version` to `false` and removed the unsupported `privatePackages.publish` option. No focused Task 8 test exists. The installed `@changesets/config` 4.0.1 schema allows `privatePackages.version` as a boolean and does not define `publish`; `npm exec -- changeset status` and `npm exec -- changeset status --since=main` both passed after the correction and report major bumps for `@toruslabs/config` and `@toruslabs/torus-scripts`.
- `npm pack --workspaces --dry-run --json` — passed. The five legacy ESLint packages remain in the pack results. `@toruslabs/torus-scripts` includes generated `dist` output.
- `npm ls lerna release-it rollup --all` — passed. No Lerna or release-it packages remain in the tree. Rollup remains transitively under `@toruslabs/torus-scripts` and its Rollup plugins, as required for the existing scripts.
- `npm run check` — failed on formatting issues in 22 workspace files; none were changed to keep scope limited.
- `npm test` — passed. Five test files and 30 tests passed.
- `git diff --check` — passed.

## Commands not run

Did not run `changeset publish` or `changeset version`. Did not run any publishing or release action.
