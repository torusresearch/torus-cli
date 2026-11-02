# torus-cli

Torus CLI and devtools

## Packages

- [`@toruslabs/config`](packages/config): TypeScript profiles for libraries and applications.
- [`@toruslabs/torus-scripts`](packages/torus-scripts): Vite+ build and format presets.
- [`@toruslabs/oxlint-config-typescript`](packages/oxlint-config-typescript): JavaScript and TypeScript lint preset.
- [`@toruslabs/oxlint-config-react`](packages/oxlint-config-react): React and Tailwind lint presets.
- [`@toruslabs/oxlint-config-vue`](packages/oxlint-config-vue): Vue lint preset.
- [`@toruslabs/oxlint-config-node`](packages/oxlint-config-node): Node lint preset.

## Release checks

CI checks Node 24.22.0 and Node 26 with npm 12.2.0. It checks dependency hardening, builds, tests, and Changesets status.

GitHub CodeQL default setup scans JavaScript and TypeScript. The separate workflow runs Semgrep OSS.

Dependabot security updates, secret scanning, and push protection are enabled. Wiz covers all organization repositories, but its scan results here are unverified.

Review package files, security alerts, and the Changesets preview before release. Do not publish without approval.

This workspace uses TypeScript 7.0.2 with Vite+ 1.4.0. Its source packages use explicit TypeScript project files for declaration builds.
