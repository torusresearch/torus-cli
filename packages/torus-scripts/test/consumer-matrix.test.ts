import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "vitest";

import { nodePreset } from "../src/presets/node.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fixtureRoot = path.join(root, "packages/torus-scripts/test/fixtures/consumer-matrix");
const scriptsPackage = "@toruslabs/torus-scripts";

function run(command: string, args: string[], cwd: string): string {
  try {
    return execFileSync(command, args, { cwd, encoding: "utf8", stdio: "pipe", timeout: 120_000 });
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string };
    throw new Error(`${command} ${args.join(" ")} failed in ${cwd}:\n${failure.stdout ?? ""}\n${failure.stderr ?? ""}`, { cause: error });
  }
}

async function pack(cwd: string, destination: string): Promise<string> {
  const packed = JSON.parse(run("npm", ["pack", "--json", "--pack-destination", destination], cwd));
  const result = Array.isArray(packed) ? packed[0] : (Object.values(packed)[0] as { filename: string });
  return path.join(destination, result.filename);
}

async function install(consumer: string, tarballs: string[], dependencies: string[] = []): Promise<void> {
  await mkdir(consumer, { recursive: true });
  await writeFile(path.join(consumer, "package.json"), JSON.stringify({ name: "matrix-consumer", private: true, type: "module" }));
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", ...tarballs, ...dependencies], consumer);
}

async function buildFixture(name: string, workspace: string, builder: string): Promise<string> {
  await cp(path.join(fixtureRoot, name), workspace, { recursive: true });
  const config = JSON.parse(await readFile(path.join(workspace, "tsconfig.json"), "utf8"));
  assert.deepEqual(config.include, ["src/**/*"]);
  run(path.join(builder, "node_modules/.bin/vp"), ["pack"], workspace);
  return pack(workspace, path.dirname(workspace));
}

async function buildScriptsTarball(temporary: string): Promise<{ workspace: string; tarball: string }> {
  const workspace = path.join(temporary, "builder");
  const configTarball = await pack(path.join(root, "packages/config"), temporary);
  await install(workspace, [configTarball], ["vite-plus@1.4.0", "typescript@7.0.2", "@types/node@24.13.6", "nanoid@5.1.0"]);
  await cp(path.join(root, "packages/config"), path.join(workspace, "config"), { recursive: true });
  const scriptsSource = path.join(workspace, "scripts-source");
  await mkdir(scriptsSource);
  const packageSource = path.join(root, "packages/torus-scripts");
  for (const filename of ["package.json", "README.md", "vite.config.ts", "tsconfig.json"]) {
    await cp(path.join(packageSource, filename), path.join(scriptsSource, filename));
  }
  await cp(path.join(packageSource, "src"), path.join(scriptsSource, "src"), { recursive: true });
  run(path.join(workspace, "node_modules/.bin/vp"), ["pack"], scriptsSource);
  const tarball = await pack(scriptsSource, temporary);
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], workspace);
  const installed = JSON.parse(await readFile(path.join(workspace, "node_modules", scriptsPackage, "package.json"), "utf8"));
  assert.equal(installed.peerDependencies["vite-plus"], "^1.0.0");
  return { workspace, tarball };
}

async function installBuilt(tarball: string, rootDirectory: string, name: string, dependencies: string[] = []): Promise<string> {
  const consumer = path.join(rootDirectory, `${name}-installed`);
  await install(consumer, [tarball], dependencies);
  return consumer;
}

type RecipeContext = {
  dist: string;
  installed: string;
  fixture: string;
  workspace: string;
  files: string[];
};

const recipes: Array<{
  name: string;
  dependencies: string[];
  check: (context: RecipeContext) => Promise<void>;
}> = [
  {
    name: "cjs",
    dependencies: ["nanoid@5.1.0"],
    check: async ({ files, installed, workspace }) => {
      const manifest = JSON.parse(await readFile(path.join(installed, "node_modules", "matrix-cjs", "package.json"), "utf8"));
      assert.ok(files.includes("index.cjs"), "CJS requires an explicit format option");
      assert.ok(files.includes("index.d.cts"));
      assert.equal(manifest.exports["."].require.types, "./dist/index.d.cts");
      await writeFile(path.join(installed, "types-check.cts"), "import { sdkId } from 'matrix-cjs';\nconst id: string = sdkId();\n");
      const resolution = run(
        path.join(workspace, "node_modules/.bin/tsc"),
        ["--noEmit", "--strict", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--skipLibCheck", "--traceResolution", "types-check.cts"],
        installed
      );
      assert.match(resolution, /matrix-cjs\/dist\/index\.d\.cts' with Package ID/);
      run("node", ["-e", "if (!require('matrix-cjs').sdkId().startsWith('sdk-')) process.exit(1)"], installed);
      run("node", ["--input-type=module", "-e", "import { sdkId } from 'matrix-cjs'; if (!sdkId().startsWith('sdk-')) process.exit(1)"], installed);
    },
  },
  {
    name: "react",
    dependencies: [],
    check: async ({ dist, fixture }) => {
      assert.match(await readFile(path.join(dist, "index.mjs"), "utf8"), /^['"]use client['"];?/);
      assert.match(await readFile(path.join(fixture, "vite.config.ts"), "utf8"), /banner/);
      assert.doesNotMatch(await readFile(path.join(fixture, "src/index.tsx"), "utf8"), /use client/);
    },
  },
  {
    name: "vue",
    dependencies: [],
    check: async ({ files, dist, installed }) => {
      const manifest = JSON.parse(await readFile(path.join(installed, "node_modules", "matrix-vue", "package.json"), "utf8"));
      assert.ok(files.includes("style.css"), "Vue CSS must be shipped as an external asset");
      assert.match(await readFile(path.join(dist, "style.css"), "utf8"), /\.vue-library\s*\{[\s\S]*color:\s*(?:#639|rebeccapurple)/);
      assert.equal(manifest.exports["./style.css"], "./dist/style.css");
      assert.doesNotMatch(await readFile(path.join(dist, "index.mjs"), "utf8"), /document\.createElement|insertAdjacentHTML/);
    },
  },
  {
    name: "node",
    dependencies: ["nanoid@5.1.0"],
    check: async ({ dist, installed }) => {
      const js = await readFile(path.join(dist, "index.mjs"), "utf8");
      assert.match(js, /node:crypto/);
      assert.match(js, /node:fs/);
      assert.match(js, /from ['"]nanoid['"]/);
      run(
        "node",
        ["--input-type=module", "-e", "import { hashMarker } from 'matrix-node'; if (hashMarker('a').length !== 64) process.exit(1)"],
        installed
      );
    },
  },
];

test("an installed scripts tarball builds CJS, React, Vue, and Node consumers", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "torus-consumer-matrix-"));
  try {
    const { workspace } = await buildScriptsTarball(temporary);
    const scriptsManifest = JSON.parse(await readFile(path.join(workspace, "node_modules", scriptsPackage, "package.json"), "utf8"));
    assert.deepEqual(Object.keys(scriptsManifest.exports).sort(), ["./fmt", "./library", "./node", "./react"]);
    for (const [subpath, exportedName] of Object.entries({
      library: "libraryPreset",
      react: "reactPreset",
      node: "nodePreset",
      fmt: "formatPreset",
    })) {
      const exported = run(
        "node",
        [
          "--input-type=module",
          "-e",
          `import * as entry from '${scriptsPackage}/${subpath}'; if (typeof entry.${exportedName} !== 'function' || Object.keys(entry).some((key) => key !== '${exportedName}')) process.exit(1);`,
        ],
        workspace
      );
      assert.equal(exported, "");
    }
    await writeFile(
      path.join(workspace, "types-check.mts"),
      `import { libraryPreset } from '${scriptsPackage}/library';\nlibraryPreset({ entry: 'src/index.ts' });\n`
    );
    run(
      path.join(workspace, "node_modules/.bin/tsc"),
      ["--noEmit", "--strict", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--skipLibCheck", "types-check.mts"],
      workspace
    );

    for (const recipe of recipes) {
      const fixture = path.join(workspace, recipe.name);
      const tarball = await buildFixture(recipe.name, fixture, workspace);
      const installed = await installBuilt(tarball, temporary, recipe.name, recipe.dependencies);
      const dist = path.join(installed, "node_modules", `matrix-${recipe.name}`, "dist");
      const files = await readdir(dist);
      assert.ok(files.includes("index.mjs"), `${recipe.name} must ship ESM`);
      const exported = run(
        "node",
        ["--input-type=module", "-e", `const entry = await import('matrix-${recipe.name}'); if (!Object.keys(entry).length) process.exit(1)`],
        installed
      );
      assert.equal(exported, "");
      await recipe.check({ dist, installed, fixture, workspace, files });
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}, 180_000);

test("decorator metadata needs the TypeScript compiler, not the Node pack preset", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "torus-decorator-matrix-"));
  try {
    const source = path.join(fixtureRoot, "backend", "index.ts");
    const output = path.join(temporary, "compiled");
    run(
      path.join(root, "node_modules/.bin/tsc"),
      [
        "--experimentalDecorators",
        "--emitDecoratorMetadata",
        "--skipLibCheck",
        "--target",
        "ES2022",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--outDir",
        output,
        source,
      ],
      root
    );
    const compiled = await readFile(path.join(output, "index.js"), "utf8");
    assert.match(compiled, /__metadata\("design:paramtypes"/);
    assert.match(compiled, /BackendDependency/);
    const pack = nodePreset({ entry: "index.ts" }).pack;
    assert.deepEqual(Object.keys(pack).sort(), ["deps", "dts", "entry", "platform"]);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}, 30_000);
