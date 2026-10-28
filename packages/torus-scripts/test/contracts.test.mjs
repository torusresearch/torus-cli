import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { test } from "vitest";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(testDirectory, "..");
const fixtureDirectory = path.join(testDirectory, "fixtures", "consumer-matrix", "plain");

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

  assert.deepEqual(Object.keys(torusScriptsPackage.exports).sort(), ["./fmt", "./library", "./node", "./react"]);
  assert.deepEqual(torusScriptsPackage.files, ["dist"]);
  assert.equal(torusScriptsPackage.bin, undefined);
  for (const [subpath, exportName] of Object.entries({
    library: "libraryPreset",
    react: "reactPreset",
    node: "nodePreset",
    fmt: "formatPreset",
  })) {
    assert.deepEqual(torusScriptsPackage.exports[`./${subpath}`], {
      types: `./dist/${subpath}.d.mts`,
      import: `./dist/${subpath}.mjs`,
    });
    const exported = await import(pathToFileURL(path.join(packageDirectory, "dist", `${subpath}.mjs`)));
    assert.deepEqual(Object.keys(exported).sort(), [exportName], `${subpath} must export only ${exportName}`);
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

test("npm pack builds dist from a source tree that has no build output", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "torus-scripts-prepack-"));
  const packageCopy = path.join(temporaryDirectory, "torus-scripts");
  try {
    await mkdir(packageCopy);
    await cp(path.join(packageDirectory, "src"), path.join(packageCopy, "src"), { recursive: true });
    for (const filename of ["package.json", "README.md", "vite.config.ts", "tsconfig.json"]) {
      await cp(path.join(packageDirectory, filename), path.join(packageCopy, filename));
    }
    await cp(path.resolve(packageDirectory, "../config"), path.join(temporaryDirectory, "config"), { recursive: true });
    await symlink(path.resolve(packageDirectory, "../../node_modules"), path.join(packageCopy, "node_modules"), "dir");
    await assert.rejects(readFile(path.join(packageCopy, "dist", "library.mjs")));

    const packOutput = execFileSync("npm", ["pack", "--json", "--pack-destination", temporaryDirectory], {
      cwd: packageCopy,
      encoding: "utf8",
      stdio: "pipe",
    });
    const jsonStart = Math.max(packOutput.lastIndexOf("\n["), packOutput.lastIndexOf("\n{"));
    const packed = JSON.parse(jsonStart === -1 ? packOutput : packOutput.slice(jsonStart + 1));
    const result = Array.isArray(packed) ? packed[0] : Object.values(packed)[0];
    const packedFiles = execFileSync("tar", ["-tzf", path.join(temporaryDirectory, result.filename)], { encoding: "utf8" });
    for (const name of ["library", "react", "node", "fmt"]) {
      assert.match(packedFiles, new RegExp(`package/dist/${name}\\.mjs$`, "m"));
      assert.match(packedFiles, new RegExp(`package/dist/${name}\\.d\\.mts$`, "m"));
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}, 60_000);
