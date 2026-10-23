# Task 3 Report: Explicit TypeScript Profiles

## Result

Implemented explicit library and Node TypeScript profiles for `@toruslabs/config`. Both profiles extend a shared strict base. The library profile uses bundler resolution and DOM libraries. The Node profile uses NodeNext resolution, `ES2024`, and Node types without DOM libraries. The package exports both profile JSON paths.

The legacy `tsconfig.default.json` remains unchanged for the planned major-release cleanup. Both profiles keep `strictNullChecks: true`, as required.

## Verification

- Test-first run: all four new tests failed because profile files and exports were missing.
- `npm exec -- vp test packages/torus-scripts/test/tsconfig-profiles.test.ts --run`: passed (4 tests).
- The test checks effective compiler options and Node plus TypeScript resolution from the plain SDK fixture.
- `npm exec -- vp check --no-fmt`: passed with zero errors; three pre-existing lint warnings remain in `rollup.config.js` and `formatRollupStats.js`.
- Prettier check for changed files: passed.
- Node resolution of both profile exports from the fixture: passed.
- The fixture's effective config has `strictNullChecks: true`.
- Task 3 review regression: added explicit exports and fixture-based Node resolution checks for both new profiles and all five shipped legacy subpaths (`tsconfig.default.json`, `tsconfig.build.json`, `torus.config.js`, `babel.config.js`, and `babel-test.config.js`).
- Regression TDD: the new assertion failed before the package export fix because `./tsconfig.default.json` was not exported; it passed after the fix (5 tests).
- `npm exec -- vp test packages/torus-scripts/test/tsconfig-profiles.test.ts --run`: passed (5 tests).
- `npm exec -- vp check --no-fmt`: passed with zero errors; the same three existing lint warnings remain.

## Approved TypeScript Version Deviation

The brief requests TypeScript 7. This test run used installed TypeScript `5.9.3`, as approved, because TypeScript ESLint peer ranges do not support TypeScript 7 yet.

## Commit

`feat: add explicit library and Node TypeScript profiles`
