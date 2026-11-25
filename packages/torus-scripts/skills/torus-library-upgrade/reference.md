# Stack upgrade reference

Read this when writing CODEOWNERS, Dependabot, `.npmrc`, or the PR body. CODEOWNERS follows `origin`'s org. A single package copies file shape and action SHAs from [eccrypto](https://github.com/torusresearch/eccrypto), including when `origin` is MetaMask. A monorepo copies file shape and action SHAs from the newest completed sibling on `origin`'s org at execution time.

## CODEOWNERS

Match `origin`.

MetaMask:

```
*                               @MetaMask/Web3Auth-Admins
src/                            @MetaMask/Web3Auth-Product
test/                           @MetaMask/Web3Auth-Product
.github/CODEOWNERS              @MetaMask/Web3Auth-Admins
```

torusresearch:

```
*                               @torusresearch/Admins
src/                            @torusresearch/Web3Auth-Product
test/                           @torusresearch/Web3Auth-Product
.github/CODEOWNERS              @torusresearch/Admins
```

Add `packages/`, `demo/`, or `examples/` with the product team only when those directories exist. Keep the guideline comment block from the sibling file.

For a monorepo, do not give the product team a bare `packages/` line. That also covers `package.json` and other files at the package root. When each package has `src/` and `test/`, use `packages/*/src/` and `packages/*/test/`, as wallet-services does. When product code lives in other folders, use `packages/*/*/` so only directories under the package, and the files inside them, go to the product team.

## Dependabot

```yaml
version: 2

updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    cooldown:
      default-days: 3
    open-pull-requests-limit: 10
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    cooldown:
      default-days: 3
```

Use `package-ecosystem: yarn` when the repo stays on Yarn. The 3-day cooldown stays. Packages named in the story's **Sequence and prerequisites** section still install at their latest published release inside that window.

## npmrc

```
min-release-age=3
allow-git=none
allow-remote=none
allow-scripts-pin=true
```

## Pull request template sections

Motivation and Context, Jira Link, Description, How has this been tested, Screenshots, Types of changes, Checklist.

Jira Link always includes the story the user named and EMBED-573.

## Evidence to record on the story

- Branch and PR link. Nothing published. `release-packages` stays manual.
- Majors taken, and majors skipped.
- `main`, `module`, and `types` before and after. Packed files.
- `npm audit` counts versus Dependabot. Alerts left open and why.
- Scanners that ran. CodeQL left on default setup. KICS, Trivy, AWS, and Wiz omitted or added.
- Node 24 and 26 results. Browser or service checks.
- Settings the token could not change, including Actions creating pull requests.
