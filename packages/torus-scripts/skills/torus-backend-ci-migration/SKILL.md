---
name: torus-backend-ci-migration
description: >-
  Move a Torus or Web3Auth backend service that deploys a Docker image to ECS
  from develop/master branch deploys to one master trunk, Changesets release
  PRs, and a GitHub Environment approval by the admin team before production.
  Every push to master deploys LRC; a merged release PR deploys production and
  tags the commit. Use when the user asks to migrate a backend's CI or release
  process, or to apply the auth-service release flow to a backend repo. Do not
  use it for a frontend app (use torus-frontend-ci-migration) or a published
  npm library.
---

# Migrate a backend service to the release flow

This skill applies the release flow of [Web3Auth/auth-service#406](https://github.com/Web3Auth/auth-service/pull/406) to a backend service. Two repositories are the reference. Copy from them at execution time:

- [Web3Auth/auth-service](https://github.com/Web3Auth/auth-service): `scripts/releaseCheck.sh`, `scripts/releaseCheck.test.sh`, `.github/workflows/changeset.yml`, and the `tag-release` job.
- [torusresearch/torus-cli](https://github.com/torusresearch/torus-cli): `.github/workflows/release-pr.yml` for npm.

The deploy job shape comes from the repo itself. [reference.md](reference.md) has the `release.yml` outline.

## When to use

| Repository                                         | Skill                         |
| -------------------------------------------------- | ----------------------------- |
| Backend service that deploys a Docker image to ECS | this skill                    |
| Frontend app that deploys to S3 and CloudFront     | `torus-frontend-ci-migration` |
| Library or SDK that publishes to npm               | `torus-repo-rules`            |

This skill changes only CI and release. When the repo also needs the stack upgrade (Docker hardening, container scan, Node engines), do `web3auth-backend-repo-upgrade` first, or in a separate PR.

## Target flow

- `master` is the only trunk. Feature PRs go into `master` and must have a changeset.
- Every push to `master` deploys LRC. No approval. This is the old `develop.yml` job.
- The **Create release pull request** workflow opens a `changeset-release/master` PR with the version bump and `CHANGELOG.md`. CI never pushes to `master`.
- The merge of that PR changes the `package.json` version. CI then deploys production in each region (admin team approves), then creates the `v<version>` tag and GitHub Release.
- No maintenance branches and no major handling. A service runs one version. A release ignores the `major` output of the release check.
- When the repo also deploys a staging environment, add a staging job before production with the product team as approvers, as in `torus-frontend-ci-migration`.

## Before you start

1. Read every workflow in `.github/workflows/`, `package.json`, `.changeset/config.json`, `.github/CODEOWNERS`, and `.github/dependabot.yml`. Write down for each environment: the branch, the ECR repository, the ECS cluster and services, the regions, the migration step, and the secrets.
2. List the existing environments: `gh api repos/<org>/<repo>/environments --jq '.environments[].name'`. Reuse names that exist (citadel-server uses `lrc` and `prd`). Otherwise use `lrc` and `production`.
3. List the tags: `git tag -l 'v*' --sort=-v:refname | head`. Compare the latest tag with the `package.json` version.
4. Find the teams in CODEOWNERS. The admin team owns `*` and `.github/CODEOWNERS`. The product team owns `src/`. Get their ids: `gh api orgs/<org>/teams/<slug> --jq .id`.

## Steps

Create a branch from the current default branch. Do these steps in order.

1. **Changesets.** Most backends already have private Changesets. Check `.changeset/config.json`: `"baseBranch": "master"`, `"access": "restricted"`, `"privatePackages": { "version": true, "tag": false }`. Keep the `version-packages` script (`changeset version && npm install --package-lock-only --ignore-scripts`). When Changesets is missing, add it as `web3auth-backend-repo-upgrade` describes. Change no other dependency in this PR. Check `git diff origin/<default-branch> -- package.json`: only `@changesets/cli` and the version may differ. In auth-service#406, an unrelated TypeScript 7 bump broke `vue-tsc` (it loads `typescript/lib/tsc`), and `@sentry/browser` 11.16 added a second `@sentry/core` that `@toruslabs/loglevel-sentry` does not share. To undo a bump, check out the default branch's lockfile, set the range back, and install again, so that only the changed packages resolve again.
2. **Version.** When tags exist and the latest tag is higher than the `package.json` version, set the version to the latest tag. Otherwise the first release PR bumps to a version that is already tagged, and the release check skips it.
3. **Release check.** Copy `scripts/releaseCheck.sh` and `scripts/releaseCheck.test.sh` from auth-service without changes. Make both executable. Add a `Test release check` step to the `test` job in `ci.yml`, after the tests. The test covers majors and maintenance branches too; keep those cases, because the script is shared. The test turns off commit and tag signing in its temporary repo. Keep those lines: without them, the test fails where the global git config signs commits and no signing agent runs.
4. **Release workflow.** Write `.github/workflows/release.yml` from [reference.md](reference.md). Move the LRC job from `develop.yml` and the production region matrix from `master.yml` into it without changing their deploy steps, except: add `environment:` to each deploy job, and gate production on the release check. Delete `develop.yml` and `master.yml`. Remove `ci-develop.yml`, `any-branch.yml`, or other copies of the same deploy.
5. **Release PR workflow.** Copy torus-cli's `.github/workflows/release-pr.yml`. Replace the `if:` on the job with a first step that fails unless `GITHUB_REF_NAME` is `master`. Add the Wiz sensor step. Keep `persist-credentials: false` on checkout and delete the old release branch with `gh api`, not `git push`: no write token may stay on disk while dependencies install. `changesets/action` commits through the API with its `github-token` input.
6. **Changeset check.** Use the same standalone `changeset.yml` as the frontend apps, in the npm form from [reference.md](reference.md). It skips `changeset-release/*` PRs, Dependabot PRs, and PRs with the `skip-changeset` label, and it runs again when a label changes. Remove the `release-notes` job from `ci.yml`, so the check runs once. Create the label: `gh label create skip-changeset --description "PR needs no changeset"`.
7. **Branch filters.** Use `master` in every workflow that names `develop` or `master`: `ci.yml`, `container-scan.yml` push branches, `security-code-scanner.yml`, and Dependabot `target-branch`.
8. **Verify.** Run `./scripts/releaseCheck.test.sh` (7 cases pass). Commit a test changeset and run `npm exec --no -- changeset status --since=origin/master` (pass), then remove it and run it again (fail). Parse every workflow file (`ruby -ryaml -e 'YAML.load_file(ARGV[0])' <file>`) and run the repo's format check. Run `actionlint` when it is installed. Then run every step of the repo's validate job locally, in the CI order: install with the lockfile frozen, harden check, type check, lint, format check, tests, build. In CI, the first failed step skips the steps after it, so a local run is the only way to see all failures at once.
9. **PR.** Open the PR into the current default branch. Write the body as in **PR body** in [../torus-frontend-ci-migration/reference.md](../torus-frontend-ci-migration/reference.md), with LRC in place of develop and without the maintenance diagram. After each fix commit, update the PR body from the live body (`gh pr view --json body`), not from a saved draft, so that bot sections such as Cursor Bugbot stay as they are.

## GitHub settings

Changing environment settings is a change to the repository settings. Show the user the exact commands and run them only after the user says yes. Use the commands in [../torus-frontend-ci-migration/reference.md](../torus-frontend-ci-migration/reference.md) with these values:

| Environment               | Approvers    | Branches that can deploy |
| ------------------------- | ------------ | ------------------------ |
| `lrc` (or existing name)  | none         | `master`                 |
| `production` (or `prd`)   | admin team   | `master`                 |
| `staging`, when it exists | product team | `master`                 |

## Risks to put in the PR body

- **AWS OIDC subject.** With `environment:` on a job, the OIDC subject changes from `repo:<org>/<repo>:ref:refs/heads/<branch>` to `repo:<org>/<repo>:environment:<name>`. The role in `AWS_ROLE_ARN` must trust the environment subjects, or every deploy fails. Check `gh api repos/<org>/<repo>/actions/oidc/customization/sub`. List it under **Before merge**.
- **Approval per region.** Each region in the production matrix is one pending deployment. The reviewer approves all of them in one dialog.
- **Migrations.** When production runs database migrations, keep them in the production job (or a job that needs it), after the approval. Never run them before the approval.
- **Release PR checks.** A PR that `GITHUB_TOKEN` opens does not start other workflows. Required checks on the release PR start only after someone closes and reopens it.
- **Merge order.** The new workflows run on `master`. When the PR targets `develop`, LRC stops deploying from `develop` pushes, and nothing deploys until `develop` merges into `master`. The new changeset check does not run on the PR itself.

## Done when

- `develop.yml` and `master.yml` are gone. `release.yml` deploys LRC on every push and production only after a version bump and the admin approval.
- `release-pr.yml` runs only on `master`.
- `changeset.yml` checks every PR into `master`, and `ci.yml` has no `release-notes` job.
- `scripts/releaseCheck.test.sh` passes in CI.
- No workflow bumps or commits the version.
- The environments have the approvers and branch rules above, or the PR body lists them as not done.
- The PR body has the current against new comparison, the OIDC check, and the after-merge steps.
- CI on the PR passes.
- The PR body describes the latest commit.
