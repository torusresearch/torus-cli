import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const configPackageDirectory = path.resolve(testDirectory, "../../config");
const fixtureDirectory = path.resolve(testDirectory, "fixtures/plain-sdk");

function readProfile(profileName: string) {
  const configPath = path.join(configPackageDirectory, profileName);
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

  assert.equal(configFile.error, undefined);
  return ts.parseJsonConfigFileContent(configFile.config, ts.sys, configPackageDirectory, undefined, configPath);
}

describe("TypeScript profiles", () => {
  it("uses bundler resolution for the library profile", () => {
    const profile = readProfile("tsconfig.library.json");

    expect(profile.options.moduleResolution).toBe(ts.ModuleResolutionKind.Bundler);
  });

  it("uses NodeNext resolution without DOM libraries for the Node profile", () => {
    const profile = readProfile("tsconfig.node.json");

    expect(profile.options.moduleResolution).toBe(ts.ModuleResolutionKind.NodeNext);
    expect(profile.options.module).toBe(ts.ModuleKind.NodeNext);
    expect(profile.options.lib).toEqual(["lib.es2024.d.ts"]);
  });

  it("keeps strict null checks enabled in both profiles", () => {
    expect(readProfile("tsconfig.library.json").options.strictNullChecks).toBe(true);
    expect(readProfile("tsconfig.node.json").options.strictNullChecks).toBe(true);
  });

  it("resolves both profiles through Node and TypeScript from the fixture", () => {
    const fixtureRequire = createRequire(pathToFileURL(path.join(fixtureDirectory, "resolve.cjs")));

    for (const profileName of ["tsconfig.library.json", "tsconfig.node.json"]) {
      const profilePath = `@toruslabs/config/${profileName}`;
      const nodeResolvedPath = fixtureRequire.resolve(profilePath);
      const tsResolvedPath = ts.resolveModuleName(
        profilePath,
        path.join(fixtureDirectory, "tsconfig.json"),
        { moduleResolution: ts.ModuleResolutionKind.NodeNext, resolveJsonModule: true },
        ts.sys
      ).resolvedModule?.resolvedFileName;

      expect(nodeResolvedPath).toBe(path.join(configPackageDirectory, profileName));
      expect(tsResolvedPath).toBe(nodeResolvedPath);
    }
  });

  it("keeps profile and legacy package subpaths exported and resolvable", () => {
    const fixtureRequire = createRequire(pathToFileURL(path.join(fixtureDirectory, "resolve.cjs")));
    const configPackage = ts.readConfigFile(path.join(configPackageDirectory, "package.json"), ts.sys.readFile).config;
    const subpaths = [
      "tsconfig.library.json",
      "tsconfig.node.json",
      "tsconfig.default.json",
      "tsconfig.build.json",
      "torus.config.js",
      "babel.config.js",
      "babel-test.config.js",
    ];

    for (const subpath of subpaths) {
      const packageSubpath = `./${subpath}`;
      expect(configPackage.exports).toHaveProperty(packageSubpath, packageSubpath);
      expect(fixtureRequire.resolve(`@toruslabs/config/${subpath}`)).toBe(path.join(configPackageDirectory, subpath));
    }
  });
});
