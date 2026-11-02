import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, it } from "vite-plus/test";

import { repositoryDirectory } from "../../../test/lint-fixture.js";

it("scans JavaScript and TypeScript with CodeQL and Semgrep without tokens", async () => {
  const workflow = await readFile(path.join(repositoryDirectory, ".github/workflows/security-code-scanner.yml"), "utf8");
  expect(workflow).not.toContain("github/codeql-action/");
  expect(workflow).toContain("setuptools<81");
  expect(workflow).toContain("semgrep scan");
  expect(workflow).toMatch(/semgrep scan[^\n]*\s\.(?:\s|$)/m);
  expect(workflow).not.toMatch(/semgrep scan[^\n]*\spackages(?:\s|$)/m);
  for (const generated of ["node_modules", "dist", "build", "coverage"]) {
    expect(workflow).toContain(`--exclude '**/${generated}/**'`);
  }
  expect(workflow).toContain("p/javascript");
  expect(workflow).toContain("p/typescript");
  expect(workflow).not.toContain("SEMGREP_APP_TOKEN");
});
