---
"@toruslabs/oxlint-config-typescript": patch
---

Drop `eslint-plugin-tsdoc` from the TypeScript lint preset. That plugin depends on `@typescript-eslint/utils`, which forces TypeScript 5 into the install tree and cannot load with TypeScript 7. The `tsdoc/syntax` rule stays, now backed by a local Oxlint JS plugin that wraps `@microsoft/tsdoc` and still loads `tsdoc.json` through `@microsoft/tsdoc-config`.
