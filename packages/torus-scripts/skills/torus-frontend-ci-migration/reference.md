# Frontend CI migration reference

The reference repository is [Web3Auth/auth-service](https://github.com/Web3Auth/auth-service). These files come from it:

| File                               | What it does                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `.github/workflows/release.yml`    | Push to `master` or `v<major>`: validate, develop, release check, staging, production, tag |
| `.github/workflows/deploy.yml`     | Reusable build and S3/CloudFront deploy for one environment                                |
| `.github/workflows/release-pr.yml` | `workflow_dispatch`: opens the `changeset-release/<branch>` PR                             |
| `.github/workflows/changeset.yml`  | PR check: a changeset is required                                                          |
| `.github/workflows/validate.yml`   | Adds the `Test release check` step                                                         |
| `scripts/releaseCheck.sh`          | Writes `release`, `version`, `major` to `$GITHUB_OUTPUT`                                   |
| `scripts/releaseCheck.test.sh`     | 7 cases against a temporary git repo                                                       |

## Release check rules

`scripts/releaseCheck.sh` decides from git alone:

- `release=true` only when the pushed commit changes the `package.json` version and no `v<version>` tag exists. A re-run after the tag, or a later push, does not release again.
- `major=true` only when the major is higher than every tag. A `v11` release after `v12` does not move the Lambda back.
- On a `v<N>` branch, a version with another major stops the job with an error, and `major` is always `false`.

## .changeset/config.json

```json
{
  "$schema": "../node_modules/@changesets/config/schema.json",
  "baseBranch": "master",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "privatePackages": { "version": true, "tag": false }
}
```

## .changeset/README.md

```markdown
# Changesets

Add a changeset to each PR that changes the app: `yarn changeset`.

To release:

1. Run the **Create release pull request** workflow on `master` or on a `v<major>` maintenance branch (for example `v11`).
   It opens a `changeset-release/<branch>` PR into that same branch. The version bump and the changelog stay on that branch.
2. Merge the PR. Then the deploy workflow:
   - from `master`: deploys staging (<product team> approves), then production (<admin team> approve), then tags the commit.
   - from `v<major>`: deploys production only (<admin team> approve), then tags the commit.

Maintenance branches never merge into `master` and never release a new major.
```

## Environment commands

Replace `<org>`, `<repo>`, and the team ids. Run only after the user approves.

```bash
R=repos/<org>/<repo>/environments
setenv() { printf '{"reviewers":[{"type":"Team","id":%s}],"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}' "$2" | gh api -X PUT "$R/$1" --input -; }
setenv staging <product-team-id>
setenv production <admin-team-id>
gh api -X POST "$R/staging/deployment-branch-policies" -f name=master -f type=branch
for p in master 'v[0-9]' 'v[0-9][0-9]'; do gh api -X POST "$R/production/deployment-branch-policies" -f name="$p" -f type=branch; done
```

Check the result:

```bash
for e in staging production; do gh api "repos/<org>/<repo>/environments/$e" --jq '{name, reviewers: [.protection_rules[] | select(.type=="required_reviewers") | .reviewers[].reviewer.slug]}'; gh api "repos/<org>/<repo>/environments/$e/deployment-branch-policies" --jq '[.branch_policies[].name]'; done
```

## PR body

Follow the repository PR template. Fill these parts:

- **Motivation:** the problems with the current process, as found in step "Before you start". For example: no approval before production, a version bump that CI never commits (or commits back with a script), merges across three branches, no changelog, no tag.
- **Current process:** a Mermaid `flowchart LR` of the current branches and deploys, and a table.
- **New process:** a Mermaid flowchart for `master`, one for `v<major>` maintenance branches (omit it when the repo has no versioned folders), and a table.
- Use the same rows in both tables: branches, start a release, version, changelog, approval before staging, approval before production, major release, tag and GitHub Release, maintenance.
- **Changes:** one line for each file.
- **GitHub settings:** the environment table, marked as done or not done.
- **Before merge:** the AWS OIDC trust policy.
- **After merge:** merge into `master` when the PR targets `develop`, make `master` the default branch, archive the old branches, prepare the maintenance branches, reopen the first release PR to start its checks.
- **How has this been tested:** the release check test, the changeset status check, the YAML parse, the format check, and the statement that no workflow has run on GitHub yet.

[Web3Auth/auth-service#406](https://github.com/Web3Auth/auth-service/pull/406) is a complete example.
