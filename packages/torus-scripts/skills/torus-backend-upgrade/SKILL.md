---
name: torus-backend-upgrade
description: >-
  Add the backend-only steps to an EMBED-573 stack upgrade of a Torus or
  Web3Auth backend service (broadcast-channel-server, torus-signer,
  citadel-server, and similar): Docker images, Compose files, deploy workflows
  to ECR and ECS, KICS and Trivy, Wiz, and runtime majors
  such as redis, Sentry, and celebrate. Use together with torus-library-upgrade
  for a Torus backend, or with consensys-vertical-apps-backend-upgrade for a
  consensys-vertical-apps backend. Do not use it alone, and do not use it for a
  library or a frontend app.
---

# Upgrade a Torus backend repository

This skill comes from the broadcast-channel-server upgrade ([PR #215](https://github.com/torusresearch/broadcast-channel-server/pull/215), EMBED-605) and its follow-up container hardening ([PR #234](https://github.com/torusresearch/broadcast-channel-server/pull/234)). The backend reference repository is [broadcast-channel-server](https://github.com/torusresearch/broadcast-channel-server) on `develop`. Copy file shape and action pins from it at execution time.

## Which skill to use

Use this skill together with one base skill. It is not a full plan, and it does not replace the base skill.

| Repository                                                                                                | Load                                                     |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Torus backend, including citadel-server (Vite+, lint, and repo rules)                                     | `torus-library-upgrade` and this skill                   |
| consensys-vertical-apps backend, such as va-mmcx-subscription-api (repo rules only, no Vite+ and no lint) | `consensys-vertical-apps-backend-upgrade` and this skill |
| Torus library or SDK                                                                                      | `torus-library-upgrade` only                             |
| Torus frontend app                                                                                        | `torus-library-upgrade` and `torus-frontend-upgrade`     |

The package README has the table of all skills and where to use each.

The base skill owns the tickets, the working agreement, the step list, and the version rules. Follow its steps in order. This skill adds work to steps 1, 5, 6, 7, and 9, and replaces some base guidance. Where the two conflict on a backend, this skill wins. The conflicts are listed in **Overrides of the base skill**.

A repository is a backend when it has one or more of these: a `Dockerfile`, a `docker-compose*.yml`, a deploy workflow (ECR, ECS), or a server entry such as `node dist/index.js`. A repository that does not publish to npm, but has none of these, is not a backend. A private library stays on the base skill only.

## Overrides of the base skill

- **No release PR and no Changesets.** A backend publishes nothing and runs one version: the latest approved commit. Set `"private": true` in `package.json`. Do not add `release-pr`, Changesets, `version-packages`, or a changeset check, and do not ask for the GitHub setting that lets Actions open pull requests. A repo that already has `.changeset/` can keep it; record that nothing consumes it. `torus-backend-ci-upgrade` later sets up approval deploys without a version.
- **Engines on patched Node releases.** Use the Node security releases, not a bare `>=24.22.0`. broadcast-channel-server uses `"node": ">=24.22.1 <25 || >=26.12.1"`, `.nvmrc` `26.12.1`, and CI matrix `["24.22.1", "26.12.1"]`. A plain `>=24.22.1` lets Node 25 and older 26 releases in, and those releases do not have the security fixes. Look up the current security releases during the run.
- **No `npm pack` check in CI.** A private service does not ship a tarball.
- **Dependabot adds `docker`.** Add a `docker` ecosystem entry with the same weekly schedule and 3-day cooldown. Group GitHub Actions updates, and group npm minor and patch updates by dependency type. See [reference.md](reference.md).

## Step additions

### Step 1: GitHub policy files

Use the Dependabot file in [reference.md](reference.md), not the base file. CODEOWNERS and the PR template do not change.

### Step 5: repository rules

- TypeScript: extend `@toruslabs/config/tsconfig.node.json`. Set `"include": ["src"]` and `"rootDir": "./src"`. The build output moves from `dist/src/index.js` to `dist/index.js`. Update `main`, the `prod` script, the Dockerfile `CMD`, and every deploy task definition that names the old path.
- Replace `tsx` with `vpx` for `start` and `serve` (`vpx --watch src/index.ts`). Knex migrations use `NODE_OPTIONS='--import vite-plus/register' knex migrate:latest --knexfile ./src/database/knexfile.ts`. These are Vite+ changes. Do them only when `torus-library-upgrade` is the base skill.
- Husky 9 pre-commit runs `./node_modules/.bin/lint-staged`. Remove the old `husky.sh` lines.
- Vitest 5 clears mocks by default. When tests read mock calls from setup or from earlier tests, set `clearMocks: false` in `vite.config.mts` and in the test config. Add a comment with the Vite+ and Vitest migration links.
- Add `.dockerignore` with `coverage/`, `dist/`, `node_modules/`, and env files. Host output owned by root otherwise blocks test writes inside the container.
- Do the Docker and Compose changes in **Docker** and **Compose** below.

### Step 6: CI, deploy, and scanners

Do the work in **CI and deploy workflows** and **Container config scan** below. Add the Wiz sensor and the AWS role, because a backend deploys.

### Step 7: runtime majors

The base version rules still apply. These majors needed code changes on broadcast-channel-server. Check each one that the repository uses:

- **`redis` 6.** It defaults to RESP3 and a 5-second command timeout. The Socket.IO Redis adapter and `rate-limit-redis` parse raw replies, and queued commands must wait for a reconnect. Keep the v5 behavior: `createClient({ RESP: 2, commandOptions: { timeout: 0 }, socket: { ... } })`.
- **`@sentry/node` 11.** Install it with `@toruslabs/loglevel-sentry` 10, the release that typechecks against Sentry 11. Sentry 11 collects HTTP bodies, database query data, user info, and cookies by default. Request bodies often carry signed payloads or encrypted data. Set `dataCollection: { httpBodies: [], databaseQueryData: false, userInfo: false, cookies: false }` in `Sentry.init`.
- **`celebrate` 16.** It needs Joi 18. Remove a `joi` override and `@types/joi`. An old `joi` override forces Joi 17 under celebrate 16.
- **`knex-tiny-logger` 3.** Pass `logger: defaultLogger({ bindings: false, write: (message) => log.debug(message) })`. Type the `Knex` instance with `Record<string, unknown>` instead of `unknown`.
- **`rate-limit-redis` 6** and **`dotenv`** majors: typecheck and run the rate-limit tests.
- **`strictNullChecks`** from `@toruslabs/config@5`: Redis reads return `string | null`. Callback errors become `Error | null`.

List each major that is not in **Sequence and prerequisites** in the PR body, and ask reviewers to confirm it.

Security overrides are acceptable when no in-range fix exists. Give each one a GHSA link in the PR body. A dev-only advisory chain can stay open when `npm ci --omit=dev` keeps it out of the production image. Record that reason.

### Step 8: package.json cleanup

Backends often carry `tsx`, `cross-env`, `wait-port`, `rimraf`, `@types/joi`, and native build helpers. Remove each one only when nothing imports it and no script, Dockerfile, or workflow runs it. Remove `bufferutil` and `utf-8-validate` optional dependencies only when the lockfile does not need them for `ws`.

### Step 9: verify

Run the base checks, and also these:

- `npm run test:ci` (the Compose path) on each Node version in the CI matrix.
- `npm run migrate` against a local database.
- `npm run dev`, and confirm the container becomes healthy. On broadcast-channel-server, `vpx --watch` failed on a named import from the CommonJS `elliptic` package (`import { ec } from "elliptic"`).
- `docker build`, then run the image with `--cap-drop ALL --security-opt no-new-privileges:true`. `/health` must answer. `id -u` in the container must not be `0`.
- A local KICS scan. Record each alert left open and why.

Record the checks that did not run in the PR body.

## Docker

Use the templates in [reference.md](reference.md). The rules:

- Pin the base image to an exact patched release, such as `node:24.22.1-alpine`. Do not use `node:24-alpine`.
- Install npm 12 globally as root. Then install application dependencies as `node`.
- Copy `.npmrc` with `package.json` and `package-lock.json`, so `min-release-age` and `allow-*` apply in the image.
- Use `npm ci --ignore-scripts --no-audit --no-fund` in the build and production dependency stages.
- Do not use `COPY --chown`. KICS flags it. Copy as root, then `RUN chown`.
- In the production dependency stage, `chown -R root:root` the app before the final `COPY --from`. BuildKit keeps the source owner on `COPY --from`, and a `chown` in the final stage copies `node_modules` into a second layer.
- The final stage runs `USER node`, has a `HEALTHCHECK` on `/health`, and uses an exec-form `CMD ["node", "dist/index.js"]`.
- `apk add` needs root. Put it before `USER node`. Remove `python3`, `make`, and `g++` only when no installed package builds a native addon. Check `hasInstallScript` in the lockfile first.
- `--ignore-scripts` also skips native addon builds. For each lockfile package with `hasInstallScript` that the app loads at runtime, add `RUN npm rebuild <package>` after `npm ci` in the build and production dependency stages. Keep `python3`, `make`, and `g++` in those stages. Then load the addon in the image smoke test.
- `Dockerfile.dev` takes `ARG NODE_IMAGE`, so CI can test each matrix version. `node` owns `/app`. Sources stay root-owned. Use a long health check start period when the container runs migrations first.

## Compose

Apply to `docker-compose.yml`, `docker-compose.dev.yml`, and `docker-compose-ci.yml`:

- Every service: `cap_drop: [ALL]` and `security_opt: [no-new-privileges:true]`.
- Redis and MySQL: `user: redis` and `user: mysql`. The entrypoints then need no capabilities to chown or switch users. Do not use `cap_add`, because KICS flags it too.
- Dev and CI ports bind to `127.0.0.1`. The production port stays public. Dismiss that KICS alert as won't fix.
- The app service in dev and CI has a `/health` health check.
- The CI app service passes `NODE_IMAGE: ${NODE_IMAGE:-node:<pinned>-alpine}` as a build argument.

## CI and deploy workflows

See [reference.md](reference.md) for the job outlines.

- One `ci.yml` named `Validate`. Triggers: `pull_request` and `workflow_call` with an optional `ref` input and an optional `WIZ_SENSOR_TOKEN` secret. Remove `any-branch.yml` and the copied test jobs.
- The `test` job: Wiz sensor, checkout with `persist-credentials: false`, setup-node, npm 12, `npm ci`, `npm run harden:check`, `npm run check` (`vp check` also typechecks) when `torus-library-upgrade` is the base skill or `npm run typecheck` when `consensys-vertical-apps-backend-upgrade` is the base skill, `npm run build`, then `npm run test:ci` with `NODE_IMAGE=node:${{ matrix.node }}-alpine`.
- The `docker` job: build the image, start the Compose dependencies with `--wait`, run the image, poll `/health`, and check that the user is not root. Use a `trap` that prints the container logs and removes the containers on exit.
- No `release-notes` job: a backend has no changesets.
- Deploy workflows (`develop.yml`, `master.yml`) call `./.github/workflows/ci.yml` and pass `WIZ_SENSOR_TOKEN`. Add `concurrency` with `cancel-in-progress: false`. Add the Wiz sensor to every job. Use a region matrix instead of copied jobs.
- Build for ECR with `docker build --provenance=false`. ECR rejects the provenance attestation that Docker 29 adds.
- Quote every shell variable in deploy steps.

## Container config scan

Add `container-scan.yml` with KICS and Trivy jobs:

- `pull_request` paths: every `Dockerfile*`, every `docker-compose*.yml` (include the production file), and the workflow file itself.
- Also run on pushes to the deploy branches, weekly, and on `workflow_dispatch`.
- KICS fails on `critical,high` and uploads SARIF with category `kics`. Trivy runs `scan-type: config`, skips `node_modules`, fails on `HIGH,CRITICAL`, and uploads SARIF with category `trivy`.
- Each job has `security-events: write` and the Wiz sensor.

## Done when

The base skill's **Done when** holds. Also, each item in this skill is done, marked as not applying, or recorded in the PR body with the reason. The PR body names the majors outside **Sequence and prerequisites**, the security overrides, the open audit and KICS alerts, and the checks that did not run.
