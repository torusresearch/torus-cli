import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { test } from "vitest";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(testDirectory, "..");
const fixtureDirectory = path.join(testDirectory, "fixtures", "plain-sdk");

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

test("library export packs a plain ESM SDK value and declaration", async () => {
  const torusScriptsPackage = JSON.parse(await readFile(path.join(packageDirectory, "package.json"), "utf8"));

  assert.deepEqual(torusScriptsPackage.exports?.["./library"], {
    types: "./dist/index.d.mts",
    import: "./dist/index.mjs",
  });
  assert.deepEqual(torusScriptsPackage.files, ["dist"]);
  assert.equal(torusScriptsPackage.bin, undefined);
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
}, 30_000);
