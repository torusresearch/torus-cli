# torus-cli

Torus CLI and devtools

## Packages

- [`@toruslabs/config`](packages/config): TypeScript profiles for libraries and applications.
- [`@toruslabs/torus-scripts`](packages/torus-scripts): Vite+ build and format presets. Use `torus-scripts-upgrade` to inspect an old project.
- [`@toruslabs/oxlint-config-typescript`](packages/oxlint-config-typescript): JavaScript and TypeScript lint preset.
- [`@toruslabs/oxlint-config-react`](packages/oxlint-config-react): React and Tailwind lint presets.
- [`@toruslabs/oxlint-config-vue`](packages/oxlint-config-vue): Vue and Tailwind lint presets.
- [`@toruslabs/oxlint-config-node`](packages/oxlint-config-node): Node lint preset.

## Release checks

CI checks Node 24.22.0 and Node 26 with npm 12.2.0. It checks dependency hardening, builds, tests, and Changesets status.

GitHub CodeQL default setup scans JavaScript and TypeScript. The separate workflow runs Semgrep OSS.

Dependabot security updates, secret scanning, and push protection are enabled. Wiz covers all organization repositories, but its scan results here are unverified.

Review package files, security alerts, and the Changesets preview before release. Do not publish without approval.

## Release

1. Run the "Create release pull request" workflow on `main` from the Actions tab. It runs `npm run version-packages` and opens the `chore: release packages` pull request. If one is already open, the workflow closes it and opens a new one, because the org ruleset blocks the force-push an update needs.
2. Review and merge that pull request.
3. On `main`, run `npm ci`, `npm run build`, and `npm run release-packages`. Then run `git push --follow-tags`.

This workspace uses TypeScript 7.0.2 with Vite+ 1.5.0. Its source packages use explicit TypeScript project files for declaration builds.
