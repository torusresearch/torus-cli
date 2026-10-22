import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeConfig } from "vite";
import { describe, expect, it } from "vitest";
import { nodePreset } from "../src/presets/node.js";
import { reactPreset } from "../src/presets/react.js";
import { vuePreset } from "../src/presets/vue.js";

describe("optional framework presets", () => {
  it("sets the automatic JSX runtime without installing a React plugin", () => {
    expect(reactPreset()).toEqual({ esbuild: { jsx: "automatic" } });
    expect(reactPreset()).not.toHaveProperty("plugins");
  });

  it("leaves Vue single-file component transforms to a consumer plugin", () => {
    expect(vuePreset()).toEqual({});
    expect(vuePreset()).not.toHaveProperty("plugins");
  });

  it("keeps a consumer-supplied plugin when a preset is merged", () => {
    const consumerPlugin = { name: "consumer-plugin" };
    const config = mergeConfig({ plugins: [consumerPlugin] }, reactPreset());

    expect(config.plugins).toContain(consumerPlugin);
  });
});

describe("Node preset", () => {
  it("uses Node packing and keeps dependencies external", () => {
    expect(nodePreset({ entry: ["src/index.ts", "src/worker.ts"] })).toEqual({
      pack: {
        entry: ["src/index.ts", "src/worker.ts"],
        platform: "node",
        deps: { neverBundle: true },
      },
    });
  });

  it("does not add browser, CSS, or environment replacement settings", () => {
    const config = nodePreset({ entry: "src/index.ts" });
    const serializedConfig = JSON.stringify(config);

    expect(serializedConfig).not.toMatch(/dom|browser|css|process\.env|define/i);
    expect(config.pack).not.toHaveProperty("define");
    expect(config.pack).not.toHaveProperty("plugins");
  });

  it("uses no Vite browser transforms when a consumer merges its plugins", () => {
    const consumerPlugin = { name: "consumer-plugin" };
    const config = mergeConfig(
      { plugins: [consumerPlugin] },
      nodePreset({ entry: "src/index.ts" }),
    );

    expect(config.plugins).toContain(consumerPlugin);
    expect(config.plugins).not.toContainEqual(expect.objectContaining({ name: "vite:css" }));
    expect(config.plugins).not.toContainEqual(expect.objectContaining({ name: "vite:define" }));
  });
});

describe("public preset exports", () => {
  it("exports framework and Node profile subpaths", async () => {
    const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const packageJson = JSON.parse(
      await readFile(path.join(packageDirectory, "package.json"), "utf8"),
    );

    for (const profile of ["react", "vue", "node"]) {
      expect(packageJson.exports).toHaveProperty(`./${profile}`);
    }
    expect(packageJson.exports).toHaveProperty("./library");

    const configuredDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
    };
    expect(configuredDependencies).not.toHaveProperty("@vitejs/plugin-react");
    expect(configuredDependencies).not.toHaveProperty("@vitejs/plugin-vue");
  });
});
