---
"@toruslabs/oxlint-config-typescript": patch
---

Drop `eslint-plugin-tsdoc` from the TypeScript lint preset. That plugin depends on `@typescript-eslint/utils`, which forces TypeScript 5 into the install tree and cannot load with TypeScript 7. The `tsdoc/syntax` rule stays, now backed by a local Oxlint JS plugin that wraps `@microsoft/tsdoc` and still loads `tsdoc.json` through `@microsoft/tsdoc-config`. The loaded config is reused, and reloaded when that file changes or appears during a long-running lint. A tsdoc.json that cannot be read is reported instead of crashing the rule, and a later readable version is loaded.
