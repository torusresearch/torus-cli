import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

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

      await expect(inspectProject(path.join(root, "missing"))).rejects.toThrow();
      await expect(inspectProject(filePath)).rejects.toThrow();
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

      const packResult = spawnSync("npm", ["pack", "--pack-destination", packDirectory], {
        cwd: packageDirectory,
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
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
