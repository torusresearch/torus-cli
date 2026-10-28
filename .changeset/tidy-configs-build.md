---
"@toruslabs/torus-scripts": major
"@toruslabs/config": major
---

Replace the Rollup build commands with explicit Vite+ presets for libraries, React, Node, and formatting. `@toruslabs/config` now exports TypeScript profiles only. These packages require Node.js >=24.22.0 and npm >=12. `npm pack` and `npm publish` build `dist` before they create the archive.

Breaking changes:

- `strictNullChecks` is now `true` in `tsconfig.base.json`. The old profile set `strict` to `true` and `strictNullChecks` to `false`.
- DOM libraries are removed. `tsconfig.library.json` and `tsconfig.node.json` use the ES2024 library only. Add DOM libraries in a browser package.
- The `torus-scripts` command is removed. Babel configs and `torus.config.js` are removed.
- `libraryPreset()` requires an `entry` option, for example `libraryPreset({ entry: "src/index.ts" })`. Library builds default to ESM. Pass `format: ["esm", "cjs"]` when a package must also ship CommonJS. The old defaults emitted both formats.

Use independent package versions. `@toruslabs/torus-scripts` and `@toruslabs/config` have no consumer requirement for synchronized releases.
