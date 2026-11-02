import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { inspectProject } from "../src/migrate/inspect.js";
import { type Code, exitCodes, type Finding } from "../src/migrate/model.js";
import { formatReport } from "../src/migrate/report.js";
import { rollupConfigCodes } from "../src/migrate/rollup.js";
import { run, usage } from "../src/migrate/run.js";

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

function finding(code: Code, filePath: string, detail?: string): Finding {
  return { code, path: path.join(...filePath.split("/")), ...(detail === undefined ? {} : { detail }) };
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

describe("Rollup config rules", () => {
  it.each<[string, string, Code[]]>([
    ["an empty config", "export default {};", []],
    ["an empty or commented plugin array", "export default { plugins: [] }; // plugins: [notAPlugin()]", []],
    ["a glob that looks like a comment", 'export default { input: "src/*/index.ts" }; /* plugins: [x()] */', []],
    ["a load() call that is not a hook", "export default { external: (id) => cache.load(id) };", []],
    ["a non-empty plugin array", "export default { plugins: [customPlugin()] };", ["rollup-plugins"]],
    ["a plugin array in a variable", "const shared = [x()];\nexport default { plugins: shared };", ["rollup-plugins"]],
    ["a shorthand plugin property", "export default { plugins };", ["rollup-plugins"]],
    ["a typed empty plugin array", "export default { plugins: ([] as Plugin[]) };", []],
    ["an empty plugin array in a variable", "const plugins: Plugin[] = [];\nexport default { plugins };", []],
    ["a hook built by a call", "export default { load: createLoader() };", ["rollup-transforms"]],
    ["a disabled hook", "export default { transform: null };", []],
    ["a class hook method", "class Plugin { renderChunk(code) { return code; } }\nexport default {};", ["rollup-transforms"]],
    ["a class field hook", "class Plugin { transform = (code) => code; }\nexport default {};", ["rollup-transforms"]],
    ["a class field without a hook value", "class Plugin { transform; }\nexport default {};", []],
    ["a polyfill import", 'import nodePolyfills from "rollup-plugin-polyfill-node";\nexport default {};', ["polyfills"]],
    ["a core-js require", 'require("core-js");\nmodule.exports = {};', ["polyfills"]],
    ["a process alias", "export default { resolve: { alias: { process: 'polyfill' } } };", ["polyfills"]],
    ["a Buffer injection", 'export default { inject: { Buffer: ["buffer", "Buffer"] } };', ["polyfills"]],
    ["a variable that mentions polyfills", 'const skipPolyfills = true;\nexport default { output: { banner: "/* no polyfills */" } };', []],
    ["a NODE_ENV define", 'export default { define: { "process.env.NODE_ENV": \'"production"\' } };', []],
    ["asset file names", "export default { output: { assetFileNames: 'assets/[name].js' } };", ["asset-handling"]],
    [
      "an emitFile call",
      'function plugin() { return { generateBundle() { this.emitFile({ type: "asset" }); } }; }\nexport default {};',
      ["asset-handling"],
    ],
    ["a single array input", 'export default { input: ["src/index.ts"] };', []],
    ["a single object input", 'export default { input: { main: "src/index.ts" } };', []],
    ["one build in an array", 'export default [{ input: "src/index.ts", output: { file: "a.js" } }];', []],
    ["a config in a variable", 'const config = { input: "src/index.ts" };\nexport default config;', []],
    ["class members named input", 'class A { input() {} }\nclass B { input() {} }\nexport default { input: "src/index.ts" };', []],
    ["two array inputs", 'export default { input: ["src/a.ts", "src/b.ts"] };', ["multi-entry"]],
    ["two object inputs", 'export default { input: { a: "src/a.ts", b: "src/b.ts" } };', ["multi-entry"]],
    ["two builds", 'export default [{ input: "src/a.ts" }, { input: "src/b.ts" }];', ["multi-entry"]],
    ["two builds in defineConfig", 'module.exports = defineConfig([{ input: "src/a.ts" }, { input: "src/b.ts" }]);', ["multi-entry"]],
    ["inputs in a variable", 'const input = ["src/a.ts", "src/b.ts"];\nexport default { input };', ["multi-entry"]],
    ["builds made by map()", 'export default ["src/a.ts", "src/b.ts"].map((input) => ({ input }));', ["dynamic-rollup-config"]],
    ["a config function", 'export default (args) => ({ input: "src/index.ts" });', ["dynamic-rollup-config"]],
    ["inputs from a call", "export default { input: getInputs() };", ["dynamic-rollup-config"]],
    ["a spread without input", 'export default { ...base, output: { dir: "dist" } };', ["dynamic-rollup-config"]],
    ["a syntax error", "export default {", ["unparseable-rollup-config"]],
  ])("handles %s", (_name, source, expected) => {
    expect(rollupConfigCodes("rollup.config.ts", source).sort()).toEqual(expected);
  });

  it("parses TypeScript configs by file name", () => {
    const source = 'import type { RollupOptions } from "rollup";\nexport default { input: "src/index.ts" } satisfies RollupOptions;';
    expect(rollupConfigCodes("rollup.config.ts", source)).toEqual([]);
    expect(rollupConfigCodes("rollup.config.js", source)).toEqual(["unparseable-rollup-config"]);
  });
});

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

    expect(await inspectProject(root)).toEqual([
      finding("config", ".babelrc"),
      finding("config", ".browserslistrc"),
      finding("config", "babel.config.js"),
      finding("lerna", "lerna.json"),
      finding("lerna", "package.json"),
      finding("release-it", "package.json"),
      finding("config", "rollup.config.mjs"),
      finding("torus-config", "torus.config.js"),
      finding("config", "tsconfig.build.json"),
    ]);
    for (const [filePath, contents] of Object.entries(files)) {
      expect(await readFile(path.join(root, filePath), "utf8")).toBe(contents);
    }
  });

  it("rejects missing and non-directory roots", async () => {
    const root = await fixture({ "not-a-directory": "file\n" });

    await expect(inspectProject(path.join(root, "missing"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(inspectProject(path.join(root, "not-a-directory"))).rejects.toThrow(/not a directory/);
  });

  it("inspects JavaScript and TypeScript Rollup configs by relative path", async () => {
    const root = await fixture({
      "packages/one/rollup.config.js": customPlugins,
      "packages/two/rollup.config.cjs": "module.exports = { plugins: [customPlugin()] };\n",
      "packages/three/rollup.config.mts": customPlugins,
    });

    expect(await inspectProject(root)).toEqual([
      finding("config", "packages/one/rollup.config.js"),
      finding("rollup-plugins", "packages/one/rollup.config.js"),
      finding("config", "packages/three/rollup.config.mts"),
      finding("rollup-plugins", "packages/three/rollup.config.mts"),
      finding("config", "packages/two/rollup.config.cjs"),
      finding("rollup-plugins", "packages/two/rollup.config.cjs"),
    ]);
  });

  it("does not execute the Rollup config it inspects", async () => {
    const root = await fixture();
    const marker = path.join(root, "config-was-executed");
    await writeFile(
      path.join(root, "rollup.config.mjs"),
      `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "executed");\nexport default {};\n`
    );

    expect(await inspectProject(root)).toEqual([finding("config", "rollup.config.mjs")]);
    await expect(readFile(marker)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("skips node_modules but inspects packages that have their own node_modules", async () => {
    const root = await fixture({
      "packages/one/node_modules/dependency/package.json": JSON.stringify({ workspaces: ["ignored/*"] }) + "\n",
      "packages/one/package.json": JSON.stringify({ scripts: { release: "release-it" } }) + "\n",
    });

    expect(await inspectProject(root)).toEqual([finding("release-it", "packages/one/package.json")]);
  });

  it("follows symlinked package directories inside the root", async () => {
    const root = await fixture({ "node_modules/.store/linked/rollup.config.mjs": customPlugins });
    await mkdir(path.join(root, "packages"));
    await symlink(path.join(root, "node_modules", ".store", "linked"), path.join(root, "packages", "linked"), "dir");
    await symlink(root, path.join(root, "packages", "loop"), "dir");

    expect(await inspectProject(root)).toEqual([
      finding("config", "packages/linked/rollup.config.mjs"),
      finding("rollup-plugins", "packages/linked/rollup.config.mjs"),
    ]);
  });

  it("reports only relevant symlinks that leave the root", async () => {
    const root = await fixture();
    const outside = await fixture({ "rollup.config.mjs": customPlugins, "README.md": "# outside\n" });
    await mkdir(path.join(root, "packages"));
    await symlink(outside, path.join(root, "packages", "linked"), "dir");
    await symlink(outside, path.join(root, "node_modules"), "dir");
    await symlink(path.join(outside, "rollup.config.mjs"), path.join(root, "rollup.config.mjs"), "file");
    await symlink(path.join(outside, "README.md"), path.join(root, "README.md"), "file");

    expect(await inspectProject(root)).toEqual([finding("escaped-symlink", "packages/linked"), finding("escaped-symlink", "rollup.config.mjs")]);
  });

  it("reports legacy torus-scripts commands and versions", async () => {
    const root = await fixture({
      "package.json": JSON.stringify({ workspaces: ["packages/*"], devDependencies: { "@toruslabs/torus-scripts": "^8.1.0" } }) + "\n",
      "packages/one/package.json": JSON.stringify({ scripts: { build: "./node_modules/.bin/torus-scripts build" } }) + "\n",
      "packages/two/package.json":
        JSON.stringify({ dependencies: { "@toruslabs/torus-scripts": "^6.0.0" }, devDependencies: { "@toruslabs/torus-scripts": "^8.0.0" } }) + "\n",
      "packages/three/package.json":
        JSON.stringify({
          scripts: { check: "torus-scripts-upgrade .", echo: "echo release-it-is-not-used", setup: "npm install @toruslabs/torus-scripts" },
        }) + "\n",
      "packages/four/package.json": JSON.stringify({ devDependencies: { "@toruslabs/torus-scripts": "latest" } }) + "\n",
      "packages/five/package.json": JSON.stringify({ devDependencies: { "@toruslabs/torus-scripts": "npm:@toruslabs/torus-scripts@^7.0.0" } }) + "\n",
      "packages/six/package.json": JSON.stringify({ devDependencies: { "@toruslabs/torus-scripts": "workspace:*" } }) + "\n",
    });

    expect(await inspectProject(root)).toEqual([
      finding("legacy-dependency", "packages/five/package.json", "npm:@toruslabs/torus-scripts@^7.0.0"),
      finding("unknown-dependency-version", "packages/four/package.json", "latest"),
      finding("legacy-commands", "packages/one/package.json"),
      finding("local-dependency", "packages/six/package.json", "workspace:*"),
      finding("legacy-dependency", "packages/two/package.json", "^6.0.0"),
    ]);
  });

  it("reports nested workspaces and malformed package.json files", async () => {
    const root = await fixture({
      "packages/broken/package.json": "{ not json\n",
      "packages/null/package.json": "null\n",
      "packages/nested/package.json": JSON.stringify({ workspaces: ["children/*"] }) + "\n",
      "packages/odd/package.json": JSON.stringify({ dependencies: "lerna", scripts: ["lerna run build"] }) + "\n",
    });

    expect(await inspectProject(root)).toEqual([
      finding("unreadable-manifest", "packages/broken/package.json"),
      finding("nested-workspaces", "packages/nested/package.json"),
      finding("unreadable-manifest", "packages/null/package.json"),
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

    expect(await inspectProject(root)).toEqual([]);
  });

  it("reports a blocker when the directory cap stops the walk", async () => {
    const root = await fixture({ "a/package.json": "{}\n", "b/package.json": "{}\n", "c/package.json": "{}\n" });

    expect(await inspectProject(root, { maxDirectories: 2 })).toEqual([{ code: "truncated", path: ".", detail: "2 directories" }]);
    expect(await inspectProject(root, { maxDirectories: 4 })).toEqual([]);
  });
});

describe("migration report", () => {
  it("separates found items from blockers and shows details", () => {
    const report = formatReport([
      finding("config", "babel.config.js"),
      finding("legacy-dependency", "package.json", "^7.0.0"),
      { code: "truncated", path: ".", detail: "5 directories" },
    ]);

    expect(report).toContain("Found\n- babel.config.js: Legacy build configuration.\n\nUnsupported\n");
    expect(report).toContain("- package.json: @toruslabs/torus-scripts before v8 needs manual replacement. (^7.0.0)\n");
    expect(report).toContain("- .: Inspection stopped at the directory limit. Review the remaining directories by hand. (5 directories)\n");
    expect(report).toContain("Next steps\n- Run `vp migrate` at the workspace root.");
    expect(report).toContain("Skipped directories: node_modules,");
  });

  it("states when nothing was found", () => {
    const report = formatReport([]);

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
    const plain = await fixture({ "babel.config.js": "module.exports = {};\n" });
    const blocked = await fixture({ "rollup.config.js": customPlugins });

    const plainResult = await runCli([plain]);
    expect(plainResult.code).toBe(exitCodes.clean);
    expect(plainResult.stdout).toContain("babel.config.js: Legacy build configuration.");

    const blockedResult = await runCli([blocked]);
    expect(blockedResult.code).toBe(exitCodes.blocked);
    expect(blockedResult.stdout).toContain("rollup.config.js: Custom Rollup plugins need a separate review.");
  });
});
