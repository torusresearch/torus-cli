# Task 7 Report: Read-only Migration Diagnostic

## Summary

- Kept the nested-workspace warning from `b299582`.
- The inspector rejects a missing root or a root that is not a directory. The CLI reports inspection errors with exit code 2.
- Empty plugin arrays and comments do not cause a warning. Non-empty plugin arrays do.
- A bounded directory walker scans for `rollup.config.js`, `rollup.config.mjs`, and `rollup.config.cjs`. It lists each detected config by relative path and reports custom behavior.
- The inspector reads config text. It does not import or execute user configs, and it does not change project files.
- The report lists detected files and actionable next steps.

## Evidence and checks

- Confirmed the worktree is `/Users/chai/source/torus/torus-cli.worktrees/vite-plus-upgrade`, branch `feat/vite-plus-upgrade`, starting at `b299582`.
- Added tests first. The first target-branch run failed on the expected missing-root, plugin-array, nested-config, and CLI-code behaviors.
- `npm exec -- vp test packages/torus-scripts/test/migrate.test.ts --run` — passed; 9 tests. Tests cover root validation, empty/commented and non-empty plugin arrays, nested JS/MJS/CJS config paths, nested workspace warning, no config execution or file writes, and CLI exit codes 0, 1, and 2.
- `npm exec -- vp pack --dts` from `packages/torus-scripts` — passed. The test packs the package and runs its CLI on temporary projects.
- `npm exec -- vp lint packages/torus-scripts/src/migrate packages/torus-scripts/test/migrate.test.ts` — passed.
- `npm exec -- vp fmt --check packages/torus-scripts/src/migrate packages/torus-scripts/test/migrate.test.ts packages/torus-scripts/package.json packages/torus-scripts/vite.config.ts .superpowers/sdd/task-7-report.md` — passed.
- `npm pack --dry-run` from `packages/torus-scripts` — passed; the package includes its CLI and migration modules.
- npm printed existing `devdir` and `always-auth` config warnings.

## Next actions

1. Run `torus-scripts-upgrade <path>` on the project root.
2. Review all detected files and unsupported warnings.
3. Run `vp migrate` at the workspace root. Review rewritten files before acceptance.
4. Select the correct profile for each package. Configure Changesets at the repository root.

## Safety

The Rollup test config has a file-write side effect. The test confirms inspection does not create its marker. The CLI only scans files and package manifests.
