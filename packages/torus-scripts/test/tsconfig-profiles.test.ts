import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const configPackageDirectory = path.resolve(testDirectory, "../../config");
const fixtureDirectory = path.resolve(testDirectory, "fixtures/plain-sdk");
const tsc = path.resolve(testDirectory, "../../../node_modules/.bin/tsc");

function readProfile(profileName: string): { compilerOptions: Record<string, unknown> } {
  return JSON.parse(execFileSync(tsc, ["--project", path.join(configPackageDirectory, profileName), "--showConfig"], { encoding: "utf8" }));
}

describe("TypeScript profiles", () => {
  it("uses bundler resolution for the library profile", () => {
    const profile = readProfile("tsconfig.library.json");

    expect(profile.compilerOptions.moduleResolution).toBe("bundler");
  });

  it("omits DOM libraries from the shared library profile and its non-browser fixture", () => {
    expect(readProfile("tsconfig.library.json").compilerOptions.lib).toEqual(["es2024"]);
    const fixture = JSON.parse(execFileSync(tsc, ["--project", path.join(fixtureDirectory, "tsconfig.json"), "--showConfig"], { encoding: "utf8" }));
    expect(fixture.compilerOptions.lib).toEqual(["es2024"]);
  });

  it("keeps DOM libraries explicit in browser consumer fixtures", () => {
    for (const name of ["react", "vue"]) {
      const config = JSON.parse(readFileSync(path.join(testDirectory, "fixtures/consumer-matrix", name, "tsconfig.json"), "utf8"));
      expect(config.compilerOptions.lib).toEqual(["ES2024", "DOM", "DOM.Iterable"]);
    }
  });

  it("uses NodeNext resolution without DOM libraries for the Node profile", () => {
    const profile = readProfile("tsconfig.node.json");

    expect(profile.compilerOptions.moduleResolution).toBe("nodenext");
    expect(profile.compilerOptions.module).toBe("nodenext");
    expect(profile.compilerOptions.lib).toEqual(["es2024"]);
  });

  it("keeps strict null checks enabled in both profiles", () => {
    expect(readProfile("tsconfig.library.json").compilerOptions.strictNullChecks).toBe(true);
    expect(readProfile("tsconfig.node.json").compilerOptions.strictNullChecks).toBe(true);
  });

  it("resolves both profiles through Node and the library profile from the fixture", () => {
    const fixtureRequire = createRequire(pathToFileURL(path.join(fixtureDirectory, "resolve.cjs")));

    for (const profileName of ["tsconfig.library.json", "tsconfig.node.json"]) {
      expect(fixtureRequire.resolve(`@toruslabs/config/${profileName}`)).toBe(path.join(configPackageDirectory, profileName));
    }
    const resolvedConfig = JSON.parse(
      execFileSync(tsc, ["--project", path.join(fixtureDirectory, "tsconfig.json"), "--showConfig"], { encoding: "utf8" })
    );
    expect(resolvedConfig.compilerOptions.moduleResolution).toBe("bundler");
    expect(resolvedConfig.compilerOptions.strictNullChecks).toBe(true);
  });

  it("includes all exported profiles in the package archive, not source-only files", () => {
    const temporary = mkdtempSync(path.join(os.tmpdir(), "torus-config-archive-"));
    try {
      const result = JSON.parse(
        execFileSync("npm", ["pack", "--json", "--pack-destination", temporary], {
          cwd: configPackageDirectory,
          encoding: "utf8",
        })
      );
      const archive = (Array.isArray(result) ? result[0] : Object.values(result)[0]) as { files: { path: string }[] };
      const files = archive.files.map((file) => file.path);
      for (const name of ["tsconfig.base.json", "tsconfig.library.json", "tsconfig.node.json"]) {
        expect(files).toContain(name);
      }
      expect(files).not.toContain("tsconfig.json");
      expect(files).not.toContain("tsconfig.default.json");
      expect(files).not.toContain("tsconfig.build.json");
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  it("exports only supported profiles and excludes legacy configuration", () => {
    const fixtureRequire = createRequire(pathToFileURL(path.join(fixtureDirectory, "resolve.cjs")));
    const configPackage = JSON.parse(readFileSync(path.join(configPackageDirectory, "package.json"), "utf8"));
    const supported = ["tsconfig.base.json", "tsconfig.library.json", "tsconfig.node.json"];
    expect(configPackage.exports).toEqual(Object.fromEntries(supported.map((subpath) => [`./${subpath}`, `./${subpath}`])));

    for (const subpath of supported) {
      expect(fixtureRequire.resolve(`@toruslabs/config/${subpath}`)).toBe(path.join(configPackageDirectory, subpath));
    }
    for (const subpath of ["tsconfig.default.json", "tsconfig.build.json", "torus.config.js", "babel.config.js", "babel-test.config.js"]) {
      expect(() => fixtureRequire.resolve(`@toruslabs/config/${subpath}`)).toThrowError(
        expect.objectContaining({ code: "ERR_PACKAGE_PATH_NOT_EXPORTED" })
      );
    }
  });
});
