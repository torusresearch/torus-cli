# Task 7 Report: Read-only Migration Diagnostic

## Summary

- Added `inspectProject(root)` and `formatReport(result)` in `packages/torus-scripts/src/migrate/`.
- Added the `torus-scripts-upgrade <path>` CLI. It reports detected legacy configuration and unsupported behavior. It returns code 1 when the scan finds unsupported behavior, and code 2 for usage or inspection errors.
- The scan uses `node:fs/promises` and `node:path`. It reads file names, package manifests, and Rollup config text. It never imports or executes a user config. It does not call `vp migrate` or write to the target project.
- The scan detects `torus.config.js`, Rollup config JS/MJS, `.browserslistrc`, Babel config files, `tsconfig.build.json`, `lerna.json`/Lerna scripts or dependencies, and release-it scripts or dependencies.
- The Rollup scan warns about custom plugins, transforms, polyfills or runtime replacements, multi-entry builds, and custom asset handling. The scan warns about nested workspaces.
- The report gives next steps to run `vp migrate` at the workspace root, review rewritten files, select a library/Node/React/Vue profile, and configure Changesets at repository root.

## Tests and checks

- Wrote the tests before the implementation. The initial `vp test` failure confirmed the diagnostic module did not exist. The environment first selected the parent checkout when run from the worktree without changing the shell directory. The command was rerun with the worktree as its current directory; that run showed the expected missing-module failure.
- `npm exec -- vp test packages/torus-scripts/test/migrate.test.ts --run` — passed, 4 tests. Coverage includes all requested file/script detections, explicit unsupported warnings, unchanged file bytes, and proof that a config side effect did not run.
- The test packs the package with `npm pack`, extracts the tarball, and executes the packed binary on two temporary npm fixtures. The plain fixture returned 0. The custom Rollup fixture returned 1 and printed `Custom Rollup plugins need a separate review.`
- Direct execution of the built CLI on temporary fixtures printed:

  - Plain fixture: `Found - No legacy configuration detected.`, `Unsupported - No known unsupported behavior detected.`, plus all four next steps; exit code 0.
  - Custom Rollup fixture: `Found - rollup.config.js`, `Unsupported - Custom Rollup plugins need a separate review.`, plus all four next steps; exit code 1.
- `npm exec -- vp pack --dts` in `packages/torus-scripts` — passed. The first `vp build` attempt failed because this package is a library and has no `index.html`; the supported Pack command then built all entries.
- `npm exec -- vp lint packages/torus-scripts/src/migrate packages/torus-scripts/test/migrate.test.ts` — passed.
- `npm exec -- vp fmt --check packages/torus-scripts/src/migrate packages/torus-scripts/test/migrate.test.ts packages/torus-scripts/package.json packages/torus-scripts/vite.config.ts` — passed.
- `git diff --check` — passed.
- npm emitted existing `devdir` and `always-auth` config warnings.

## Safety note

No user config was executed during implementation or validation. The Rollup test config contains a side effect that would write a marker file if imported; the marker was absent after inspection. The packed CLI also uses the read-only source code path.
