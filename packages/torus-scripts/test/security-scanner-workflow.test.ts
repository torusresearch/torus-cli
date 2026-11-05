import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, it } from "vite-plus/test";

import { repositoryDirectory } from "../../../test/lint-fixture.js";

it("uses the MetaMask security scanner without a Semgrep token", async () => {
  const workflow = await readFile(path.join(repositoryDirectory, ".github/workflows/security-code-scanner.yml"), "utf8");
  const pin = workflow.match(/security-scan\.yml@([0-9a-f]{40})/);

  expect(workflow).toContain("MetaMask/action-security-code-scanner/.github/workflows/security-scan.yml@");
  expect(workflow).not.toContain("github/codeql-action/");
  expect(workflow).not.toContain("SEMGREP_APP_TOKEN");
  expect(workflow).toContain("security-events: write");
  expect(pin?.[1]).toMatch(/^[0-9a-f]{40}$/);
  expect(workflow).toContain(`scanner-ref: ${pin?.[1]}`);
  for (const generated of ["node_modules", "dist", "build", "coverage"]) {
    expect(workflow).toContain(`**/${generated}/**`);
  }
});
