---
"@toruslabs/oxlint-config-typescript": minor
---

Drop `eslint-plugin-import` from the TypeScript lint preset. That plugin accepts ESLint only through version 9, so installs pulled in ESLint 9.39.5. The native Oxlint `import` plugin stays. The preset no longer runs `import-js/no-extraneous-dependencies`. `eslint-plugin-tsdoc` moves to 0.5.4.
