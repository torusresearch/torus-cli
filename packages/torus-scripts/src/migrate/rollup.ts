import { readFile } from "node:fs/promises";

import { parseSync } from "vite-plus";

import type { Blocker, PathBlockerCode } from "./model.js";

type AstNode = Record<string, unknown> & { type: string };

function isNode(value: unknown): value is AstNode {
  return typeof value === "object" && value !== null && "type" in value && typeof value.type === "string";
}

function* walkAst(value: unknown): Generator<AstNode> {
  if (Array.isArray(value)) {
    for (const item of value) yield* walkAst(item);
    return;
  }
  if (!isNode(value)) return;
  yield value;
  for (const child of Object.values(value)) {
    if (typeof child === "object") yield* walkAst(child);
  }
}

function propertyName(node: AstNode): string | undefined {
  if (node.type !== "Property" && node.type !== "MethodDefinition" && node.type !== "PropertyDefinition") return undefined;
  const key = node.key;
  if (!isNode(key)) return undefined;
  if (key.type === "Identifier" && node.computed !== true && typeof key.name === "string") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return undefined;
}

function listLength(value: unknown): number | undefined {
  if (!isNode(value)) return undefined;
  if (value.type === "ArrayExpression" && Array.isArray(value.elements)) return value.elements.length;
  if (value.type === "ObjectExpression" && Array.isArray(value.properties)) return value.properties.length;
  return undefined;
}

const transformHooks = new Set(["transform", "transformCode", "renderChunk", "load"]);
const hookValueTypes = new Set(["FunctionExpression", "ArrowFunctionExpression", "Identifier"]);
const polyfillPattern = /polyfill|core-js/i;

function isPolyfill(node: AstNode): boolean {
  if (node.type === "Literal" && typeof node.value === "string") return polyfillPattern.test(node.value);
  if (node.type === "Identifier" && typeof node.name === "string") return polyfillPattern.test(node.name);
  const name = propertyName(node);
  return (name === "process" || name === "Buffer") && isNode(node.value) && node.value.type === "Literal" && typeof node.value.value === "string";
}

function isEmitFileCall(node: AstNode): boolean {
  if (node.type !== "CallExpression" || !isNode(node.callee)) return false;
  const callee = node.callee.type === "MemberExpression" && isNode(node.callee.property) ? node.callee.property : node.callee;
  return callee.type === "Identifier" && callee.name === "emitFile";
}

const rollupChecks: { code: PathBlockerCode; matches: (node: AstNode) => boolean }[] = [
  { code: "rollup-plugins", matches: (node) => propertyName(node) === "plugins" && listLength(node.value) !== 0 },
  {
    code: "rollup-transforms",
    matches: (node) => transformHooks.has(propertyName(node) ?? "") && isNode(node.value) && hookValueTypes.has(node.value.type),
  },
  { code: "polyfills", matches: isPolyfill },
  { code: "asset-handling", matches: (node) => propertyName(node) === "assetFileNames" || isEmitFileCall(node) },
];

export async function rollupConfigBlockers(filePath: string, relativePath: string): Promise<Blocker[]> {
  const { program, errors } = parseSync(filePath, await readFile(filePath, "utf8"));
  if (errors.length > 0) return [{ code: "unparseable-rollup-config", path: relativePath }];

  const nodes = [...walkAst(program)];
  const codes = rollupChecks.filter(({ matches }) => nodes.some(matches)).map(({ code }) => code);
  const entryCount = nodes.filter((node) => propertyName(node) === "input").reduce((count, node) => count + (listLength(node.value) ?? 1), 0);
  if (entryCount > 1) codes.push("multi-entry");
  return codes.map((code) => ({ code, path: relativePath }));
}
