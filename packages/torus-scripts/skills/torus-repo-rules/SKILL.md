---
name: torus-repo-rules
description: >-
  Set Torus repository rules: GitHub policy files (CODEOWNERS, PR template,
  Dependabot), engines, .nvmrc, @lavamoat/harden, .npmrc, @toruslabs/config
  tsconfig profiles, Changesets, CI workflows, release PR, security scanner,
  dependency updates, audit, and package.json cleanup. Use for the EMBED-573
  stack upgrade steps that are not Vite+ and not lint, or when the user asks
  to set repo rules on a Torus repository. Vite+ and lint steps belong to the
  migrating-to-torus-cli skill. The epic is always EMBED-573. Ask which story
  ticket to follow when the conversation does not already name it.
---

# Set Torus repository rules

This skill does the EMBED-573 stack upgrade steps that are not Vite+ and not lint. Vite+ migration, build presets, and lint presets belong to the `migrating-to-torus-cli` skill. When the user asks for that work, load that skill instead.

For a backend service (a `Dockerfile`, a Compose file, or a deploy workflow), also load the `web3auth-backend-repo-upgrade` skill. Use both together. That skill adds the backend steps and lists where it replaces guidance in this skill.

Plan the upgrade. The user commits. Do one step at a time when they ask to implement.

### Tickets

The epic is always [EMBED-573](https://consensyssoftware.atlassian.net/browse/EMBED-573).

The story changes per repository. If this conversation does not already name the story key, ask which ticket to follow and wait. Do not guess from the open workspace or from an earlier repository.

Fetch both issues from `consensyssoftware.atlassian.net` before planning. Use the story for the repository, source, and repository-specific acceptance checks. Use the live epic text for the shared acceptance criteria.

Read the story's **Sequence and prerequisites** section before choosing dependency versions. That section is the list of releases this repository adopts. Classify each entry:

- **Release-adoption gate** or **direct runtime package prerequisite**: install that package's latest published release. Look it up with `npm view <package> version` during this run. Ignore the 3-day window (`min-release-age` and Dependabot cooldown) and install with `npm install --min-release-age=0`. A range already in `package.json` is not a reason to stay on an older major.
- **Shared tooling** (`torus-cli` / `@toruslabs/torus-scripts`): install the published `@toruslabs/torus-scripts` release the story names, also with `--min-release-age=0`. The epic text may still say `9.0.0`. Do not install an older release than the one this skill's guidance comes from.
- **Anything else** in that section: follow the wording. Step 4 does not bump packages the section does not list. Step 7 raises those other direct ranges on the same major.

A release-adoption gate with no published release blocks the dependency bump. Name the package and stop that step. A publish date inside the 3-day window does not block it.

### Working agreement

- Default output is a step plan for forked agents. Do not edit, commit, push, publish, or open a PR unless the user asks to do a step.
- When they ask to do a step, do that step only, then stop. The user commits and pushes. Do not commit or push.
- Step 1 creates `feat/embed-<story-number>-stack-upgrade` from the default branch. Stay on a branch they already created.
- Write each step so a new agent can do it without this chat: repo, org, default branch, package manager, versions, files, and the stop condition.
- Read **Notes to consider** before planning or implementing. A fork does not report its later turns back to the parent chat.

### Version overrides

Versions for a new major come from **Sequence and prerequisites**, not from memory of another repository. Step 7 raises every other direct range on the same major.

`@types/node` is the exception. It follows major 26, the same major as `.nvmrc`, even when **Sequence and prerequisites** does not list it. Step 5 installs that major. Step 7 only raises it within 26.

Keep `cooldown.default-days: 3` in `dependabot.yml` and `min-release-age=3` in `.npmrc` for later updates. The install that resolves the section's packages uses `--min-release-age=0`.

### Plan

Copy this checklist into the plan and fill the repo-specific blanks.

```
- [ ] 1. GitHub policy files
- [ ] 2. Draft pull request body
- [ ] 3. Inspect the repository
- [ ] 4. Runtime prerequisites
- [ ] 5. Repository rules and release setup
- [ ] 6. CI, release PR, and security scanner
- [ ] 7. Update dependencies and audit
- [ ] 8. Package.json cleanup
- [ ] 9. Verify and finish the draft
```

#### 1. GitHub policy files

Create `feat/embed-<story-number>-stack-upgrade` from the default branch when that branch does not already exist, and check it out. Stay on it when it already exists.

Touch only `.github/CODEOWNERS`, `.github/PULL_REQUEST_TEMPLATE.md`, and `.github/dependabot.yml`. Leave workflows for step 6.

CODEOWNERS follows `origin`'s org. See [reference.md](reference.md). Product owners cover directories that exist. A single package gets `src/` and `test/`. Add `packages/`, `demo/`, or `examples/` only when those directories exist.

PR template includes Motivation and Context above Jira Link. Dependabot covers npm (or the repo's package manager) and github-actions, weekly, with a 3-day cooldown.

Stop after the branch exists and those files are in place. Do not commit or push.

#### 2. Draft pull request body

Write the body from the template copied in step 1. Fill motivation, the story link, and the EMBED-573 link. Mark a breaking change when engines or published entries change. Leave testing as a checklist for step 9.

Create that pull request as a draft with `gh pr create --draft` against the default branch. Do not commit or push. If the branch is not on the remote, stop and give the user the body. The draft waits until they push.

#### 3. Inspect the repository

Read the repo before changes. Do not edit build files.

1. Find the workspace root. Check `git status`, Node and npm versions, lockfile, package manager, scripts, engines, entry paths, TypeScript profiles, release steps, and existing CI files.
2. Inspect `package.json` scripts and entry paths, `tsconfig.json`, and release automation. Record what runs today: install, build, typecheck, tests, release.
3. A Vite+ or lint migration from the `migrating-to-torus-cli` skill may run on the same repository. Record the repo state it will start from. Do not run that migration here.
4. Report findings and gaps before the next step.

#### 4. Runtime prerequisites

Use the release-adoption gates and direct runtime package prerequisites from **Sequence and prerequisites**. Skip this step when that section lists none.

Bump each of those packages to the latest version resolved for this run, including a release inside the 3-day window. Install with `--min-release-age=0`. Fix call sites only where the new types fail. Leave every other direct range for step 7. Leave engines, tooling, and CI for later steps.

#### 5. Repository rules and release setup

Apply the repository rules that are not Vite+ and not lint. A single package copies its file shape from [eccrypto](https://github.com/torusresearch/eccrypto), including when `origin` is MetaMask. A monorepo copies its file shape from the newest completed sibling on `origin`'s org. CODEOWNERS still follows `origin`'s org. See [reference.md](reference.md).

- Keep the repo's npm or Yarn choice. Upgrade Yarn Classic to stable Yarn 4.16+ with the node-modules linker.
- `engines.node` `>=24.22.0`, `engines.npm` `>=12`, `.nvmrc` `26`.
- `@types/node` uses major 26, the same major as `.nvmrc`. Set the range to the newest `26` release older than `min-release-age` (3 days). Look it up with `npm view` during the run. A range already on 25, or any older major, still moves to 26. Install with `--min-release-age=0` only when that 26 release is still inside the window. Fix call sites only where the new types fail.
- `@lavamoat/harden` at moderate level, plus the `.npmrc` in [reference.md](reference.md).
- Latest stable TypeScript and `@toruslabs/config@5`.
- `@toruslabs/config@5` sets `strictNullChecks` and drops DOM libs. Add DOM libs for browser packages and fix the new type errors.
- Extend `@toruslabs/config/tsconfig.library.json` or `@toruslabs/config/tsconfig.node.json`, after confirming those files exist in the installed registry version. Do not extend a relative `node_modules` path. Typecheck that package after the change.
- Set up Changesets at the workspace root. `baseBranch` is the real default branch. Put only packages that must share a version in `fixed`. Use `access: "public"` for public scoped packages. Decide whether private packages version (`privatePackages.version`). The version script runs Changesets and then updates the lockfile. Keep or replace old release automation deliberately. A standalone package can keep `npm publish` until its release process is set up.
- Record in the story what the `migrating-to-torus-cli` skill covers on this repo: Vite+ tasks, build presets, and lint presets. Do not run those steps here.

#### 6. CI, release PR, and security scanner

Replace the old test workflows. Copy current action pins from the same reference at execution time: eccrypto for a single package, the newest completed sibling on `origin`'s org for a monorepo.

- `validate`: pull requests and the default branch; Node `24.22.0` and `26`; install npm 12 for npm repos; `npm ci` (or Yarn equivalent); `npm exec --no -- harden check --package-manager npm`; `npm run build`; typecheck; tests. Then `npm pack --dry-run --json`, or `npm pack --workspaces --dry-run --json` in a monorepo. Skip `changeset status` on `changeset-release/*` and `dependabot/*`. Playwright install stays a separate `npm exec` step. `harden check` defaults to moderate.
- `release-pr`: `workflow_dispatch` only, job limited to the default branch, `changesets/action` v2 pinned to a commit SHA, version script updates the lockfile. It opens or updates the release PR. It does not publish.
- `security-code-scanner`: the MetaMask reusable workflow from [torus-cli #123](https://github.com/torusresearch/torus-cli/pull/123). Resolve the current pin from that reference's `.github/workflows/security-code-scanner.yml`. `scanner-ref` matches that pin. Ignore `node_modules`, `dist`, `build`, and `coverage`. Do not add a second CodeQL workflow. Do not copy the torus-cli package test or its changeset.

Drop `legacy-peer-deps` from `validate`, deploy, and `release-pr`. Confirm with `npm ci` on npm 12, not with `npm ls`. An optional peer mismatch is not a failed install. Add the flag only after a current install fails without it.

Add KICS and Trivy only for backend, container, or infrastructure. Add the AWS role and Wiz sensor only when this repo already deploys. Record items that do not apply.

#### 7. Update dependencies and audit

Update every direct dependency, devDependency, peerDependency, and override. Move each declared range to the newest release on the same major that is older than `min-release-age` (3 days). `npm view <pkg> version` ignores that window, so check the publish time. A range that already accepts the version still moves up to that release, including a peer range. `"vite": "^1.0.0"` becomes `"vite": "^1.4.0"` when `1.4.0` is that release. Refresh the lockfile with the npm major CI uses (npm 12). Update an `allowScripts` pin when the installed version changes.

Do not cross a major unless **Sequence and prerequisites** lists that package. `@types/node` is already on major 26 from step 5. Raise it only within 26, to the newest release older than the window. Do not move a version another tool pins exactly, and leave a direct dependency whose next release requires that pin. Leave a release inside the 3-day window for the next Dependabot pass, except packages from **Sequence and prerequisites**, which stay on the version installed in step 4.

Compare `npm audit` (or Yarn) with Dependabot. An in-range fix updates the lockfile only. Do not force a major with an override when that changes the API. Re-run `harden check` after each dependency update. List alerts left open and why. Leave Dependabot dismissal to the user.

#### 8. Package.json cleanup

Check every `package.json` entry and remove one only when this repository does not use it. Cover `dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`, `overrides`, and `allowScripts`. Leave `engines`, `devEngines`, and `scripts` alone unless a removed package is the only reason a script exists.

Search the repo outside `node_modules`, `dist`, and the lockfile. Then check the dependency list of each package you keep. A package another dependency already installs can still stay when this repo imports it or a script runs it.

- Remove a direct dependency that nothing imports and no script or CI step runs. `rimraf` and `tsx` are leftovers from the old `torus-scripts` scripts. Confirm the kept packages do not depend on them.
- Keep `@lavamoat/harden`, `@changesets/cli`, `typescript`, `@toruslabs/config`, `playwright`, and `@types/*` packages the compiler still resolves. Keep `husky` and `lint-staged` when `prepare` and the pre-commit hook use them. Keep a build or test tool that another tool pins exactly.
- Remove an override when a lockfile refresh without it resolves the same version, and the override is not a security floor or a tool pin. Confirm with `npm install --package-lock-only` on npm 12. Put the override back if the resolved version changes.
- Under `allowScripts`, remove a `pkg@version` pin that is not in the lockfile. Keep a pin for an installed package that has an install script. `false` means the script does not run. When a removal changes the installed version of a package that still has an install script, update that pin.

Leave `devEngines` as the reference writes it: `packageManager` `npm` `>=11.17.0` with `onFail` `error`. That check is for contributors. `engines.npm` stays `>=12`.

Refresh the lockfile with npm 12. Run build and typecheck. Do not commit.

#### 9. Verify and finish the draft

Clean install, build, typecheck, and tests on Node 24 and 26. Run the repo's own check scripts when they exist. Inspect the packed tarball and both `require` and import when the package publishes both. Run browser and service checks the story asks for.

Do not publish.

Finish the step 2 PR body: majors, export and types paths, scan coverage, open alerts, checks that did not run, and the GitHub setting that lets Actions open the release PR. Publish stays manual on the default branch after that PR merges.

### Notes to consider

#### Forks on one branch

- The parent chat keeps only the turns from before the fork. Look up the other forks before editing the same branch.
- Pull before you commit. Name commits that were already on the branch. A push publishes every local commit, including ones another fork made.

#### Step 6

- For a monorepo whose packages use `src/` and `test/`, copy those two lines from the newest wallet-services sibling on the same org. When product code lives in other folders, use the `packages/*/*/` pattern in the review notes below. The single-package block in [reference.md](reference.md) is the fallback. Do not assign a bare `packages/` line to the product team.

#### Short review comments on the same PR

- **`npm exec`.** Required in step 6. The harden step is `npm exec --no -- harden check --package-manager npm`.
- **`legacy-peer-deps`.** Required in step 6. Drop it from `validate`, deploy, and `release-pr` unless a current `npm ci` on npm 12 fails without it.
- **CODEOWNERS when packages are not `src/` and `test/`.** wallet-services uses `packages/*/src/` and `packages/*/test/`. torus-ui keeps source in other folders and keeps config at the package root. Use:

  ```
  packages/*/*/                   @<org product team>
  ```

  A trailing slash matches that directory and everything inside it. Files in the package root (`package.json`, `vite.config.ts`, `tsconfig.json`, `index.ts`) stay with admins through the `*` fallback. `scripts/` and `.storybook/` match because they are directories. A bare `packages/` line gives product owners those root files too.

- **`tsconfig` `extends`.** Required in step 5. Extend `@toruslabs/config/tsconfig.library.json` or `@toruslabs/config/tsconfig.node.json`, not a relative `node_modules` path.
- **Update dependencies.** Required in step 7 for every direct dependency, not only packages a reviewer named. A declared range left below the newest same-major release outside the 3-day window makes `npm ci` fail with `ETARGET` once that release ages in.

### Done when

Every shared EMBED-573 bullet is mapped to a step, marked as not applying, or named as the `migrating-to-torus-cli` skill's scope, with the reason. Story-specific acceptance checks are included. The plan quotes **Sequence and prerequisites** and names the latest version installed for each package in it. It also names the `@types/node` 26 release installed in step 5.
