---
name: torus-frontend-ci-upgrade
description: >-
  Move a Torus or Web3Auth frontend app that deploys to S3 and CloudFront from
  the develop/staging/master branch deploys to one master trunk, Changesets
  release PRs, and GitHub Environment approvals (staging by the product team,
  production by the admin team), with v<major> maintenance branches. Use when
  the user asks to migrate a frontend app's CI or release process, or to apply
  the auth-service release flow to another frontend repo. Do not use it for a
  published npm library or a backend service (use torus-backend-ci-upgrade).
---

# Migrate a frontend app to the release flow

This skill applies the auth-service release flow ([Web3Auth/auth-service#406](https://github.com/Web3Auth/auth-service/pull/406)) to another frontend app. auth-service is the reference repository. Copy file shape, action pins, and scripts from it at execution time: from the default branch after the PR merges, or from the `chore/changesets-release-flow` branch before. Do not copy values from this skill when the reference has newer ones.

## When to use

| Repository                                                                                                                 | Skill                                         |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Frontend app that deploys `dist/` to S3 and CloudFront (auth-dashboard, passwordless-frontend, torus-website, and similar) | this skill                                    |
| Backend service that deploys a Docker image to ECS                                                                         | `torus-backend-ci-upgrade`                    |
| Library or SDK that publishes to npm                                                                                       | `torus-library-upgrade` (its release PR step) |

This skill changes only CI and release. When the app also needs the stack upgrade (Vite+, lint, engines, dependencies), do it first with `torus-library-upgrade` and `torus-frontend-upgrade`, or in a separate PR. The package README has the table of all skills and where to use each.

## Target flow

- `master` is the only trunk. Feature PRs go into `master`. A PR that changes what ships (source, public assets, build config, dependencies) must have a changeset; docs, CI, and test-only PRs need none.
- Every push to `master` deploys the develop site. No approval.
- The **Create release pull request** workflow opens a `changeset-release/<branch>` PR with the version bump and `CHANGELOG.md`. CI never pushes to a protected branch.
- The merge of that PR changes the `package.json` version. CI then deploys staging (product team approves), then production (admin team approves), then creates the `v<version>` tag and GitHub Release.
- A new major (higher than every tag) also runs the Lambda and CloudFront update, when the repo serves versioned folders.
- `v<major>` maintenance branches (for example `v11`) never merge into `master`. Their release PR, version, and changelog stay on that branch. They deploy to production only (admin approval), never change their major, and their release is not marked latest.

## Before you start

1. Read every workflow in `.github/workflows/`, every script the deploy runs (`scripts/*.sh`), `package.json`, `.github/CODEOWNERS`, and `.github/dependabot.yml`. Write down for each environment: the branch, `VITE_BUILD_ENV`, the S3 bucket, the CloudFront secret, the Lambda folder, and the secrets the build uses.
2. Find the versioned-folder logic. auth-service uploads to `/v<major>` and runs `updateLambda.sh` on a major. A repo that only runs `aws s3 sync` has no versioned folders: drop the `major` input, the `update-distribution-config` job, and the maintenance branches.
3. List the tags: `git tag -l 'v*' --sort=-v:refname | head`. Compare the latest tag with the `package.json` version.
4. List the remote branches that match `v[0-9]*`. These become maintenance branches.
5. Find the teams in CODEOWNERS. The product team owns `src/`. The admin team owns `*` and `.github/CODEOWNERS`. Get their ids: `gh api orgs/<org>/teams/<slug> --jq .id`.

If a deploy workflow still uses static AWS keys, unpinned actions, or a script that commits the version back (`bumpVersion.sh`, `gitPush.sh`), replace that workflow with the reference shape. Do not keep the old bump and push scripts.

## Steps

Create a branch from the current default branch. Do these steps in order.

1. **Changesets.** Add `@changesets/cli` as a dev dependency. Add `.changeset/config.json` and `.changeset/README.md` from [reference.md](reference.md). `privatePackages.version: true` is required, because the app is `"private": true` and Changesets skips private packages by default. `changeset init` in v3 is interactive, so write the files by hand. In a Yarn repo, run `yarn allow-scripts auto` and `yarn harden:check` after the install. Change no other dependency in this PR. Check `git diff origin/<default-branch> -- package.json`: only `@changesets/cli` and the version may differ. In auth-service#406, an unrelated TypeScript 7 bump broke `vue-tsc` (it loads `typescript/lib/tsc`), and `@sentry/browser` 11.16 added a second `@sentry/core` that `@toruslabs/loglevel-sentry` does not share. To undo a bump, check out the default branch's lockfile, set the range back, and install again, so that only the changed packages resolve again.
2. **Version.** When tags exist and the latest tag is higher than the `package.json` version, set the version to the latest tag. Otherwise the first release PR bumps to a version that is already tagged, and the release check skips it.
3. **Release check.** Copy `scripts/releaseCheck.sh` and `scripts/releaseCheck.test.sh` from the reference without changes. Make both executable. Add a `Test release check` step after the tests in the validate workflow. Also copy `scripts/changesetCheck.sh` and `scripts/changesetCheck.test.sh`, and add a `Test changeset check` step. The test turns off commit and tag signing in its temporary repo. Keep those lines: without them, the test fails where the global git config signs commits and no signing agent runs.
4. **Reusable deploy.** Copy `.github/workflows/deploy.yml` from the reference. Keep this repo's build env names, secrets, and scripts. It must have the `environment` input (set on every job), `major: boolean` instead of `version-upgrade`, no version bump step, no `fetch-depth: 0`, and no `ref: ${{ github.ref }}` on checkout. The Lambda job must deploy the exact commit, not the branch head.
5. **Release workflow.** Copy `.github/workflows/release.yml` from the reference. It replaces `develop.yml`, `staging.yml`, and `master.yml`; delete those (use `git mv` for the one you rename so history follows). Keep the `if:` conditions on `deploy-production` and `tag-release`: a skipped staging job otherwise skips production on maintenance branches. Set the develop, staging, and production URLs, secrets, and Lambda folders for this repo. Keep `name: release`. The reusable `deploy.yml` keeps `name: deploy`, so that the Actions page shows each workflow once.
6. **Release PR workflow.** Copy `.github/workflows/release-pr.yml` from the reference. In an npm repo, use the npm setup from torus-cli's `release-pr.yml` and `version-script: npm run version-packages`. Keep `persist-credentials: false` on checkout and delete the old release branch with `gh api`, not `git push`: no write token may stay on disk while dependencies install. `changesets/action` commits through the API with its `github-token` input.
7. **Changeset check.** Copy `.github/workflows/changeset.yml` from the reference, and set `RUNTIME_PATHS` to this repo's paths that ship (auth-service: `^(src/|public/|index\.html|vite\.config\.mts|package\.json|yarn\.lock)`). `scripts/changesetCheck.sh` fails only when the PR changes those paths and adds no `.changeset/*.md` entry. The workflow skips `changeset-release/*` PRs, Dependabot PRs, and PRs with the `skip-changeset` label. Make the check required in the branch rules, or record that an admin must do it. Create that label: `gh label create skip-changeset --description "PR needs no changeset"`.
8. **Branch filters.** Use `[master, "v[0-9]", "v[0-9][0-9]"]` in the release, changeset, and security scanner workflows. Do not use `v*`: it matches branches such as `vue-upgrade`. Set Dependabot `target-branch: master`.
9. **Verify.** Run `./scripts/releaseCheck.test.sh` (7 cases pass) and `./scripts/changesetCheck.test.sh` (4 cases pass). Run `RUNTIME_PATHS='<regex>' ./scripts/changesetCheck.sh origin/master` on the branch. Parse every workflow file (`ruby -ryaml -e 'YAML.load_file(ARGV[0])' <file>`), and run the repo's format check on `.github`, `.changeset`, and `scripts`. Run `actionlint` when it is installed. Then run every step of the repo's validate job locally, in the CI order: install with the lockfile frozen, harden check, type check, lint, format check, tests, build. In CI, the first failed step skips the steps after it, so a local run is the only way to see all failures at once.
10. **PR.** Open the PR into the current default branch. Write the body from **PR body** in [reference.md](reference.md): the current process against the new process, with Mermaid diagrams and a table. After each fix commit, update the PR body from the live body (`gh pr view --json body`), not from a saved draft, so that bot sections such as Cursor Bugbot stay as they are.

## GitHub settings

Changing environment settings is a change to the repository settings. Show the user the exact commands from [reference.md](reference.md) and run them only after the user says yes.

| Environment  | Approvers    | Branches that can deploy                     |
| ------------ | ------------ | -------------------------------------------- |
| `develop`    | none         | no rule (GitHub creates it on the first run) |
| `staging`    | product team | `master`                                     |
| `production` | admin team   | `master`, `v[0-9]`, `v[0-9][0-9]`            |

An environment that exists with another case (`Production`) is the same environment. Update it, do not create a second one.

## Risks to put in the PR body

- **AWS OIDC subject.** With `environment:` on a job, the OIDC subject changes from `repo:<org>/<repo>:ref:refs/heads/<branch>` to `repo:<org>/<repo>:environment:<name>`. The role in `AWS_ROLE_ARN` must trust the environment subjects, or every deploy fails. Check `gh api repos/<org>/<repo>/actions/oidc/customization/sub`. You cannot change IAM from this skill; list it under **Before merge**.
- **Release PR checks.** A PR that `GITHUB_TOKEN` opens does not start other workflows. Required checks on the release PR start only after someone closes and reopens it.
- **Merge order.** The new workflows run on `master`. When the PR targets `develop`, nothing deploys until `develop` merges into `master`, and the new changeset check does not run on the PR itself.
- **Maintenance branches.** Each `v<major>` branch needs the new workflows, scripts, `.changeset/`, and `@changesets/cli` before its first release.

## Done when

- `develop.yml`, `staging.yml`, and `master.yml` are gone. `release.yml`, `deploy.yml`, `release-pr.yml`, and `changeset.yml` match the reference shape.
- `scripts/releaseCheck.test.sh` and `scripts/changesetCheck.test.sh` pass in CI, and the `changeset` check requires an entry for runtime changes.
- No workflow bumps or commits the version.
- The environments have the approvers and branch rules above, or the PR body lists them as not done.
- The PR body has the current against new comparison, the OIDC check, and the after-merge steps.
- CI on the PR passes.
- The PR body describes the latest commit.
