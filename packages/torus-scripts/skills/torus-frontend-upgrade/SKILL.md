---
name: torus-frontend-upgrade
description: >-
  Add the frontend-app steps to an EMBED-573 stack upgrade of a Torus or
  Web3Auth frontend app that deploys to S3 and CloudFront (auth-service,
  passwordless-frontend, auth-dashboard, and similar): private app rules, Yarn
  4, Vue and Tailwind lint, the template-only check, Sentry source maps, deploy
  workflows, and the majors a Vue app cannot take yet. Use together with
  torus-library-upgrade when the repository builds an app, not a package. Do
  not use it alone, and do not use it for a published library or a backend.
---

# Upgrade a Torus frontend app

This skill comes from the auth-service upgrade ([Web3Auth/auth-service#371](https://github.com/Web3Auth/auth-service/pull/371), EMBED-574) and the CI fix in [Web3Auth/auth-service#406](https://github.com/Web3Auth/auth-service/pull/406). The frontend reference repository is [auth-service](https://github.com/Web3Auth/auth-service). Copy file shape and action pins from it at execution time.

## Which skill to use

Use this skill together with `torus-library-upgrade`. That skill owns the tickets, the working agreement, the step list, and the version rules. Follow its steps in order. This skill adds work to steps 1, 5, 6, 7, and 9, and replaces some base guidance. Where the two conflict on a frontend app, this skill wins.

A repository is a frontend app when it builds a site (`vp build` to `dist/`) and deploys it, and does not publish a package to npm. A repo that also deploys a server, such as wallet-services or torus-developer-dashboard, also loads `torus-backend-upgrade` for the server part. The package README has the table of all skills and where to use each.

The release flow (one `master` trunk, Changesets release PRs, environment approvals) is not part of the stack upgrade. Do it after this upgrade with `torus-frontend-ci-upgrade`, in a separate PR.

## Overrides of the base skill

- **No package rules.** The app is `"private": true`. There is no `libraryPreset()`, no `vp pack`, no `exports` or `types` check, no `npm pack` step in CI, and no packed-consumer test. Mark those base items as not applying.
- **No Changesets and no release PR in this upgrade.** `torus-frontend-ci-upgrade` adds both later. Do not ask for the GitHub setting that lets Actions open pull requests.
- **Reference repository.** Copy file shape from auth-service, not from eccrypto.
- **Package manager.** Keep Yarn when the repo uses Yarn. Use Yarn 4 with the node-modules linker, `packageManager` and `devEngines` on Yarn, and `engines.npm` `>=12` as the epic asks. Put the 3-day age gate in `.yarnrc.yml` (`npmMinimalAgeGate`), turn off install scripts (`enableScripts: false`), and use the LavaMoat allow-scripts plugin. CI runs `yarn harden:check`, not `npm exec`.
- **TypeScript profile.** Extend `@toruslabs/config/tsconfig.base.json` and add the DOM libraries. The type check is `vue-tsc --noEmit` for a Vue app.
- **TypeScript major.** Use the newest TypeScript that `vue-tsc` supports. TypeScript 7 removes `typescript/lib/tsc`, which `vue-tsc` 3 loads, so `yarn type-check` stops with `ERR_PACKAGE_PATH_NOT_EXPORTED`. Stay on TypeScript 6 until `vue-tsc` supports 7, and record it under "Not upgraded".
- **Direct `vite`.** In a Yarn repo, keep the direct `vite` devDependency: Yarn needs the root project to provide the `vite` peer of the Vite plugins. Remove the direct `vitest` entry. Keep both `resolutions` that Vite+ needs.
- **`eslint`.** Remove the direct `eslint` devDependency only when lint passes without it. When the Oxlint preset loads an ESLint plugin as a JS plugin, lint fails with `Cannot find module 'eslint'`, and `eslint` stays. Record why.

## Step additions

### Step 1: GitHub policy files

CODEOWNERS gives the product team `src/` and `test/` when they exist. Dependabot covers the repo's package manager and github-actions, weekly, with the 3-day cooldown.

### Step 5: tooling migration

- Use `@toruslabs/oxlint-config-vue` (or `-react`) and `formatPreset()`. Remove ESLint and Prettier config files, `.prettierignore`, Babel config, and `.browserslistrc` when nothing reads them. Remove `husky` and `lint-staged` when no hook uses them.
- Vue: `vp lint` skips `.vue` files with no `<script>` block, and it does not report `no-unused-vars` in `.vue` script blocks. Add a `lint:templates` script that runs `oxlint-vize` from `oxlint-plugin-vize` with `vueTemplateRules` on the template-only files, and run it from `lint`. The script throws spawn errors, and its temporary config is in `.gitignore`. `noUnusedLocals` and `noUnusedParameters` in the shared tsconfig cover unused variables.
- Tailwind: merge the Tailwind lint preset field by field (`jsPlugins`, `rules`, `settings`).
- Tests import from `vite-plus/test`.
- Set the editor formatter to Oxc in `.vscode/settings.json` when the repo has that file.
- `strictNullChecks` from `@toruslabs/config@5`: make type-only changes. List each new `!` assertion in the PR body as a candidate for a runtime guard.
- Sentry source maps: Vite writes `dist/assets`, not `dist/static/js`. Production builds emit hidden source maps. The upload step targets `dist/assets` with the release name the app reports, and uses `continue-on-error`. The S3 upload excludes `*.map`.

### Step 6: CI and deploy workflows

- `validate`: Node `24.22` and `26`; frozen install; harden check; type check; lint (with `lint:templates`); format check; tests; build. No `npm pack`.
- Deploy workflows: no workflow-level permissions (each job sets its own), `persist-credentials: false` on every checkout, actions pinned to a commit SHA, the Wiz sensor, and the AWS role through OIDC (`vars.AWS_ROLE_ARN`) instead of access keys. Replace `jakejarvis/s3-sync-action@master` with `aws s3 sync`. Move the shared build and deploy into a reusable `deploy.yml`.
- Remove scripts that commit the version back (`bumpVersion.sh`, `gitPush.sh`), or record them for `torus-frontend-ci-upgrade`.
- No KICS or Trivy: there is no container.

### Step 7: dependencies

- Make sure one copy of each runtime library is installed after the update. `@sentry/browser` 11.16 installs a second `@sentry/core` next to the one `@toruslabs/loglevel-sentry` uses, and the `Scope` types do not match. Check with `yarn why <package>` or `npm ls <package>`, and keep the range that gives one copy.
- To undo a bump, check out the default branch's lockfile, set the range back, and install again, so that only the changed packages resolve again.
- Keep Sentry behavior when its options change (for example `sendDefaultPii` becomes `dataCollection: { userInfo: true }` in Sentry 11).

### Step 9: verify

- Run every step of `validate` locally, in CI order, on Node 24 and 26. In CI, the first failed step skips the steps after it.
- Build with the production environment (`VITE_BUILD_ENV=production`). Check the base path (for example `/v<major>/`), the source map setting, and the service worker precache. Smoke-test `vp preview` and `vp dev`.
- Run the manual flows the story names (for example a login and an MFA flow on each network). Mark flows that were only type-checked.

## PR body additions

- **Needs reviewer attention:** infra changes (the AWS role and its OIDC trust policy), majors not upgraded and why, flows not tested at runtime, audit items left open, ESLint rules with no Oxlint rule, the Oxlint gaps in `.vue` files, and the new `!` assertions.
- **Needs admin:** `vars.AWS_ROLE_ARN` with an OIDC trust policy for the deploy branches.
- Mark the library-only checklist items (pack, publish, Changesets, release PR) as not applying, with the reason: private app.

## Done when

The base skill's **Done when** holds. Also, each item in this skill is done, marked as not applying, or recorded in the PR body with the reason. CI on the PR passes.
