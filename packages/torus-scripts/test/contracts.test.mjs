import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(testDirectory, "..");
const fixtureDirectory = path.join(testDirectory, "fixtures", "plain-sdk");

// This is the default matrix contract: ESM-only output. CJS, explicit subpaths,
// external dependencies, version replacement, browser Object.hasOwn, CSS,
// "use client", NodeNext, and Metro remain opt-in consumer checks. This fixture
// does not claim that those optional cases pass.
test("library export packs a plain ESM SDK value and declaration", async () => {
  const torusScriptsPackage = JSON.parse(
    await readFile(path.join(packageDirectory, "package.json"), "utf8"),
  );

  assert.ok(
    torusScriptsPackage.exports?.["./library"],
    "@toruslabs/torus-scripts must export ./library",
  );

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "plain-sdk-contract-"));
  const buildDirectory = path.join(fixtureDirectory, "dist");
  try {
    execFileSync("npm", ["exec", "--", "vp", "pack"], {
      cwd: fixtureDirectory,
      encoding: "utf8",
      stdio: "pipe",
    });
    execFileSync(
      "npm",
      ["pack", "--json", "--pack-destination", temporaryDirectory],
      { cwd: fixtureDirectory, encoding: "utf8", stdio: "pipe" },
    );

    const tarballPath = path.join(temporaryDirectory, "plain-sdk-1.0.0.tgz");
    const packedJavaScript = execFileSync(
      "tar",
      ["-xOf", tarballPath, "package/dist/index.js"],
      { encoding: "utf8" },
    );
    const packedDeclarations = execFileSync(
      "tar",
      ["-xOf", tarballPath, "package/dist/index.d.ts"],
      { encoding: "utf8" },
    );

    assert.match(
      packedJavaScript,
      /export\s*\{[^}]*\bcreatePlainSdkId\b[^}]*\}/s,
      "packed SDK must export createPlainSdkId",
    );
    assert.match(
      packedDeclarations,
      /export\s+type\s+PlainSdkOptions\b/,
      "packed SDK declarations must export PlainSdkOptions",
    );
  } finally {
    await Promise.all([
      rm(temporaryDirectory, { recursive: true, force: true }),
      rm(buildDirectory, { recursive: true, force: true }),
    ]);
  }
});
