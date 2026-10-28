# torus-cli

Torus CLI and devtools

## Packages

| Package                                                             | Description                              |
| ------------------------------------------------------------------- | ---------------------------------------- |
| [🚀 `create-torus-app`](/packages/torus-scripts)                    | The easiest way to get started with Web3 |
| [🚀 `eslint-config-javascript`](/packages/eslint-config-javascript) | ESLint config for JavaScript projects    |
| [🚀 `eslint-config-typescript`](/packages/eslint-config-typescript) | ESLint config for TypeScript projects    |
| [🚀 `eslint-config-node`](/packages/eslint-config-node)             | ESLint config for Node.js projects       |
| [🚀 `eslint-config-react`](/packages/eslint-config-react)           | ESLint config for React projects         |
| [🚀 `eslint-config-vue`](/packages/eslint-config-vue)               | ESLint config for Vue projects           |

## Release checks

CI checks Node 24.15.0 and Node 26 with npm 12.2.0. It checks dependency hardening and Changesets status.

GitHub CodeQL default setup scans JavaScript and TypeScript. The separate workflow runs Semgrep OSS.

Dependabot security updates, secret scanning, and push protection are enabled. Wiz covers all organization repositories, but its scan results here are unverified.

Review package files, security alerts, and the Changesets preview before release. Do not publish without approval.
