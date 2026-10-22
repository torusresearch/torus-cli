---
"@toruslabs/torus-scripts": major
"@toruslabs/config": major
---

This release changes the exported preset entry points and requires Node.js >=24.15.0 and npm >=12. These export and engine changes are breaking.

Use independent package versions. `@toruslabs/torus-scripts` and `@toruslabs/config` have no consumer requirement for synchronized releases. The legacy ESLint preset packages remain published and unchanged during this transition. Changesets ignores those packages until Task 9 decides their future.
