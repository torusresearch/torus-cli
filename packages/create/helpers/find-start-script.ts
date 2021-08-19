import path from "path";
import fs from "fs";

export function findStartScript(dir: string): string | undefined {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(dir, "package.json")).toString()
  );
  const scripts = Object.keys(packageJson.scripts ?? {});
  return (
    scripts.find((it) => it === "start" || it === "dev" || it === "serve") ??
    scripts[0]
  );
}
