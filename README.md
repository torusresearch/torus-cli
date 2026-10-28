# torus-cli

Torus CLI and devtools

## Packages

- [`@toruslabs/config`](packages/config): TypeScript profiles for libraries and applications.
- [`@toruslabs/torus-scripts`](packages/torus-scripts): Vite+ build and format presets.
- [`@toruslabs/eslint-config-javascript`](packages/eslint-config-javascript): ESLint config for JavaScript projects.
- [`@toruslabs/eslint-config-typescript`](packages/eslint-config-typescript): ESLint config for TypeScript projects.
- [`@toruslabs/eslint-config-node`](packages/eslint-config-node): ESLint config for Node.js projects.
- [`@toruslabs/eslint-config-react`](packages/eslint-config-react): ESLint config for React projects.
- [`@toruslabs/eslint-config-vue`](packages/eslint-config-vue): ESLint config for Vue projects.

## Release checks

CI checks Node 24.15.0 and Node 26 with npm 12.2.0. It checks dependency hardening, builds, tests, and Changesets status.

GitHub CodeQL default setup scans JavaScript and TypeScript. The separate workflow runs Semgrep OSS.

Dependabot security updates, secret scanning, and push protection are enabled. Wiz covers all organization repositories, but its scan results here are unverified.

Review package files, security alerts, and the Changesets preview before release. Do not publish without approval.

This workspace uses TypeScript 7.0.2 with Vite+ 1.4.0. Its source packages use explicit TypeScript project files for declaration builds.
