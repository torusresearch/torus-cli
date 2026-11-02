import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, it } from "vite-plus/test";

import { repositoryDirectory } from "../../../test/lint-fixture.js";

it("runs hardened validation without publishing on pull requests", async () => {
  const workflow = await readFile(path.join(repositoryDirectory, ".github/workflows/validate-pr.yml"), "utf8");
  expect(workflow).toContain("pull_request:");
  expect(workflow).toContain("contents: read");
  expect(workflow).toContain("npm ci");
  expect(workflow).not.toContain("cache: npm");
  expect(workflow.indexOf("Install npm 12")).toBeLessThan(workflow.indexOf("npm ci"));
  expect(workflow).toContain("harden check --package-manager npm");
  expect(workflow).toContain("npm run check");
  expect(workflow).toContain("npm run typecheck");
  expect(workflow).toContain("npm run test");
  expect(workflow).toContain("npm run build");
  expect(workflow.indexOf("npm run build")).toBeLessThan(workflow.indexOf("npm run typecheck"));
  expect(workflow).toContain('git fetch --no-tags origin "${BASE_REF}:refs/remotes/origin/${BASE_REF}"');
  expect(workflow).toContain('changeset status --since="origin/${BASE_REF}"');
  expect(workflow).toContain("npm pack --workspaces --dry-run");
  expect(workflow).not.toContain("changeset publish");
});
