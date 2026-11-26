# Backend CI migration reference

## deploy.yml outline

This outline uses broadcast-channel-server's deploy steps. Copy the action pins from the repo's current workflows. Keep the repo's own ECR, ECS, region, and migration steps. `<...>` marks a value from the repo.

```yaml
name: deploy

# Every merge to master deploys LRC.
# The same run then waits for approval: staging (product team, when the repo has it), then production (admin team).
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

  deploy-production:
    needs: deploy-staging # deploy-lrc when the repo has no staging
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
```

Notes:

- Every deploy builds or pushes the image with the commit SHA as its tag. The SHA identifies what runs in each environment.
- When the old `master.yml` pushes the image once and deploys several services (citadel-server pushes to ECR, runs migrations, then deploys each service), keep that job chain. Put `environment: production` on the first job, and keep `needs:` between them.
- A failed or rejected job skips the jobs after it. Re-run the failed job to continue that run.
- To roll back, open an older successful run and re-run its production job. It deploys that run's commit.
