---
name: torus-backend-ci-upgrade
description: >-
  Move a Torus or Web3Auth backend service that deploys a Docker image to ECS
  from develop/master branch deploys to one master trunk with GitHub
  Environment approvals. Every merge to master deploys LRC, then waits for
  approval before staging (product team, when the repo has staging) and
  production (admin team). No release PR, no Changesets, and no version tags.
  Use when the user asks to migrate a backend's CI or deploy process. Do not
  use it for a frontend app (use torus-frontend-ci-upgrade) or a published npm
  library.
---

# Migrate a backend service to approval deploys

A backend runs one version: the latest approved commit on `master`. So a backend has no release PR, no version bump, and no changelog. Each merge goes to LRC at once, and to staging and production after a person approves it.

The deploy job shape comes from the repo itself. [reference.md](reference.md) has the `deploy.yml` outline, based on broadcast-channel-server.

## When to use

| Repository                                         | Skill                                         |
| -------------------------------------------------- | --------------------------------------------- |
| Backend service that deploys a Docker image to ECS | this skill                                    |
| Frontend app that deploys to S3 and CloudFront     | `torus-frontend-ci-upgrade`                   |
| Library or SDK that publishes to npm               | `torus-library-upgrade` (its release PR step) |

This skill changes only CI and deploy. When the repo also needs the stack upgrade (Docker hardening, container scan, Node engines), do it first with `torus-library-upgrade` and `torus-backend-upgrade`, or in a separate PR. The package README has the table of all skills and where to use each.

A repo that also publishes npm packages (fetch-node-details) keeps its release PR and Changesets for those packages. This skill changes only the server deploy.

## Target flow

- `master` is the only trunk. Feature PRs go into `master`.
- Every merge to `master` runs the tests, then deploys LRC. No approval.
- After LRC succeeds, the same run waits for approval to deploy staging (product team), when the repo has a staging environment.
- After staging (or LRC, when there is no staging), the same run waits for approval to deploy production in each region (admin team).
- Each deploy is the merge commit. The image tag is the commit SHA. No version bump, no `CHANGELOG.md`, and no git tag.
- To roll back, re-run the production job of an older run. That run deploys its own commit.

## Before you start

1. Read every workflow in `.github/workflows/`, `package.json`, `.github/CODEOWNERS`, and `.github/dependabot.yml`. Write down for each environment: the branch, the ECR repository, the ECS cluster and services, the regions, the migration step, and the secrets.
2. List the existing environments: `gh api repos/<org>/<repo>/environments --jq '.environments[].name'`. Reuse names that exist (citadel-server uses `lrc` and `prd`). Otherwise use `lrc`, `staging`, and `production`.
3. Find the teams in CODEOWNERS. The admin team owns `*` and `.github/CODEOWNERS`. The product team owns `src/`. Get their ids: `gh api orgs/<org>/teams/<slug> --jq .id`.

## Steps

Create a branch from the current default branch. Do these steps in order.

1. **No dependency changes.** This PR changes workflows only. Check `git diff origin/<default-branch> -- package.json`: it must show no change.
2. **Deploy workflow.** Write `.github/workflows/deploy.yml` (workflow name `deploy`) from [reference.md](reference.md). Move the LRC job from `develop.yml` and the production region matrix from `master.yml` into it without changing their deploy steps, except: add `environment:` to each deploy job, chain the jobs with `needs:` (LRC, then staging, then production), and set one `concurrency` group for each environment. Delete `develop.yml` and `master.yml`. Remove `ci-develop.yml`, `any-branch.yml`, or other copies of the same deploy.
3. **No release PR and no changeset check.** Do not add `release-pr.yml`, a release check script, or `changeset.yml`. Remove the `release-notes` job from `ci.yml`. A repo that already has `.changeset/` and `@changesets/cli` can keep them; record in the PR that nothing consumes them, and let the team remove them later.
4. **Branch filters.** Use `master` in every workflow that names `develop` or `master`: `ci.yml`, `container-scan.yml` push branches, `security-code-scanner.yml`, and Dependabot `target-branch`.
5. **Verify.** Parse every workflow file (`ruby -ryaml -e 'YAML.load_file(ARGV[0])' <file>`) and run the repo's format check. Run `actionlint` when it is installed. Then run every step of the repo's validate job locally, in the CI order: install with the lockfile frozen, harden check, type check, lint, format check, tests, build. In CI, the first failed step skips the steps after it, so a local run is the only way to see all failures at once.
6. **PR.** Open the PR into the current default branch. Write the body as in **PR body** in [../torus-frontend-ci-upgrade/reference.md](../torus-frontend-ci-upgrade/reference.md), with these changes: LRC in place of develop, no release PR, no version or changelog rows, and no maintenance diagram. After each fix commit, update the PR body from the live body (`gh pr view --json body`), not from a saved draft, so that bot sections such as Cursor Bugbot stay as they are.

## GitHub settings

Changing environment settings is a change to the repository settings. Show the user the exact commands and run them only after the user says yes. Use the commands in [../torus-frontend-ci-upgrade/reference.md](../torus-frontend-ci-upgrade/reference.md) with these values:

| Environment               | Approvers    | Branches that can deploy |
| ------------------------- | ------------ | ------------------------ |
| `lrc` (or existing name)  | none         | `master`                 |
| `staging`, when it exists | product team | `master`                 |
| `production` (or `prd`)   | admin team   | `master`                 |

## Risks to put in the PR body

- **AWS OIDC subject.** With `environment:` on a job, the OIDC subject changes from `repo:<org>/<repo>:ref:refs/heads/<branch>` to `repo:<org>/<repo>:environment:<name>`. The role in `AWS_ROLE_ARN` must trust the environment subjects, or every deploy fails. Check `gh api repos/<org>/<repo>/actions/oidc/customization/sub`. List it under **Before merge**.
- **Runs that wait.** Every merge creates a run that waits for approval. GitHub keeps at most one pending job in each `concurrency` group, so a newer run can cancel an older run that is still pending. Before you approve, check the Actions page and approve the newest run. Reject an old run that still waits; do not approve it after a newer run, because it deploys the older commit.
- **Approval per region.** Each region in the production matrix is one pending deployment. The reviewer approves all of them in one dialog.
- **Migrations.** When production runs database migrations, keep them in the production job (or a job that needs it), after the approval. Never run them before the approval.
- **Merge order.** The new workflow runs on `master`. When the PR targets `develop`, LRC stops deploying from `develop` pushes, and nothing deploys until `develop` merges into `master`.

## Done when

- `develop.yml` and `master.yml` are gone. `deploy.yml` deploys LRC on every merge, and staging and production only after their approvals.
- No workflow bumps the version, opens a release PR, checks for a changeset, or creates a tag.
- The environments have the approvers and branch rules above, or the PR body lists them as not done.
- The PR body has the current against new comparison, the OIDC check, and the after-merge steps.
- CI on the PR passes.
- The PR body describes the latest commit.
