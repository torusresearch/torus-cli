# Backend upgrade reference

Read this when writing the Dockerfiles, Compose files, Dependabot, or workflows for a backend. Copy action SHAs and image versions from [broadcast-channel-server](https://github.com/torusresearch/broadcast-channel-server) on `develop` at execution time. The versions below are examples from that repository.

## Dockerfile

```dockerfile
FROM node:24.22.1-alpine AS base

# The npm binary stays root-owned. Application dependencies are installed below, as node.
RUN npm install --global npm@12.2.0

ENV NODE_OPTIONS=--max-old-space-size=4096

# COPY always runs as root, so the manifests are handed over with chown instead of COPY --chown, which KICS flags.
USER node
RUN mkdir -p /home/node/app
WORKDIR /home/node/app

COPY package.json package-lock.json .npmrc ./

USER root
RUN chown -R node:node /home/node/app
USER node

FROM base AS build

USER root
COPY . .
RUN chown -R node:node /home/node/app
USER node

RUN npm ci --ignore-scripts --no-audit --no-fund
RUN npm run build

FROM base AS prod-deps

RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY --from=build /home/node/app/dist ./dist

# BuildKit keeps the source owner on COPY --from. A chown in the final stage would copy node_modules into a second layer.
USER root
RUN chown -R root:root /home/node/app

FROM node:24.22.1-alpine

ENV NODE_OPTIONS=--max-old-space-size=4096
WORKDIR /app
COPY --from=prod-deps /home/node/app ./
USER node

EXPOSE 3051

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3051}/health" || exit 1

CMD ["node", "dist/index.js"]
```

## Dockerfile.dev

```dockerfile
ARG NODE_IMAGE=node:24.22.1-alpine
FROM ${NODE_IMAGE}

RUN npm install --global npm@12.2.0 && mkdir -p /app && chown node:node /app

ENV NODE_OPTIONS=--max-old-space-size=4096
WORKDIR /app

# Sources stay root-owned and read-only for node; node owns /app, so it can write node_modules and coverage.
COPY package.json package-lock.json .npmrc ./
USER node
RUN npm ci --no-audit --no-fund
COPY . .

EXPOSE 3051

# Long start period: the container runs migrations before the server starts.
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3051}/health" || exit 1

CMD ["sh", "-c", "npm run migrate && npm run serve"]
```

## Compose service hardening

```yaml
services:
  redis:
    image: redis:7-alpine
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    # Start as redis, so the entrypoint needs no capabilities to chown and switch users.
    user: redis
    ports:
      - "127.0.0.1:6379:6379"
  app:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1:3051/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 60s
    build:
      context: .
      dockerfile: Dockerfile.dev
      args:
        NODE_IMAGE: ${NODE_IMAGE:-node:24.22.1-alpine}
```

MySQL uses `user: mysql` in the same way.

## Dependabot

```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    cooldown:
      default-days: 3
    groups:
      github-actions:
        patterns: ["*"]
  - package-ecosystem: "docker"
    directories:
      - "/"
    schedule:
      interval: "weekly"
    cooldown:
      default-days: 3
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    cooldown:
      default-days: 3
    open-pull-requests-limit: 10
    groups:
      dev-dependencies:
        dependency-type: "development"
        update-types: ["minor", "patch"]
      production-dependencies:
        dependency-type: "production"
        update-types: ["minor", "patch"]
```

## Changesets config

```json
{
  "$schema": "https://unpkg.com/@changesets/config@4.0.1/schema.json",
  "baseBranch": "develop",
  "access": "restricted",
  "privatePackages": {
    "version": true,
    "tag": false
  },
  "updateInternalDependencies": "patch",
  "fixed": [],
  "linked": [],
  "ignore": []
}
```

## package.json scripts

```json
{
  "serve": "vpx --watch src/index.ts",
  "start": "vpx src/index.ts",
  "prod": "node dist/index.js",
  "check": "vp check",
  "typecheck": "tsc --noEmit",
  "harden:check": "harden check -p npm -l moderate",
  "test": "vp test run --config test/node.config.mts --coverage",
  "test:ci": "docker compose -f docker-compose-ci.yml up --build --abort-on-container-exit --exit-code-from <app-service>",
  "changeset": "changeset",
  "version-packages": "changeset version && npm install --package-lock-only --ignore-scripts"
}
```

## ci.yml outline

```yaml
name: Validate

on:
  pull_request:
  workflow_call:
    inputs:
      ref:
        description: Commit or branch to validate. Empty uses the calling commit.
        required: false
        type: string
        default: ""
    secrets:
      WIZ_SENSOR_TOKEN:
        required: false

permissions:
  contents: read

jobs:
  test: # matrix node: [<24 patch>, <26 patch>]; harden:check, check, build, test:ci with NODE_IMAGE
  docker: # docker build, compose up -d --wait <deps>, docker run, poll /health, id -u != 0, trap logs + cleanup
  release-notes:
    if: github.event_name == 'pull_request' && !startsWith(github.head_ref, 'changeset-release/') && !startsWith(github.head_ref, 'dependabot/')
    # checkout with ref: ${{ inputs.ref || github.sha }}, fetch-depth: 0, persist-credentials: false
    # run: npm exec --no -- changeset status --since="origin/${BASE_REF}"
```

Deploy workflows:

```yaml
concurrency:
  group: deploy-<branch>
  cancel-in-progress: false

jobs:
  test:
    uses: ./.github/workflows/ci.yml
    secrets:
      WIZ_SENSOR_TOKEN: ${{ secrets.WIZ_SENSOR_TOKEN }}
  release:
    needs: test
    permissions:
      contents: read
      id-token: write
    # Docker 29 adds a provenance attestation. ECR rejects that manifest.
    # docker build --provenance=false -t "$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" -t "$ECR_REGISTRY/$ECR_REPOSITORY:$GITHUB_SHA" .
```

## PR body additions

- A table of majors outside **Sequence and prerequisites**, with notes, and a request that reviewers confirm them.
- A table of security overrides, each with its GHSA link.
- `npm audit` counts, and which open findings are dev-only and absent from the production image.
- Container changes: base image, user, health check, and build output path.
- Checks that did not run locally, such as `test:ci`, the image build, or the container scans.
