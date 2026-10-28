---
"@toruslabs/torus-scripts": major
"@toruslabs/config": major
---

Replace the Rollup build commands with explicit Vite+ presets for libraries, React, Vue, Node, and formatting. `@toruslabs/config` now exports TypeScript profiles only. These packages require Node.js >=24.22.0 and npm >=12.

Use independent package versions. `@toruslabs/torus-scripts` and `@toruslabs/config` have no consumer requirement for synchronized releases.
