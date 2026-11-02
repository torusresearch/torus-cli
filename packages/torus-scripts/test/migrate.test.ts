import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { inspectProject } from "../src/migrate/inspect.js";
import type { PathBlockerCode } from "../src/migrate/model.js";
import { formatReport } from "../src/migrate/report.js";
import { exitCodes, run, usage } from "../src/migrate/run.js";

async function writeFixture(root: string, files: Record<string, string>) {
  for (const [filePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(root, filePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, contents);
  }
}

async function fixture(files: Record<string, string> = {}): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "torus-migrate-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  await writeFixture(root, files);
  return root;
}

function blocker(code: PathBlockerCode, ...pathParts: string[]) {
  return { code, path: path.join(...pathParts) };
}

async function blockerCodes(root: string): Promise<string[]> {
  return (await inspectProject(root)).blockers.map(({ code }) => code);
}

async function runCli(args: string[]) {
  let stdout = "";
  let stderr = "";
  const code = await run(args, {
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
  });
  return { code, stdout, stderr };
}

const customPlugins = "export default { plugins: [customPlugin()] };\n";

describe("read-only migration inspection", () => {
  it("detects legacy config files and tools without changing bytes", async () => {
    const files = {
      "torus.config.js": "module.exports = {};\n",
      "rollup.config.mjs": "export default {};\n",
      ".browserslistrc": "defaults\n",
      "babel.config.js": "module.exports = {};\n",
      ".babelrc": "{}\n",
      "lerna.json": '{"version":"independent"}\n',
      "tsconfig.build.json": '{"compilerOptions":{}}\n',
      "package.json":
        JSON.stringify({
          scripts: { release: "release-it", publish: "lerna publish" },
          devDependencies: { lerna: "^9.0.0", "release-it": "^19.0.0" },
          workspaces: ["packages/*"],
        }) + "\n",
    };
    const root = await fixture(files);
    const originalBytes = new Map(
      await Promise.all(Object.keys(files).map(async (filePath) => [filePath, await readFile(path.join(root, filePath))] as const))
    );

    const result = await inspectProject(root);

    expect(result.findings).toEqual([
      { kind: "config", path: ".babelrc" },
      { kind: "config", path: ".browserslistrc" },
      { kind: "config", path: "babel.config.js" },
      { kind: "tool", tool: "Lerna", path: "lerna.json" },
      { kind: "tool", tool: "Lerna", path: "package.json" },
      { kind: "tool", tool: "release-it", path: "package.json" },
      { kind: "config", path: "rollup.config.mjs" },
      { kind: "config", path: "torus.config.js" },
      { kind: "config", path: "tsconfig.build.json" },
    ]);
    expect(result.blockers).toEqual([blocker("torus-config", "torus.config.js")]);
    for (const [filePath, bytes] of originalBytes) {
      assert.deepEqual(await readFile(path.join(root, filePath)), bytes);
    }
  });

  it("warns when a nested package manifest declares workspaces", async () => {
    const root = await fixture({ "packages/nested/package.json": JSON.stringify({ workspaces: ["children/*"] }) + "\n" });

    expect((await inspectProject(root)).blockers).toEqual([blocker("nested-workspaces", "packages", "nested", "package.json")]);
  });

  it("rejects missing and non-directory roots", async () => {
    const root = await fixture({ "not-a-directory": "file\n" });

    await expect(inspectProject(path.join(root, "missing"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(inspectProject(path.join(root, "not-a-directory"))).rejects.toThrow(/not a directory/);
  });

  it("does not warn about empty or commented plugin arrays", async () => {
    const root = await fixture({ "rollup.config.js": "export default { plugins: [] }; // plugins: [notAPlugin()]\n" });

    expect(await blockerCodes(root)).toEqual([]);
  });

  it("warns about non-empty plugin arrays", async () => {
    const root = await fixture({ "rollup.config.js": customPlugins });

    expect((await inspectProject(root)).blockers).toEqual([blocker("rollup-plugins", "rollup.config.js")]);
  });

  it("detects JavaScript and TypeScript Rollup configs by relative path", async () => {
    const root = await fixture({
      "packages/one/rollup.config.js": customPlugins,
      "packages/two/rollup.config.mjs": customPlugins,
      "packages/three/rollup.config.cjs": "module.exports = { plugins: [customPlugin()] };\n",
      "packages/four/rollup.config.ts":
        'import type { RollupOptions } from "rollup";\nexport default { plugins: [customPlugin()] } satisfies RollupOptions;\n',
    });

    expect((await inspectProject(root)).blockers).toEqual([
      blocker("rollup-plugins", "packages", "four", "rollup.config.ts"),
      blocker("rollup-plugins", "packages", "one", "rollup.config.js"),
      blocker("rollup-plugins", "packages", "three", "rollup.config.cjs"),
      blocker("rollup-plugins", "packages", "two", "rollup.config.mjs"),
    ]);
  });

  it("parses Rollup configs instead of matching text", async () => {
    const root = await fixture({
      "glob/rollup.config.js": 'export default { input: "src/*/index.ts", plugins: [] }; /* plugins: [notAPlugin()] */\n',
      "load-call/rollup.config.js": "export default { external: (id) => cache.load(id) };\n",
    });
    const configPath = path.join(root, "glob", "rollup.config.js");
    expect(await blockerCodes(root)).toEqual([]);

    for (const config of ["const shared = [x()];\nexport default { plugins: shared };\n", "export default { plugins };\n"]) {
      await writeFile(configPath, config);
      expect(await blockerCodes(root)).toEqual(["rollup-plugins"]);
    }

    await writeFile(configPath, "export default {\n");
    expect((await inspectProject(root)).blockers).toEqual([blocker("unparseable-rollup-config", "glob", "rollup.config.js")]);
  });

  it("inspects installed workspace packages that have their own node_modules", async () => {
    const root = await fixture({
      "packages/one/node_modules/dependency/package.json": JSON.stringify({ workspaces: ["ignored/*"] }) + "\n",
      "packages/one/package.json": JSON.stringify({ scripts: { release: "release-it" } }) + "\n",
      "packages/one/rollup.config.js": customPlugins,
    });

    const result = await inspectProject(root);

    expect(result.findings).toEqual([
      { kind: "tool", tool: "release-it", path: path.join("packages", "one", "package.json") },
      { kind: "config", path: path.join("packages", "one", "rollup.config.js") },
    ]);
    expect(result.blockers).toEqual([blocker("rollup-plugins", "packages", "one", "rollup.config.js")]);
  });

  it("follows symlinked package directories inside the root", async () => {
    const root = await fixture({ "node_modules/.store/linked/rollup.config.mjs": customPlugins });
    await mkdir(path.join(root, "packages"));
    await symlink(path.join(root, "node_modules", ".store", "linked"), path.join(root, "packages", "linked"), "dir");
    await symlink(root, path.join(root, "packages", "loop"), "dir");

    expect((await inspectProject(root)).blockers).toEqual([blocker("rollup-plugins", "packages", "linked", "rollup.config.mjs")]);
  });

  it("reports symlinks that leave the root without inspecting their targets", async () => {
    const root = await fixture();
    const outside = await fixture({ "rollup.config.mjs": customPlugins });
    await mkdir(path.join(root, "packages"));
    await symlink(outside, path.join(root, "packages", "linked"), "dir");
    await symlink(path.join(outside, "rollup.config.mjs"), path.join(root, "rollup.config.mjs"), "file");

    const result = await inspectProject(root);

    expect(result.findings).toEqual([]);
    expect(result.blockers).toEqual([blocker("escaped-symlink", "packages", "linked"), blocker("escaped-symlink", "rollup.config.mjs")]);
  });

  it("reports legacy torus-scripts signals in workspace packages", async () => {
    const root = await fixture({
      "package.json": JSON.stringify({ workspaces: ["packages/*"], devDependencies: { "@toruslabs/torus-scripts": "^8.1.0" } }) + "\n",
      "packages/one/package.json": JSON.stringify({ scripts: { build: "torus-scripts build" } }) + "\n",
      "packages/one/torus.config.js": "module.exports = {};\n",
      "packages/two/package.json": JSON.stringify({ devDependencies: { "@toruslabs/torus-scripts": "^7.2.0" } }) + "\n",
      "packages/three/package.json": JSON.stringify({ scripts: { check: "torus-scripts-upgrade ." } }) + "\n",
      "packages/four/package.json": JSON.stringify({ devDependencies: { "@toruslabs/torus-scripts": "latest" } }) + "\n",
    });

    const result = await inspectProject(root);

    expect(result.findings).toEqual(
      expect.arrayContaining([
        { kind: "legacy-scripts", path: path.join("packages", "one", "package.json") },
        { kind: "legacy-dependency", path: path.join("packages", "two", "package.json"), spec: "^7.2.0" },
      ])
    );
    expect(result.blockers).toEqual([
      blocker("unknown-dependency-version", "packages", "four", "package.json"),
      blocker("legacy-commands", "packages", "one", "package.json"),
      blocker("torus-config", "packages", "one", "torus.config.js"),
      blocker("legacy-dependency", "packages", "two", "package.json"),
    ]);
  });

  it("keeps Babel and browserslist configs out of the blockers", async () => {
    const root = await fixture({
      "packages/one/babel.config.js": "module.exports = {};\n",
      "packages/one/.browserslistrc": "defaults\n",
      "packages/one/tsconfig.build.json": "{}\n",
    });

    const result = await inspectProject(root);

    expect(result.findings).toHaveLength(3);
    expect(result.blockers).toEqual([]);
  });

  it("reports malformed package.json files and inspects the other files", async () => {
    const root = await fixture({
      "packages/broken/package.json": "{ not json\n",
      "packages/null/package.json": "null\n",
      "packages/odd/package.json": JSON.stringify({ dependencies: "lerna", scripts: ["lerna run build"] }) + "\n",
      "packages/good/package.json": JSON.stringify({ scripts: { release: "release-it" } }) + "\n",
    });

    const result = await inspectProject(root);

    expect(result.findings).toEqual([{ kind: "tool", tool: "release-it", path: path.join("packages", "good", "package.json") }]);
    expect(result.blockers).toEqual([
      blocker("unreadable-manifest", "packages", "broken", "package.json"),
      blocker("unreadable-manifest", "packages", "null", "package.json"),
    ]);
  });

  it("ignores manifests in build output, coverage, and test fixtures", async () => {
    const nestedWorkspace = JSON.stringify({ workspaces: ["nested/*"] }) + "\n";
    const root = await fixture({
      "package.json": JSON.stringify({ name: "root" }) + "\n",
      "dist/package.json": nestedWorkspace,
      "coverage/package.json": nestedWorkspace,
      "test/fixtures/sample/package.json": nestedWorkspace,
    });

    expect(await blockerCodes(root)).toEqual([]);
  });

  it("reports a blocker when the directory cap stops the walk", async () => {
    const root = await fixture({
      "a/package.json": "{}\n",
      "b/package.json": "{}\n",
      "c/rollup.config.js": "export default {};\n",
    });

    expect((await inspectProject(root, { maxDirectories: 2 })).blockers).toEqual([{ code: "truncated", limit: 2 }]);
    expect((await inspectProject(root, { maxDirectories: 4 })).blockers).toEqual([]);
  });

  it("flags multi-entry builds only when there is more than one entry or build", async () => {
    const root = await fixture({
      "single-array/rollup.config.js": 'export default { input: ["src/index.ts"] };\n',
      "single-object/rollup.config.js": 'export default { input: { main: "src/index.ts" } };\n',
      "single-build/rollup.config.js": 'export default [{ input: "src/index.ts", output: { file: "a.js" } }];\n',
    });
    expect(await blockerCodes(root)).toEqual([]);

    for (const config of [
      'export default { input: ["src/a.ts", "src/b.ts"] };\n',
      'export default { input: { a: "src/a.ts", b: "src/b.ts" } };\n',
      'export default [{ input: "src/a.ts" }, { input: "src/b.ts" }];\n',
      'module.exports = defineConfig([{ input: "src/a.ts" }, { input: "src/b.ts" }]);\n',
    ]) {
      await writeFile(path.join(root, "single-build", "rollup.config.js"), config);
      expect(await blockerCodes(root)).toEqual(["multi-entry"]);
    }
  });

  it("warns about custom Rollup behavior without loading user config", async () => {
    const root = await fixture();
    const marker = path.join(root, "config-was-executed");
    const rollupConfig = [
      'import { writeFileSync } from "node:fs";',
      `writeFileSync(${JSON.stringify(marker)}, "executed");`,
      "export default {",
      "  input: { first: 'src/a.js', second: 'src/b.js' },",
      "  plugins: [customTransform()],",
      "  transform(code) { return code; },",
      "  resolve: { alias: { process: 'polyfill' } },",
      "  output: { assetFileNames: 'assets/[name].js' },",
      "};",
    ].join("\n");
    await writeFile(path.join(root, "rollup.config.mjs"), rollupConfig);

    expect((await blockerCodes(root)).sort()).toEqual(["asset-handling", "multi-entry", "polyfills", "rollup-plugins", "rollup-transforms"]);
    await expect(readFile(marker)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(path.join(root, "rollup.config.mjs"), "utf8")).toBe(rollupConfig);
  });
});

describe("migration report", () => {
  it("lists findings and blockers with their paths", () => {
    const report = formatReport({
      findings: [{ kind: "config", path: "torus.config.js" }],
      blockers: [blocker("rollup-plugins", "rollup.config.js"), { code: "truncated", limit: 5 }],
    });

    expect(report).toContain("- torus.config.js\n");
    expect(report).toContain("- rollup.config.js: Custom Rollup plugins need a separate review.\n");
    expect(report).toContain("- Inspection stopped after 5 directories.");
    expect(report).toContain("Next steps\n- Run `vp migrate` at the workspace root.");
    expect(report).toContain("Skipped directories: node_modules,");
  });

  it("states when nothing was found", () => {
    const report = formatReport({ findings: [], blockers: [] });

    expect(report).toContain("- No legacy configuration detected.");
    expect(report).toContain("- No known unsupported behavior detected.");
  });
});

describe("torus-scripts-upgrade command", () => {
  it("prints usage for help flags", async () => {
    for (const flag of ["--help", "-h"]) {
      expect(await runCli([flag])).toEqual({ code: exitCodes.clean, stdout: usage, stderr: "" });
    }
  });

  it("rejects unknown options and wrong argument counts", async () => {
    for (const args of [["--verbose"], [], ["a", "b"]]) {
      expect(await runCli(args)).toEqual({ code: exitCodes.failed, stdout: "", stderr: usage });
    }
  });

  it("reports a missing project path", async () => {
    const missing = path.join(await fixture(), "missing");

    const { code, stderr } = await runCli([missing]);

    expect(code).toBe(exitCodes.failed);
    expect(stderr).toContain(`Unable to inspect ${missing}:`);
  });

  it("exits with the blocked code only when blockers exist", async () => {
    const plain = await fixture({ "package.json": JSON.stringify({ name: "plain" }) });
    const blocked = await fixture({ "rollup.config.js": customPlugins });

    const plainResult = await runCli([plain]);
    expect(plainResult.code).toBe(exitCodes.clean);
    expect(plainResult.stdout).toContain("Next steps");

    const blockedResult = await runCli([blocked]);
    expect(blockedResult.code).toBe(exitCodes.blocked);
    expect(blockedResult.stdout).toContain("rollup.config.js: Custom Rollup plugins need a separate review.");
  });
});
