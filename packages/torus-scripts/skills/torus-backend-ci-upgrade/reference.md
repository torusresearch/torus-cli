# Backend CI migration reference

`<...>` marks a value from the repo. Copy the action pins from the repo's current workflows.

## .changeset/config.json

The entries are the changelog. Nobody runs `changeset version`.

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "baseBranch": "master",
  "access": "restricted",
  "privatePackages": { "version": true, "tag": false }
}
```

## changeset.yml

Uses `scripts/changesetCheck.sh` from auth-service. The check needs no install.

```yaml
name: changeset

# A PR into master needs a changeset unless every file it changes is on the allowlist below (docs, CI, tests).
# Dependabot PRs and PRs with the skip-changeset label need none.
on:
  pull_request:
    branches: [master]
    types: [opened, synchronize, reopened, labeled, unlabeled]

permissions: {}

jobs:
  check:
    if: >-
      github.event.pull_request.user.login != 'dependabot[bot]'
      && !contains(github.event.pull_request.labels.*.name, 'skip-changeset')
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      # Wiz sensor
      - name: Checkout
        uses: actions/checkout@<pin>
        with:
          # The check compares the PR with the base branch.
          fetch-depth: 0
          persist-credentials: false
      - name: Check for a changeset
        run: ./scripts/changesetCheck.sh "origin/${BASE_REF}"
        env:
          BASE_REF: ${{ github.base_ref }}
          # Allowlist: files that never change what ships. Every other file needs a changeset.
          NO_CHANGESET_PATHS: '^(\.github/|\.vscode/|docs/|test/|README\.md$|CHANGELOG\.md$)|(^|/)__tests__/|\.test\.([cm]?[jt]s|sh)$|(^|/)(changesetCheck|prdChangelog)\.sh$'
```

## scripts/prdChangelog.sh

Prints the changeset entries and commits that are not in production yet. It finds the last production commit like `prd-changelog` in va-mmcx-authentication-api: the latest successful deployment to the production environment.

````bash
#!/usr/bin/env bash
set -euo pipefail

# Prints, as Markdown, the changeset entries and commits that are in <to-ref> but not in production yet.
# The last production commit is the latest successful deployment to $PROD_ENVIRONMENT (GitHub Deployments API).
# Set PREV_SHA to skip that lookup (an empty PREV_SHA means "no production deployment yet").
# Writes prev=<sha> to $GITHUB_OUTPUT when it is set. Needs GH_TOKEN with deployments: read for the lookup.
# Usage: prdChangelog.sh <to-ref>

to=$(git rev-parse "${1:-HEAD}")
title="${TITLE:-Changes not in production yet}"

if [[ -z "${PREV_SHA+set}" ]]; then
  PREV_SHA=""
  # Every merge adds a production deployment that waits (one per region), so read all pages, newest first.
  for id in $(gh api --paginate "repos/${GITHUB_REPOSITORY}/deployments?environment=${PROD_ENVIRONMENT:-production}&per_page=100" --jq '.[].id'); do
    state=$(gh api "repos/${GITHUB_REPOSITORY}/deployments/${id}/statuses?per_page=1" --jq '.[0].state // empty')
    if [[ "$state" == success ]]; then
      PREV_SHA=$(gh api "repos/${GITHUB_REPOSITORY}/deployments/${id}" --jq .sha)
      break
    fi
  done
fi
[[ -n "${GITHUB_OUTPUT:-}" ]] && echo "prev=${PREV_SHA}" >> "$GITHUB_OUTPUT"

echo "### ${title}"
echo
if [[ -n "$PREV_SHA" ]]; then
  echo "\`${PREV_SHA:0:7}\` → \`${to:0:7}\`"
  entries=$(git diff --name-only --diff-filter=A "$PREV_SHA" "$to" -- .changeset)
  commits=$(git log --no-merges --oneline "$PREV_SHA..$to")
else
  echo "_No production deployment found. Showing the last 20 commits._"
  entries=""
  commits=$(git log --no-merges --oneline -20 "$to")
fi
echo
echo "**Changelog**"
echo
found=0
for file in $(grep -E '^\.changeset/.+\.md$' <<<"$entries" | grep -v '^\.changeset/README\.md$' || true); do
  # The entry text is everything after the second '---' line of the changeset.
  text=$(git show "$to:$file" | awk 'n >= 2 { print } /^---$/ { n++ }' | tr '\n' ' ' | sed 's/  */ /g; s/^ //; s/ $//')
  echo "- ${text} (\`${file}\`)"
  found=1
done
[[ $found -eq 0 ]] && echo "- No changeset entries."
echo
echo "**Commits**"
echo
echo '```'
echo "${commits:-No commits.}"
echo '```'
````

## scripts/prdChangelog.test.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

# Runs prdChangelog.sh against a temporary git repo, with PREV_SHA set so no GitHub API call happens.

script="$(cd "$(dirname "$0")" && pwd)/prdChangelog.sh"
repo=$(mktemp -d)
trap 'rm -r "$repo"' EXIT
cd "$repo"
git init -q -b master
git config user.email test@example.com
git config user.name test
git config commit.gpgsign false
unset GITHUB_OUTPUT

mkdir -p .changeset src
echo "# Changesets" > .changeset/README.md
echo a > src/app.ts
git add . && git commit -qm "chore: base"
prod=$(git rev-parse HEAD)

printf -- '---\n"app": patch\n---\n\nFix the login\nredirect.\n' > .changeset/fix-login.md
echo b > src/app.ts
git add . && git commit -qm "fix: login redirect"
echo "more" >> .changeset/README.md
git add . && git commit -qm "docs: changeset readme"

failures=0
check() { # check <name> <output> <expected substring> [absent]
  if [[ ("${4:-}" == absent && "$2" != *"$3"*) || ("${4:-}" != absent && "$2" == *"$3"*) ]]; then
    echo "ok   $1"
  else
    echo "FAIL $1"
    failures=$((failures + 1))
  fi
}

out=$(PREV_SHA="$prod" "$script" HEAD)
check "lists the changeset text on one line" "$out" "- Fix the login redirect. (\`.changeset/fix-login.md\`)"
check "lists the commits since production" "$out" "fix: login redirect"
check "does not list the production commit" "$out" "chore: base" absent
check "skips the changeset README" "$out" "README.md" absent

out=$(PREV_SHA="$(git rev-parse HEAD)" "$script" HEAD)
check "nothing new after production" "$out" "- No changeset entries."

out=$(PREV_SHA="" "$script" HEAD)
check "no production deployment yet" "$out" "No production deployment found"

out=$(PREV_SHA="$prod" TITLE="Changes in this PR" "$script" HEAD)
check "custom title" "$out" "### Changes in this PR"

exit $((failures > 0))
```

## unreleased.yml

One comment on each PR, updated on every push.

```yaml
name: unreleased

# Comments on each PR with the changes merged but not in production yet, and the changes in this PR.
on:
  pull_request:
    branches: [master]
    types: [opened, synchronize, reopened]

permissions: {}

jobs:
  comment:
    # A PR from a fork gets a read-only token.
    if: github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: read
      pull-requests: write
    steps:
      # Wiz sensor
      - name: Checkout
        uses: actions/checkout@<pin>
        with:
          fetch-depth: 0
          persist-credentials: false
      - name: Write the comment
        env:
          GH_TOKEN: ${{ github.token }}
          BASE_REF: ${{ github.base_ref }}
          PR: ${{ github.event.pull_request.number }}
          PROD_ENVIRONMENT: <production environment name>
        run: |
          {
            echo "<!-- unreleased-changes -->"
            ./scripts/prdChangelog.sh "origin/${BASE_REF}"
            echo
            PREV_SHA=$(git merge-base "origin/${BASE_REF}" HEAD) TITLE="Changes in this PR" ./scripts/prdChangelog.sh HEAD
          } > comment.md
          # Read every match first: `| head -1` would end gh early, and pipefail fails the step.
          ids=$(gh api "repos/${GITHUB_REPOSITORY}/issues/${PR}/comments" --paginate \
            --jq '.[] | select(.user.login == "github-actions[bot]" and (.body | startswith("<!-- unreleased-changes -->"))) | .id')
          id="${ids%%$'\n'*}"
          if [[ -n "$id" ]]; then
            gh api -X PATCH "repos/${GITHUB_REPOSITORY}/issues/comments/${id}" -F body=@comment.md > /dev/null
          else
            gh api -X POST "repos/${GITHUB_REPOSITORY}/issues/${PR}/comments" -F body=@comment.md > /dev/null
          fi
```

## deploy.yml outline

This outline uses broadcast-channel-server's deploy steps. Keep the repo's own ECR, ECS, region, and migration steps.

```yaml
name: deploy

# Every merge to master deploys LRC. The same run then waits for approval:
# staging (product team, when the repo has it), then production (admin team), then a GitHub Release.
on:
  push:
    branches: [master]

permissions:
  contents: read

jobs:
  test:
    uses: ./.github/workflows/ci.yml
    secrets:
      WIZ_SENSOR_TOKEN: ${{ secrets.WIZ_SENSOR_TOKEN }}

  deploy-lrc:
    needs: test
    runs-on: ubuntu-latest
    environment: lrc
    concurrency:
      group: deploy-lrc
      cancel-in-progress: false
    permissions:
      contents: read
      id-token: write
    steps:
      # Wiz sensor, checkout (persist-credentials: false), AWS credentials, ECR login,
      # docker build --provenance=false and push (tag with $GITHUB_SHA), ECS update-service and wait:
      # as in the old develop.yml.

  # Only when the repo has a staging environment.
  deploy-staging:
    needs: deploy-lrc
    runs-on: ubuntu-latest
    # The staging environment requires the product team, so this job waits for approval.
    environment: staging
    concurrency:
      group: deploy-staging
      cancel-in-progress: false
    permissions:
      contents: read
      id-token: write
    steps:
      # The staging deploy steps from the old workflow, unchanged.

  prd-changelog:
    needs: deploy-staging # deploy-lrc when the repo has no staging
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: read
    outputs:
      prev: ${{ steps.changelog.outputs.prev }}
    steps:
      # Wiz sensor
      - name: Checkout
        uses: actions/checkout@<pin>
        with:
          fetch-depth: 0
          persist-credentials: false
      - name: Write the production changelog
        id: changelog
        # On the step, not the job: the job then succeeds, so a GitHub API error never skips production.
        # The release then shows the last 20 commits, because prev stays empty.
        continue-on-error: true
        run: ./scripts/prdChangelog.sh "$GITHUB_SHA" >> "$GITHUB_STEP_SUMMARY"
        env:
          GH_TOKEN: ${{ github.token }}
          PROD_ENVIRONMENT: <production environment name>

  deploy-production:
    needs: prd-changelog
    runs-on: ubuntu-latest
    # The production environment requires the admin team, so each region waits for approval.
    environment: production
    concurrency:
      group: deploy-production-${{ matrix.name }}
      cancel-in-progress: false
    permissions:
      contents: read
      id-token: write
    strategy:
      fail-fast: false
      matrix:
        name: [<regions>]
    steps:
      # The steps of the old master.yml release job, unchanged.

  release:
    needs: [prd-changelog, deploy-production]
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      # Wiz sensor
      - name: Checkout
        uses: actions/checkout@<pin>
        with:
          fetch-depth: 0
          persist-credentials: false
      # PREV_SHA comes from before the deploy; a lookup now would find this deploy.
      - name: Create the GitHub Release
        run: |
          tag="prod-$(date -u +%Y%m%d)-${GITHUB_RUN_NUMBER}.${GITHUB_RUN_ATTEMPT}"
          TITLE="Production deploy ${tag}" ./scripts/prdChangelog.sh "$GITHUB_SHA" > notes.md
          gh release create "$tag" --repo "$GITHUB_REPOSITORY" --target "$GITHUB_SHA" --title "$tag" --notes-file notes.md
        env:
          GH_TOKEN: ${{ github.token }}
          PREV_SHA: ${{ needs.prd-changelog.outputs.prev }}
```

Notes:

- Every deploy builds or pushes the image with the commit SHA as its tag. The SHA identifies what runs in each environment.
- When the old `master.yml` pushes the image once and deploys several services (citadel-server pushes to ECR, runs migrations, then deploys each service), keep that job chain. Put `environment: production` on the first job, and keep `needs:` between them.
- A failed or rejected job skips the jobs after it. Re-run the failed job to continue that run.
- To roll back, open an older successful run and re-run its production job. It deploys that run's commit, and its `release` job creates a new release with a new run attempt in the tag.
