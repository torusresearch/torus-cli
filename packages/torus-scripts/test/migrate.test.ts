import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "vitest";

import { inspectProject } from "../src/migrate/inspect.ts";

const roots: string[] = [];
const cli = path.resolve("packages/torus-scripts/bin/torus-scripts-upgrade.js");

function runCli(projectPath: string) {
  return spawnSync(process.execPath, [cli, projectPath], { encoding: "utf8" });
}

async function createProject(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "torus-migrate-test-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("inspectProject", () => {
  it("rejects a missing project root", async () => {
    const root = path.join(os.tmpdir(), `missing-project-${Date.now()}`);
    await assert.rejects(inspectProject(root), (error: unknown) => {
      assert.match(String(error), /Project root does not exist:/);
      assert.match(String(error), new RegExp(root.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
      return true;
    });
  });

  it("rejects a file as the project root", async () => {
    const root = await createProject();
    const file = path.join(root, "not-a-directory");
    await writeFile(file, "not a directory");

    await assert.rejects(inspectProject(file), /Project root is not a directory/);
  });

  it("does not warn about an empty Rollup plugin list", async () => {
    const root = await createProject();
    await writeFile(path.join(root, "rollup.config.js"), "export default { plugins: [] };\n");

    const result = await inspectProject(root);

    assert.deepEqual(result.unsupported, []);
  });

  it("reports a custom Rollup plugin without executing its config", async () => {
    const root = await createProject();
    const config = path.join(root, "rollup.config.mjs");
    const sideEffect = path.join(root, "config-was-executed");
    await writeFile(
      config,
      `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(sideEffect)}, "yes");\nexport default { plugins: [customPlugin()] };\n`,
    );
    const originalConfig = await readFile(config);

    const result = await inspectProject(root);

    assert.match(result.unsupported.join("\n"), /rollup\.config\.mjs/);
    assert.match(result.unsupported.join("\n"), /custom Rollup plugin/i);
    await assert.rejects(readFile(sideEffect));
    assert.deepEqual(await readFile(config), originalConfig);
  });

  it("finds nested Rollup configs in the bounded workspace scan", async () => {
    const root = await createProject();
    const nested = path.join(root, "packages", "nested", "rollup.config.cjs");
    await mkdir(path.dirname(nested), { recursive: true });
    await writeFile(nested, "module.exports = { plugins: [customPlugin()] };\n");

    const result = await inspectProject(root);

    assert.match(result.unsupported.join("\n"), /packages[\\/]nested[\\/]rollup\.config\.cjs/);
  });

  it("reports a clear error and exits with code 2 for a missing CLI path", () => {
    const root = path.join(os.tmpdir(), `missing-cli-project-${Date.now()}`);
    const processResult = runCli(root);

    assert.equal(processResult.status, 2);
    assert.match(processResult.stderr, /Project root does not exist:/);
    assert.match(processResult.stderr, new RegExp(root.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  });

  it("exits with code 2 when the CLI path is not a directory", async () => {
    const root = await createProject();
    const file = path.join(root, "not-a-directory");
    await writeFile(file, "not a directory");

    const processResult = runCli(file);

    assert.equal(processResult.status, 2);
    assert.match(processResult.stderr, /Project root is not a directory:/);
  });
});
