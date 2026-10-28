---
"@toruslabs/torus-scripts": major
"@toruslabs/config": major
---

Replace the Rollup build commands with explicit Vite+ presets for libraries, React, Node, and formatting. `@toruslabs/config` now exports TypeScript profiles only. These packages require Node.js >=24.22.0 and npm >=12. `npm pack` and `npm publish` build `dist` before they create the archive.

Use independent package versions. `@toruslabs/torus-scripts` and `@toruslabs/config` have no consumer requirement for synchronized releases.
