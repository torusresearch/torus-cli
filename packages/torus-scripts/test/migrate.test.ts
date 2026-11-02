import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

import { inspectProject } from "../src/migrate/inspect.js";
import { formatReport } from "../src/migrate/report.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(testDirectory, "..");
async function writeFixture(root: string, files: Record<string, string>) {
  for (const [filePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(root, filePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, contents);
  }
}

describe("read-only migration inspection", () => {
  it("detects legacy config files and migration scripts without changing bytes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "torus-migrate-inspect-"));
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
      "packages/child/package.json": JSON.stringify({ workspaces: ["nested/*"] }) + "\n",
    };

    try {
      await writeFixture(root, files);
      const originalBytes = new Map(
        await Promise.all(Object.keys(files).map(async (filePath) => [filePath, await readFile(path.join(root, filePath))] as const))
      );

      const result = await inspectProject(root);

      expect(result.found).toEqual(
        expect.arrayContaining([
          "torus.config.js",
          "rollup.config.mjs",
          ".browserslistrc",
          "babel.config.js",
          ".babelrc",
          "tsconfig.build.json",
          "Lerna",
          "release-it",
        ])
      );
      expect(result.unsupported).toContain("Nested workspace migration needs a separate review.");
      expect(result.next).toEqual(
        expect.arrayContaining([
          "Run `vp migrate` at the workspace root.",
          "Review rewritten files before you accept the migration.",
          "Select the library, Node, React, or Vue profile that matches each package.",
          "Configure Changesets at the repository root.",
        ])
      );

      for (const [filePath, bytes] of originalBytes) {
        assert.deepEqual(await readFile(path.join(root, filePath)), bytes);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("warns when a nested package manifest declares workspaces", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "torus-migrate-workspaces-"));

    try {
      await writeFixture(root, {
        "packages/nested/package.json": JSON.stringify({ workspaces: ["children/*"] }) + "\n",
      });

      const result = await inspectProject(root);

      expect(result.unsupported).toContain("Nested workspace migration needs a separate review.");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects missing and non-directory roots", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "torus-migrate-invalid-root-"));
    const filePath = path.join(root, "not-a-directory");

    try {
      await writeFile(filePath, "file\n");

      await expect(inspectProject(path.join(root, "missing"))).rejects.toThrow(/./);
      await expect(inspectProject(filePath)).rejects.toThrow(/./);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not warn about empty or commented plugin arrays", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "torus-migrate-empty-plugins-"));

    try {
      await writeFixture(root, {
        "rollup.config.js": "export default { plugins: [] }; // plugins: [notAPlugin()]\n",
      });

      const result = await inspectProject(root);

      expect(result.unsupported).not.toContain("Custom Rollup plugins need a separate review.");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("warns about non-empty plugin arrays", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "torus-migrate-nonempty-plugins-"));

    try {
      await writeFixture(root, {
        "rollup.config.js": "export default { plugins: [customPlugin()] };\n",
      });

      const result = await inspectProject(root);

      expect(result.unsupported).toContain("Custom Rollup plugins need a separate review.");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("detects nested Rollup config files by relative path", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "torus-migrate-nested-rollup-"));

    try {
      await writeFixture(root, {
        "packages/one/rollup.config.js": "export default { plugins: [customPlugin()] };\n",
        "packages/two/rollup.config.mjs": "export default { plugins: [customPlugin()] };\n",
        "packages/three/rollup.config.cjs": "module.exports = { plugins: [customPlugin()] };\n",
      });

      const result = await inspectProject(root);

      expect(result.found).toEqual(
        expect.arrayContaining(["packages/one/rollup.config.js", "packages/two/rollup.config.mjs", "packages/three/rollup.config.cjs"])
      );
      expect(result.unsupported).toContain("Custom Rollup plugins need a separate review.");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("inspects installed workspace packages that have their own node_modules", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "torus-migrate-installed-"));

    try {
      await writeFixture(root, {
        "packages/one/node_modules/dependency/package.json": JSON.stringify({ workspaces: ["ignored/*"] }) + "\n",
        "packages/one/package.json": JSON.stringify({ scripts: { release: "release-it" } }) + "\n",
        "packages/one/rollup.config.js": "export default { plugins: [customPlugin()] };\n",
      });

      const result = await inspectProject(root);

      expect(result.found).toEqual(expect.arrayContaining(["packages/one/rollup.config.js", "release-it"]));
      expect(result.unsupported).toEqual(["Custom Rollup plugins need a separate review."]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("follows symlinked package directories inside the root", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "torus-migrate-symlink-"));

    try {
      await writeFixture(root, { "node_modules/.store/linked/rollup.config.mjs": "export default { plugins: [customPlugin()] };\n" });
      await mkdir(path.join(root, "packages"), { recursive: true });
      await symlink(path.join(root, "node_modules", ".store", "linked"), path.join(root, "packages", "linked"), "dir");
      await symlink(root, path.join(root, "packages", "loop"), "dir");

      const result = await inspectProject(root);

      expect(result.found).toContain(path.join("packages", "linked", "rollup.config.mjs"));
      expect(result.unsupported).toEqual(["Custom Rollup plugins need a separate review."]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports symlinks that leave the root without inspecting their targets", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "torus-migrate-escape-"));
    const outside = await mkdtemp(path.join(tmpdir(), "torus-migrate-escape-target-"));

    try {
      await writeFixture(outside, { "rollup.config.mjs": "export default { plugins: [customPlugin()] };\n" });
      await mkdir(path.join(root, "packages"), { recursive: true });
      await symlink(outside, path.join(root, "packages", "linked"), "dir");
      await symlink(path.join(outside, "rollup.config.mjs"), path.join(root, "rollup.config.mjs"), "file");

      const result = await inspectProject(root);

      expect(result.found).toEqual([]);
      expect(result.unsupported).toEqual([
        `Symlink outside the inspection root was not inspected: ${path.join("packages", "linked")}`,
        "Symlink outside the inspection root was not inspected: rollup.config.mjs",
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("reports legacy torus-scripts signals in workspace packages", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "torus-migrate-legacy-package-"));

    try {
      await writeFixture(root, {
        "package.json": JSON.stringify({ workspaces: ["packages/*"], devDependencies: { "@toruslabs/torus-scripts": "^8.1.0" } }) + "\n",
        "packages/one/package.json": JSON.stringify({ scripts: { build: "torus-scripts build" } }) + "\n",
        "packages/one/torus.config.js": "module.exports = {};\n",
        "packages/one/babel.config.js": "module.exports = {};\n",
        "packages/two/package.json": JSON.stringify({ devDependencies: { "@toruslabs/torus-scripts": "^7.2.0" } }) + "\n",
        "packages/three/package.json": JSON.stringify({ scripts: { check: "torus-scripts-upgrade ." } }) + "\n",
      });

      const result = await inspectProject(root);

      expect(result.found).toEqual(
        expect.arrayContaining([
          path.join("packages", "one", "torus.config.js"),
          path.join("packages", "one", "babel.config.js"),
          `${path.join("packages", "one", "package.json")}: torus-scripts commands`,
          `${path.join("packages", "two", "package.json")}: @toruslabs/torus-scripts ^7.2.0`,
        ])
      );
      expect(result.unsupported).toEqual([
        "@toruslabs/torus-scripts before v8 needs manual replacement.",
        "Legacy `torus-scripts` commands need manual replacement with `vp` tasks.",
        "Legacy torus.config files need manual replacement.",
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps Babel and browserslist configs out of the blockers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "torus-migrate-found-only-"));

    try {
      await writeFixture(root, {
        "packages/one/babel.config.js": "module.exports = {};\n",
        "packages/one/.browserslistrc": "defaults\n",
        "packages/one/tsconfig.build.json": "{}\n",
      });

      const result = await inspectProject(root);

      expect(result.found).toHaveLength(3);
      expect(result.unsupported).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports a malformed package.json and inspects the other files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "torus-migrate-malformed-"));

    try {
      await writeFixture(root, {
        "packages/broken/package.json": "{ not json\n",
        "packages/good/package.json": JSON.stringify({ scripts: { release: "release-it" } }) + "\n",
      });

      const result = await inspectProject(root);

      expect(result.found).toContain("release-it");
      expect(result.unsupported).toEqual([`Unreadable package.json needs a separate review: ${path.join("packages", "broken", "package.json")}`]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("ignores manifests in build output, coverage, and test fixtures", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "torus-migrate-ignored-"));
    const nestedWorkspace = JSON.stringify({ workspaces: ["nested/*"] }) + "\n";

    try {
      await writeFixture(root, {
        "package.json": JSON.stringify({ name: "root" }) + "\n",
        "dist/package.json": nestedWorkspace,
        "coverage/package.json": nestedWorkspace,
        "test/fixtures/sample/package.json": nestedWorkspace,
      });

      const result = await inspectProject(root);

      expect(result.unsupported).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports a blocker when the directory cap stops the walk", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "torus-migrate-cap-"));

    try {
      await writeFixture(root, {
        "a/package.json": "{}\n",
        "b/package.json": "{}\n",
        "c/rollup.config.js": "export default {};\n",
      });

      const capped = await inspectProject(root, { maxDirectories: 2 });
      expect(capped.unsupported).toEqual(["Inspection stopped after 2 directories. Review the remaining directories by hand."]);

      const complete = await inspectProject(root, { maxDirectories: 4 });
      expect(complete.unsupported).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("flags multi-entry builds only when there is more than one entry or build", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "torus-migrate-multi-entry-"));

    try {
      await writeFixture(root, {
        "single-array/rollup.config.js": 'export default { input: ["src/index.ts"] };\n',
        "single-object/rollup.config.js": 'export default { input: { main: "src/index.ts" } };\n',
        "single-build/rollup.config.js": 'export default [{ input: "src/index.ts", output: { file: "a.js" } }];\n',
      });
      expect((await inspectProject(root)).unsupported).not.toContain("Multi-entry builds need a separate review.");

      for (const config of [
        'export default { input: ["src/a.ts", "src/b.ts"] };\n',
        'export default { input: { a: "src/a.ts", b: "src/b.ts" } };\n',
        'export default [{ input: "src/a.ts" }, { input: "src/b.ts" }];\n',
        'module.exports = defineConfig([{ input: "src/a.ts" }, { input: "src/b.ts" }]);\n',
      ]) {
        await writeFile(path.join(root, "single-build", "rollup.config.js"), config);
        expect((await inspectProject(root)).unsupported).toContain("Multi-entry builds need a separate review.");
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("warns about custom Rollup behavior without loading user config", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "torus-migrate-rollup-"));
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

    try {
      await writeFixture(root, { "rollup.config.mjs": rollupConfig });
      const before = await readFile(path.join(root, "rollup.config.mjs"));

      const result = await inspectProject(root);

      expect(result.unsupported).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Custom Rollup plugins"),
          expect.stringContaining("Custom transforms"),
          expect.stringContaining("Polyfills"),
          expect.stringContaining("Multi-entry builds"),
          expect.stringContaining("Custom asset handling"),
        ])
      );
      await expect(readFile(marker)).rejects.toMatchObject({ code: "ENOENT" });
      assert.deepEqual(await readFile(path.join(root, "rollup.config.mjs")), before);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("formats a report with found, unsupported, and next sections", () => {
    const report = formatReport({
      found: ["torus.config.js"],
      unsupported: ["Custom Rollup plugins need a separate review."],
      next: ["Run `vp migrate` at the workspace root."],
    });

    expect(report).toContain("Found");
    expect(report).toContain("Unsupported");
    expect(report).toContain("Next steps");
    expect(report).toContain("Custom Rollup plugins need a separate review.");
  });

  it("packs and runs the CLI in a temporary npm fixture", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "torus-migrate-cli-"));
    const packageCopy = path.join(root, "torus-scripts");
    const packDirectory = path.join(root, "pack");
    const plainFixture = path.join(root, "plain");
    const unsupportedFixture = path.join(root, "unsupported");
    const missingFixture = path.join(root, "missing");

    try {
      await Promise.all([
        writeFixture(plainFixture, { "package.json": JSON.stringify({ name: "plain-fixture" }) }),
        writeFixture(unsupportedFixture, {
          "package.json": JSON.stringify({ name: "unsupported-fixture" }),
          "rollup.config.js": "export default { plugins: [customPlugin()] };\n",
        }),
      ]);
      await mkdir(packDirectory, { recursive: true });
      await mkdir(packageCopy);
      await cp(path.join(packageDirectory, "src"), path.join(packageCopy, "src"), { recursive: true });
      await cp(path.join(packageDirectory, "skills"), path.join(packageCopy, "skills"), { recursive: true });
      for (const filename of ["package.json", "README.md", "vite.config.ts", "tsconfig.json"]) {
        await cp(path.join(packageDirectory, filename), path.join(packageCopy, filename));
      }
      await cp(path.resolve(packageDirectory, "../config"), path.join(root, "config"), { recursive: true });
      await symlink(path.resolve(packageDirectory, "../../node_modules"), path.join(packageCopy, "node_modules"), "dir");

      const packResult = spawnSync("npm", ["pack", "--pack-destination", packDirectory], {
        cwd: packageCopy,
        encoding: "utf8",
      });
      expect(packResult.status, `${packResult.stdout}\n${packResult.stderr}`).toBe(0);
      const tarballs = (await readdir(packDirectory)).filter((entry) => entry.endsWith(".tgz"));
      expect(tarballs).toHaveLength(1);

      const tarball = path.join(packDirectory, tarballs[0]);
      execFileSync("tar", ["-xzf", tarball, "-C", packDirectory]);
      const packagedCli = path.join(packDirectory, "package", "dist", "migrate", "cli.mjs");
      const manifest = JSON.parse(await readFile(path.join(packDirectory, "package", "package.json"), "utf8"));
      expect(manifest.bin["torus-scripts-upgrade"]).toBe("./dist/migrate/cli.mjs");

      const plainResult = spawnSync(packagedCli, [plainFixture], {
        cwd: plainFixture,
        encoding: "utf8",
      });
      expect(plainResult.status, `${plainResult.stdout}\n${plainResult.stderr}`).toBe(0);
      expect(plainResult.stdout).toContain("Next steps");

      const unsupportedResult = spawnSync(packagedCli, [unsupportedFixture], {
        cwd: unsupportedFixture,
        encoding: "utf8",
      });
      expect(unsupportedResult.status, `${unsupportedResult.stdout}\n${unsupportedResult.stderr}`).toBe(1);
      expect(unsupportedResult.stdout + unsupportedResult.stderr).toContain("Custom Rollup plugins");

      const missingResult = spawnSync(packagedCli, [missingFixture], {
        cwd: root,
        encoding: "utf8",
      });
      expect(missingResult.status, `${missingResult.stdout}\n${missingResult.stderr}`).toBe(2);

      for (const flag of ["--help", "-h"]) {
        const helpResult = spawnSync(packagedCli, [flag], { cwd: root, encoding: "utf8" });
        expect(helpResult.status, `${helpResult.stdout}\n${helpResult.stderr}`).toBe(0);
        expect(helpResult.stdout).toContain("Usage: torus-scripts-upgrade <path>");
      }

      const unknownOptionResult = spawnSync(packagedCli, ["--verbose"], { cwd: root, encoding: "utf8" });
      expect(unknownOptionResult.status).toBe(2);
      expect(unknownOptionResult.stderr).toContain("Usage: torus-scripts-upgrade <path>");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 120_000);
});
