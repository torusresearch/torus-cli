# Backend CI migration reference

## release.yml outline

This outline uses broadcast-channel-server's deploy steps. Copy the action pins from the repo's current workflows. Keep the repo's own ECR, ECS, region, and migration steps. `<...>` marks a value from the repo.

```yaml
name: deploy

# Every push to master deploys LRC.
# A push that changes the package.json version also deploys production (admin approval), then tags it.
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
      # docker build --provenance=false and push, ECS update-service and wait: as in the old develop.yml.

  release-check:
    needs: test
    runs-on: ubuntu-latest
    outputs:
      release: ${{ steps.check.outputs.release }}
      version: ${{ steps.check.outputs.version }}
    steps:
      # Wiz sensor
      - name: Checkout
        uses: actions/checkout@<pin>
        with:
          # Full history for the parent commit and the tags.
          fetch-depth: 0
          persist-credentials: false
      - name: Check for a new version
        id: check
        run: ./scripts/releaseCheck.sh

  deploy-production:
    needs: release-check
    if: needs.release-check.outputs.release == 'true'
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

  tag-release:
    needs: [release-check, deploy-production]
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      # Wiz sensor, checkout (persist-credentials: false), then the
      # "Create GitHub release" step from auth-service's release.yml.
      # A backend has only master, so --latest is always true; drop the latest= line.
```

Notes:

- `deploy-production` needs only `release-check`, not `deploy-lrc`. LRC already runs on every push, and a failed LRC deploy must not hide a release. When the team wants LRC first, add `deploy-lrc` to `needs`.
- When the old `master.yml` pushes the image once and deploys several services (citadel-server pushes to ECR, runs migrations, then deploys each service), keep that job chain. Put `environment: production` on the first job, and keep `needs:` between them.
- The tag job runs once, after every region succeeds. A failed region skips the tag; a re-run of the failed jobs then creates it.

## release-pr.yml changes to torus-cli's file

```yaml
jobs:
  release-pr:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - name: Check the branch
        run: |
          if [[ "$GITHUB_REF_NAME" != master ]]; then
            echo "::error::Run this workflow on master."
            exit 1
          fi
      # Wiz sensor, then the torus-cli steps unchanged:
      # checkout (fetch-depth: 0), setup-node from .nvmrc, npm 12, npm ci,
      # delete the old changeset-release/master branch, changesets/action with
      # version-script: npm run version-packages.
```
