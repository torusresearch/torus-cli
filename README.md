# torus-cli

Torus CLI and devtools

## Packages

| Package                                   | Description                              |
| ----------------------------------------- | ---------------------------------------- |
| [🚀 `create-torus-app`](/packages/create) | The easiest way to get started with Web3 |

TODO:

- esm, cjs bundles without bundling
- Add torus-scripts lint (eslint + typescript checks)
- esm, cjs bundles with bundling
- Add only one export (.) - should include all files in dist folder
- main, module, exports point to without bundled files
- Add sideEffects: false to all package.json files
- noderesolve (set exportConditions,
  mainFields, modulesOnly: true,
  preferBuiltins: false)
- Use rollup for everything

- Update eslint
- Update sentry
