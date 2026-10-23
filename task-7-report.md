# Task 7 Review Fix Report

## Review findings

- Reject missing roots and roots that are not directories before scanning. The CLI prints a clear error and exits with status 2.
- Ignore empty Rollup `plugins` arrays. Warn only when a config has plugin entries or other detected custom behavior.
- Scan at most 10,000 directories, excluding `node_modules`, `.git`, and `.vite`. Inspect `.js`, `.mjs`, and `.cjs` Rollup configs as text. Do not execute config files. Include relative paths in warnings.

## Changes

- Added migration inspection, report, and CLI modules under `packages/torus-scripts/src/migrate/`.
- Added the `torus-scripts-upgrade` executable.
- Added regression tests for missing and non-directory roots, CLI exit status, empty and custom plugin arrays, non-execution of config files, and nested CJS Rollup config detection.

## Verification

- `npm exec -- vp test packages/torus-scripts/test/migrate.test.ts --run` — passed, 7 tests.
- `npm exec -- vp lint packages/torus-scripts/src/migrate packages/torus-scripts/test/migrate.test.ts` — passed.
- `npm exec -- vp fmt packages/torus-scripts/src/migrate packages/torus-scripts/test/migrate.test.ts --check` — passed.
- `npm pack --workspace @toruslabs/torus-scripts --dry-run --json` — passed; tarball includes the executable and migration modules.
- `node packages/torus-scripts/bin/torus-scripts-upgrade.js /does/not/exist` — printed the root error and returned exit status 2.
- `git diff --check` — passed.

The full package test suite was not run. The focused tests and package dry-run cover the Task 7 changes.
