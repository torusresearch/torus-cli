---
name: torus-backend-ci-upgrade
description: >-
  Move a Torus or Web3Auth backend service that deploys a Docker image to ECS
  from develop/master branch deploys to one master trunk with GitHub
  Environment approvals. Every merge to master deploys LRC, then waits for
  approval before staging (product team, when the repo has staging) and
  production (admin team). No release PR and no version bump, but a changelog:
  a changeset entry for every runtime change, a PR comment with the changes not
  in production yet, a changelog before the production approval, and a GitHub
  Release for each production deploy. Use when the user asks to migrate a
  backend's CI or deploy process. Do not use it for a frontend app (use
  torus-frontend-ci-upgrade) or a published npm library.
---

# Migrate a backend service to approval deploys

A backend runs one version: the latest approved commit on `master`. So a backend has no release PR and no version bump. Each merge goes to LRC at once, and to staging and production after a person approves it. The changelog is still recorded: changeset entries say what changed, and each production deploy gets a GitHub Release with those entries.

The deploy job shape comes from the repo itself. [reference.md](reference.md) has the scripts and the workflow outlines. The changelog job comes from `prd-changelog` in [consensys-vertical-apps/va-mmcx-authentication-api](https://github.com/consensys-vertical-apps/va-mmcx-authentication-api) (`.github/workflows/service.yaml`). The changeset check comes from [Web3Auth/auth-service](https://github.com/Web3Auth/auth-service) (`scripts/changesetCheck.sh`).

## When to use

| Repository                                         | Skill                                         |
| -------------------------------------------------- | --------------------------------------------- |
| Backend service that deploys a Docker image to ECS | this skill                                    |
| Frontend app that deploys to S3 and CloudFront     | `torus-frontend-ci-upgrade`                   |
| Library or SDK that publishes to npm               | `torus-library-upgrade` (its release PR step) |

This skill changes only CI and deploy. When the repo also needs the stack upgrade (Docker hardening, container scan, Node engines), do it first with `torus-library-upgrade` and `torus-backend-upgrade`, or in a separate PR. The package README has the table of all skills and where to use each.

A repo that also publishes npm packages (fetch-node-details) keeps its release PR for those packages. This skill changes only the server deploy.

## Target flow

- `master` is the only trunk. Feature PRs go into `master`.
- **Changelog entry.** A PR that changes what ships (source, Dockerfile, dependencies, migrations, config the service reads) adds a changeset: `npx changeset` (or `yarn changeset`). The `changeset` check fails without one. Docs, CI, and test-only PRs, Dependabot PRs, and PRs with the `skip-changeset` label need none. Nobody runs `changeset version`: the entries are the changelog.
- **PR comment.** Each PR gets one comment, updated on every push: the changes merged to `master` but not in production yet, and the changes in this PR.
- Every merge to `master` runs the tests, then deploys LRC. No approval.
- After LRC succeeds, the same run waits for approval to deploy staging (product team), when the repo has a staging environment.
- **Production changelog.** Before the production approval, the `prd-changelog` job writes the changes since the last production deploy to the run summary, so the approver sees what goes out.
- The run then waits for approval to deploy production in each region (admin team).
- **Release.** After production succeeds, CI creates a GitHub Release `prod-<YYYYMMDD>-<run number>` on the deployed commit. Its notes are the changelog from `prd-changelog`.
- The image tag is the commit SHA. To roll back, re-run the production job of an older run. That run deploys its own commit.

## Before you start

1. Read every workflow in `.github/workflows/`, `package.json`, `.changeset/`, `.github/CODEOWNERS`, and `.github/dependabot.yml`. Write down for each environment: the branch, the ECR repository, the ECS cluster and services, the regions, the migration step, and the secrets.
2. List the existing environments: `gh api repos/<org>/<repo>/environments --jq '.environments[].name'`. Reuse names that exist (citadel-server uses `lrc` and `prd`). Otherwise use `lrc`, `staging`, and `production`.
3. Find the teams in CODEOWNERS. The admin team owns `*` and `.github/CODEOWNERS`. The product team owns `src/`. Get their ids: `gh api orgs/<org>/teams/<slug> --jq .id`.
4. Write down the paths that ship. They become `RUNTIME_PATHS`, for example `^(src/|Dockerfile|package\.json|package-lock\.json|migrations/)`.

## Steps

Create a branch from the current default branch. Do these steps in order.

1. **No other dependency changes.** Check `git diff origin/<default-branch> -- package.json`: only `@changesets/cli` may be new.
2. **Changesets for entries.** When `.changeset/` is missing, add `@changesets/cli` and the config from [reference.md](reference.md). Add `.changeset/README.md` that says: add an entry for every runtime change; nobody runs `changeset version`. Do not add `version-packages`.
3. **Changeset check.** Copy `scripts/changesetCheck.sh` and `scripts/changesetCheck.test.sh` from auth-service without changes, and make both executable. Write `.github/workflows/changeset.yml` from [reference.md](reference.md) with this repo's `RUNTIME_PATHS`. Remove the `release-notes` job from `ci.yml`. Add a `Test changeset check` step to the `test` job in `ci.yml`. Create the label: `gh label create skip-changeset --description "PR needs no changeset"`.
4. **Changelog script.** Copy `scripts/prdChangelog.sh` and `scripts/prdChangelog.test.sh` from [reference.md](reference.md), and make both executable. Add a `Test changelog` step to the `test` job in `ci.yml`.
5. **PR comment.** Write `.github/workflows/unreleased.yml` from [reference.md](reference.md).
6. **Deploy workflow.** Write `.github/workflows/deploy.yml` (workflow name `deploy`) from [reference.md](reference.md). Move the LRC job from `develop.yml` and the production region matrix from `master.yml` into it without changing their deploy steps, except: add `environment:` to each deploy job, chain the jobs with `needs:` (LRC, then staging, then `prd-changelog`, then production, then `release`), and set one `concurrency` group for each environment. Set `PROD_ENVIRONMENT` to the production environment name. Delete `develop.yml` and `master.yml`. Remove `ci-develop.yml`, `any-branch.yml`, or other copies of the same deploy.
7. **No release PR and no version for the service.** Do not add `release-pr.yml`, a release check script, or a `version-packages` script for the service, and do not run `changeset version` for it. Exception: a repo that also publishes npm packages (fetch-node-details) keeps its `release-pr.yml`, `version-packages`, and Changesets for those packages. The same entries then feed both the npm changelog and the `prod-*` release notes.
8. **Branch filters.** Use `master` in every workflow that names `develop` or `master`: `ci.yml`, `container-scan.yml` push branches, `security-code-scanner.yml`, and Dependabot `target-branch`.
9. **Verify.** Run `./scripts/changesetCheck.test.sh` (4 cases pass) and `./scripts/prdChangelog.test.sh` (7 cases pass). Run `prdChangelog.sh` once against the real repo (`GITHUB_REPOSITORY=<org>/<repo> PROD_ENVIRONMENT=<name> GH_TOKEN=$(gh auth token) ./scripts/prdChangelog.sh origin/master`) and check that it finds the last production deployment. Parse every workflow file (`ruby -ryaml -e 'YAML.load_file(ARGV[0])' <file>`) and run the repo's format check. Run `actionlint` when it is installed. Then run every step of the repo's validate job locally, in the CI order: install with the lockfile frozen, harden check, type check, lint, format check, tests, build. In CI, the first failed step skips the steps after it, so a local run is the only way to see all failures at once.
10. **PR.** Open the PR into the current default branch. Write the body as in **PR body** in [../torus-frontend-ci-upgrade/reference.md](../torus-frontend-ci-upgrade/reference.md), with these changes: LRC in place of develop, no release PR, no version row, a changelog row (changeset entries, PR comment, `prd-changelog`, GitHub Release), and no maintenance diagram. After each fix commit, update the PR body from the live body (`gh pr view --json body`), not from a saved draft, so that bot sections such as Cursor Bugbot stay as they are.

## GitHub settings

Changing environment settings is a change to the repository settings. Show the user the exact commands and run them only after the user says yes. Use the commands in [../torus-frontend-ci-upgrade/reference.md](../torus-frontend-ci-upgrade/reference.md) with these values:

| Environment               | Approvers    | Branches that can deploy |
| ------------------------- | ------------ | ------------------------ |
| `lrc` (or existing name)  | none         | `master`                 |
| `staging`, when it exists | product team | `master`                 |
| `production` (or `prd`)   | admin team   | `master`                 |

Make the `changeset` check required in the branch rules for `master`, or record that an admin must do it.

## Risks to put in the PR body

- **AWS OIDC subject.** With `environment:` on a job, the OIDC subject changes from `repo:<org>/<repo>:ref:refs/heads/<branch>` to `repo:<org>/<repo>:environment:<name>`. The role in `AWS_ROLE_ARN` must trust the environment subjects, or every deploy fails. Check `gh api repos/<org>/<repo>/actions/oidc/customization/sub`. List it under **Before merge**.
- **Runs that wait.** Every merge creates a run that waits for approval. GitHub keeps at most one pending job in each `concurrency` group, so a newer run can cancel an older run that is still pending. Before you approve, check the Actions page and approve the newest run. Reject an old run that still waits; do not approve it after a newer run, because it deploys the older commit.
- **Changelog source.** The changelog compares with the latest successful deployment to the production environment. Before the first deploy through this workflow there is none, so the first changelog shows the last 20 commits.
- **Forks.** A PR from a fork gets a read-only token, so `unreleased.yml` skips it.
- **Changeset files.** Nobody consumes the entries, so `.changeset/` grows. Delete old entries in a cleanup PR when the folder gets large; the GitHub Releases keep the history.
- **Approval per region.** Each region in the production matrix is one pending deployment. The reviewer approves all of them in one dialog.
- **Migrations.** When production runs database migrations, keep them in the production job (or a job that needs it), after the approval. Never run them before the approval.
- **Merge order.** The new workflows run on `master`. When the PR targets `develop`, LRC stops deploying from `develop` pushes, and nothing deploys until `develop` merges into `master`.

## Done when

- `develop.yml` and `master.yml` are gone. `deploy.yml` deploys LRC on every merge, shows the changelog before the production approval, deploys staging and production only after their approvals, and creates a `prod-*` GitHub Release.
- `changeset.yml` requires an entry for runtime changes, and `unreleased.yml` comments on PRs.
- `changesetCheck.test.sh` and `prdChangelog.test.sh` pass in CI.
- No workflow bumps the service version, opens a release PR for the service, or runs `changeset version` for it. A repo that also publishes npm packages keeps its npm release PR.
- The environments have the approvers and branch rules above, or the PR body lists them as not done.
- The PR body has the current against new comparison, the OIDC check, and the after-merge steps.
- CI on the PR passes.
- The PR body describes the latest commit.
