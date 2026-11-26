---
"@toruslabs/torus-scripts": patch
---

Ship `torus-frontend-ci-upgrade` and `torus-backend-ci-upgrade` skills. Both move an app's CI to one `master` trunk with GitHub Environment approvals. Frontend apps release through Changesets release PRs; backends deploy every merge to LRC and then wait for approval before staging and production, with a changelog from changeset entries, a PR comment of unreleased changes, and a GitHub Release for each production deploy. Both require a changeset unless a PR changes only allowlisted files (docs, CI, tests).
