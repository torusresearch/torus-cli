import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { test } from "vitest";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(testDirectory, "..");
const fixtureDirectory = path.join(testDirectory, "fixtures", "plain-sdk");

async function copyScriptsSource(destination) {
  await mkdir(destination, { recursive: true });
  for (const name of ["package.json", "README.md", "vite.config.ts", "tsconfig.json"]) {
    await cp(path.join(packageDirectory, name), path.join(destination, name));
  }
  await cp(path.join(packageDirectory, "src"), path.join(destination, "src"), { recursive: true });
}

function packWorkspace(workspace, destination) {
  const output = execFileSync("npm", ["pack", "--json", "--pack-destination", destination], {
    cwd: workspace,
    encoding: "utf8",
  });
  const packed = JSON.parse(output);
  return Array.isArray(packed) ? packed[0] : Object.values(packed)[0];
}

test("packed scripts expose only presets and a read-only diagnostic", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "torus-scripts-boundary-"));
  try {
    const workspace = path.join(temporaryDirectory, "workspace");
    const scriptsCopy = path.join(workspace, "scripts-source");
    await mkdir(workspace);
    await symlink(path.join(path.resolve(packageDirectory, "../.."), "node_modules"), path.join(workspace, "node_modules"), "dir");
    await copyScriptsSource(scriptsCopy);
    await cp(path.resolve(packageDirectory, "../config"), path.join(workspace, "config"), { recursive: true });
    execFileSync(path.join(workspace, "node_modules/.bin/vp"), ["pack"], { cwd: scriptsCopy, stdio: "pipe" });
    const packed = packWorkspace(scriptsCopy, temporaryDirectory);
    const files = packed.files.map(({ path: filePath }) => filePath);
    const manifest = JSON.parse(
      execFileSync("tar", ["-xOf", path.join(temporaryDirectory, packed.filename), "package/package.json"], { encoding: "utf8" })
    );
    assert.ok(files.includes("dist/migrate/cli.mjs"), "pack must contain freshly built output");
    const readme = execFileSync("tar", ["-xOf", path.join(temporaryDirectory, packed.filename), "package/README.md"], { encoding: "utf8" });
    assert.match(readme, /https:\/\/github\.com\/torusresearch\/torus-cli\/blob\/main\/docs\/superpowers\/eslint-to-oxlint-rule-audit\.md/);
    assert.doesNotMatch(readme, /\]\(\.\.\/\.\.\/docs\//);

    assert.deepEqual(Object.keys(manifest.exports).sort(), ["./fmt", "./library", "./node", "./react", "./vue"]);
    assert.deepEqual(Object.keys(manifest.bin), ["torus-scripts-upgrade"]);
    assert.ok(files.every((filePath) => ["package.json", "README.md"].includes(filePath) || filePath.startsWith("dist/")));
    assert.ok(files.every((filePath) => !/\b(?:rollup|release-it|babel|torus-scripts\.js)\b/i.test(filePath)));

    const consumer = path.join(temporaryDirectory, "consumer");
    await mkdir(consumer);
    execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", path.join(temporaryDirectory, packed.filename)], {
      cwd: consumer,
      stdio: "pipe",
    });
    const imported = execFileSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `
      for (const [subpath, namedExport] of Object.entries({
        library: "libraryPreset", react: "reactPreset", vue: "vuePreset", node: "nodePreset", fmt: "formatPreset"
      })) {
        const module = await import(\`@toruslabs/torus-scripts/\${subpath}\`);
        if (typeof module[namedExport] !== "function") throw Error(\`Missing \${namedExport}\`);
      }
      console.log("presets available");
    `,
      ],
      { cwd: consumer, encoding: "utf8" }
    );
    assert.match(imported, /presets available/);
    for (const subpath of ["", "/build", "/release", "/lint", "/vue-lint", "/bin/torus-scripts.js"]) {
      const result = spawnSync("node", ["--input-type=module", "-e", `await import(${JSON.stringify(`@toruslabs/torus-scripts${subpath}`)})`], {
        cwd: consumer,
        encoding: "utf8",
      });
      assert.notEqual(result.status, 0, `legacy subpath ${subpath} must fail`);
      assert.match(result.stderr, /ERR_PACKAGE_PATH_NOT_EXPORTED/);
    }
    const binDirectory = path.join(consumer, "node_modules", ".bin");
    assert.throws(() => execFileSync(path.join(binDirectory, "torus-scripts"), [], { cwd: consumer }), { code: "ENOENT" });
    const before = await readFile(path.join(consumer, "package.json"), "utf8");
    const report = execFileSync(path.join(binDirectory, "torus-scripts-upgrade"), [consumer], { cwd: consumer, encoding: "utf8" });
    assert.match(report, /vp migrate|Vite\+/i);
    assert.equal(await readFile(path.join(consumer, "package.json"), "utf8"), before);
    const legacyConfig = path.join(consumer, "rollup.config.mjs");
    const legacySource = "export default { plugins: [customPlugin()] };\n";
    await writeFile(legacyConfig, legacySource);
    const diagnostic = spawnSync(path.join(binDirectory, "torus-scripts-upgrade"), [consumer], { cwd: consumer, encoding: "utf8" });
    assert.equal(diagnostic.status, 1);
    assert.match(diagnostic.stdout, /Rollup|plugin|unsupported/i);
    assert.equal(await readFile(legacyConfig, "utf8"), legacySource);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}, 30_000);

async function waitForFileContent(filePath, expectedContent, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await readFile(filePath, "utf8")).includes(expectedContent)) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${filePath} to contain ${expectedContent}`);
}

function trackPackBuilds(child) {
  let output = "";
  let completedBuilds = 0;
  const waiters = [];
  const collect = (chunk) => {
    output += chunk.toString();
    completedBuilds = (output.match(/✔ (?:Rebuilt|Build complete)/g) ?? []).length;
    for (let index = waiters.length - 1; index >= 0; index--) {
      const waiter = waiters[index];
      if (completedBuilds >= waiter.count) {
        waiters.splice(index, 1);
        clearTimeout(waiter.timeout);
        waiter.resolve();
      }
    }
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);

  return (count, timeoutMs = 10_000) => {
    if (completedBuilds >= count) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const waiter = {
        count,
        resolve,
        timeout: setTimeout(() => reject(new Error(`Timed out after ${completedBuilds} pack builds: ${output}`)), timeoutMs),
      };
      waiters.push(waiter);
    });
  };
}

// This is the default matrix contract: ESM-only output. CJS, explicit subpaths,
// external dependencies, version replacement, browser Object.hasOwn, CSS,
// "use client", NodeNext, and Metro remain opt-in consumer checks. This fixture
// does not claim that those optional cases pass.
test("library export packs a plain ESM SDK value and declaration", async () => {
  const torusScriptsPackage = JSON.parse(await readFile(path.join(packageDirectory, "package.json"), "utf8"));

  assert.deepEqual(torusScriptsPackage.exports?.["./library"], {
    types: "./dist/index.d.mts",
    import: "./dist/index.mjs",
  });
  assert.deepEqual(torusScriptsPackage.files, ["dist"]);
  assert.deepEqual(Object.keys(torusScriptsPackage.bin), ["torus-scripts-upgrade"]);
  for (const subpath of ["library", "react", "vue", "node", "fmt"]) {
    const { import: entry } = torusScriptsPackage.exports[`./${subpath}`];
    assert.equal(typeof entry, "string");
    const exported = await import(pathToFileURL(path.join(packageDirectory, entry)));
    assert.ok(Object.keys(exported).length > 0, `${subpath} must export a preset`);
  }

  const { libraryPreset } = await import(path.join(packageDirectory, "src", "presets", "library.ts"));
  assert.deepEqual(libraryPreset({ entry: "src/index.ts" }), {
    pack: {
      entry: "src/index.ts",
      dts: true,
      format: ["esm"],
      sourcemap: true,
    },
  });
  assert.deepEqual(
    libraryPreset({
      entry: ["src/index.ts", "src/worker.ts"],
      dts: false,
      format: ["esm", "cjs"],
      sourcemap: false,
    }),
    {
      pack: {
        entry: ["src/index.ts", "src/worker.ts"],
        dts: false,
        format: ["esm", "cjs"],
        sourcemap: false,
      },
    }
  );

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "plain-sdk-contract-"));
  const isolatedFixture = path.join(temporaryDirectory, "plain-sdk");
  const buildDirectory = path.join(isolatedFixture, "dist");
  try {
    await cp(fixtureDirectory, isolatedFixture, { recursive: true });
    await symlink(path.join(path.resolve(packageDirectory, "../.."), "node_modules"), path.join(temporaryDirectory, "node_modules"), "dir");
    execFileSync("npm", ["exec", "--", "vp", "pack"], {
      cwd: isolatedFixture,
      encoding: "utf8",
      stdio: "pipe",
    });
    execFileSync("npm", ["pack", "--json", "--pack-destination", temporaryDirectory], { cwd: isolatedFixture, encoding: "utf8", stdio: "pipe" });

    const tarballPath = path.join(temporaryDirectory, "plain-sdk-1.0.0.tgz");
    const packedJavaScript = execFileSync("tar", ["-xOf", tarballPath, "package/dist/index.mjs"], { encoding: "utf8" });
    const packedDeclarations = execFileSync("tar", ["-xOf", tarballPath, "package/dist/index.d.mts"], { encoding: "utf8" });

    assert.match(packedJavaScript, /export\s*\{[^}]*\bcreatePlainSdkId\b[^}]*\}/s, "packed SDK must export createPlainSdkId");
    assert.match(packedJavaScript, /from ["']nanoid["']/, "non-builtin dependencies must remain external");
    assert.doesNotMatch(packedJavaScript, /window|document|process\.env|torus-scripts/);
    assert.doesNotMatch(packedJavaScript, /Object\.hasOwn|\bhasOwn\s*\(/, "library output must not include browser Object.hasOwn polyfills");

    const packageFixture = await mkdtemp(path.join(os.tmpdir(), "plain-sdk-install-"));
    try {
      execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarballPath], {
        cwd: packageFixture,
        encoding: "utf8",
        stdio: "pipe",
      });
      const imported = await import(pathToFileURL(path.join(packageFixture, "node_modules", "plain-sdk", "dist", "index.mjs")));
      assert.equal(typeof imported.createPlainSdkId, "function");
      assert.match(imported.createPlainSdkId(), /^[A-Za-z0-9_-]+$/);
    } finally {
      await rm(packageFixture, { recursive: true, force: true });
    }
    assert.match(packedDeclarations, /export\s+type\s+PlainSdkOptions\b/, "packed SDK declarations must export PlainSdkOptions");

    const sourcePath = path.join(isolatedFixture, "src", "index.ts");
    const originalSource = await readFile(sourcePath, "utf8");
    const changedSource = originalSource.replace("prefix?: string;", 'prefix?: string;\n  watchProof?: "rebuilt";');
    const watchProcess = spawn("npm", ["exec", "--", "vp", "pack", "--watch"], {
      cwd: isolatedFixture,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const watchExit = new Promise((resolve) => watchProcess.once("exit", resolve));
    const waitForBuild = trackPackBuilds(watchProcess);
    try {
      await waitForBuild(1);
      const nextBuild = waitForBuild(2);
      await writeFile(sourcePath, changedSource);
      await nextBuild;
      await waitForFileContent(path.join(buildDirectory, "index.d.mts"), 'watchProof?: "rebuilt"');
    } finally {
      watchProcess.kill("SIGTERM");
      await watchExit;
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}, 90_000);
