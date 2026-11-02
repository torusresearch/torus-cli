import { readFile } from "node:fs/promises";

import { type ESTree, parseSync, Visitor } from "vite-plus";

import type { Code, Finding } from "./model.js";

type RollupCode = Extract<
  Code,
  "rollup-plugins" | "rollup-transforms" | "polyfills" | "multi-entry" | "asset-handling" | "dynamic-rollup-config" | "unparseable-rollup-config"
>;

const hookNames = new Set(["transform", "transformCode", "renderChunk", "load"]);
const replacementOptions = new Set(["alias", "inject", "define"]);
const runtimeGlobals = new Set(["process", "Buffer", "global"]);
const polyfillPattern = /polyfill|core-js/i;

function keyName(node: { key: ESTree.PropertyKey | ESTree.PrivateIdentifier; computed: boolean }): string | undefined {
  const { key } = node;
  if (key.type === "Identifier" && !node.computed) return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return undefined;
}

function isDisabled(value: ESTree.Node): boolean {
  return (value.type === "Literal" && (value.value === null || value.value === false)) || (value.type === "Identifier" && value.name === "undefined");
}

function stringValue(node: ESTree.Node | undefined): string | undefined {
  return node?.type === "Literal" && typeof node.value === "string" ? node.value : undefined;
}

function calleeName(callee: ESTree.Expression): string | undefined {
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier") return callee.property.name;
  return undefined;
}

function behaviorCodes(program: ESTree.Program): Set<RollupCode> {
  const found = new Set<RollupCode>();
  const checkModule = (source: string | undefined) => {
    if (source !== undefined && polyfillPattern.test(source)) found.add("polyfills");
  };

  new Visitor({
    ImportDeclaration(node) {
      checkModule(node.source.value);
    },
    ImportExpression(node) {
      checkModule(stringValue(node.source));
    },
    CallExpression(node) {
      const name = calleeName(node.callee);
      if (name === "require") checkModule(stringValue(node.arguments[0]));
      if (name === "emitFile") found.add("asset-handling");
    },
    MethodDefinition(node) {
      if (hookNames.has(keyName(node) ?? "")) found.add("rollup-transforms");
    },
    Property(node) {
      const name = keyName(node);
      const { value } = node;
      if (name === "plugins" && !(value.type === "ArrayExpression" && value.elements.length === 0)) found.add("rollup-plugins");
      if (name !== undefined && hookNames.has(name) && !isDisabled(value)) found.add("rollup-transforms");
      if (name === "assetFileNames") found.add("asset-handling");
      if (
        name !== undefined &&
        replacementOptions.has(name) &&
        value.type === "ObjectExpression" &&
        value.properties.some((property) => property.type === "Property" && runtimeGlobals.has(keyName(property) ?? ""))
      ) {
        found.add("polyfills");
      }
    },
  }).visit(program);
  return found;
}

function topLevelBindings(program: ESTree.Program): Map<string, ESTree.Expression> {
  const bindings = new Map<string, ESTree.Expression>();
  for (const statement of program.body) {
    const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (declaration?.type !== "VariableDeclaration") continue;
    for (const declarator of declaration.declarations) {
      if (declarator.id.type === "Identifier" && declarator.init) bindings.set(declarator.id.name, declarator.init);
    }
  }
  return bindings;
}

function resolve(start: ESTree.Expression, bindings: Map<string, ESTree.Expression>): ESTree.Expression {
  const seen = new Set<string>();
  let node = start;
  for (;;) {
    if (
      node.type === "TSAsExpression" ||
      node.type === "TSSatisfiesExpression" ||
      node.type === "TSNonNullExpression" ||
      node.type === "ParenthesizedExpression"
    ) {
      node = node.expression;
    } else if (
      node.type === "CallExpression" &&
      calleeName(node.callee) === "defineConfig" &&
      node.arguments[0] &&
      node.arguments[0].type !== "SpreadElement"
    ) {
      node = node.arguments[0];
    } else if (node.type === "Identifier" && bindings.has(node.name) && !seen.has(node.name)) {
      seen.add(node.name);
      node = bindings.get(node.name) ?? node;
    } else {
      return node;
    }
  }
}

function exportedConfig(program: ESTree.Program): ESTree.Node | undefined {
  for (const statement of program.body) {
    if (statement.type === "ExportDefaultDeclaration") return statement.declaration;
    if (
      statement.type === "ExpressionStatement" &&
      statement.expression.type === "AssignmentExpression" &&
      statement.expression.left.type === "MemberExpression" &&
      statement.expression.left.object.type === "Identifier" &&
      statement.expression.left.object.name === "module" &&
      statement.expression.left.property.type === "Identifier" &&
      statement.expression.left.property.name === "exports"
    ) {
      return statement.expression.right;
    }
  }
  return undefined;
}

function isExpression(node: ESTree.Node | null | undefined): node is ESTree.Expression {
  return node !== null && node !== undefined && node.type !== "SpreadElement" && !node.type.endsWith("Declaration");
}

function entryCount(value: ESTree.Expression): number | undefined {
  if (value.type === "ArrayExpression") return value.elements.length;
  if (value.type === "ObjectExpression") return value.properties.length;
  if (value.type === "Literal" || value.type === "TemplateLiteral") return 1;
  return undefined;
}

function structureCodes(program: ESTree.Program): RollupCode[] {
  const bindings = topLevelBindings(program);
  const exported = exportedConfig(program);
  if (!isExpression(exported)) return ["dynamic-rollup-config"];

  const value = resolve(exported, bindings);
  const configs = (value.type === "ArrayExpression" ? value.elements : [value]).map((element) =>
    isExpression(element) ? resolve(element, bindings) : undefined
  );
  const objects = configs.filter((config) => config?.type === "ObjectExpression");
  if (objects.length !== configs.length) return ["dynamic-rollup-config"];

  let entries = 0;
  for (const config of objects) {
    const input = config.properties.find((property) => property.type === "Property" && keyName(property) === "input");
    if (input === undefined) {
      if (config.properties.some((property) => property.type === "SpreadElement")) return ["dynamic-rollup-config"];
      continue;
    }
    const count = input.type === "Property" && isExpression(input.value) ? entryCount(resolve(input.value, bindings)) : undefined;
    if (count === undefined) return ["dynamic-rollup-config"];
    entries += count;
  }
  return objects.length > 1 || entries > 1 ? ["multi-entry"] : [];
}

export function rollupConfigCodes(filename: string, source: string): RollupCode[] {
  const { program, errors } = parseSync(filename, source);
  if (errors.length > 0) return ["unparseable-rollup-config"];
  return [...behaviorCodes(program), ...structureCodes(program)];
}

export async function inspectRollupConfig(filePath: string, relativePath: string): Promise<Finding[]> {
  return rollupConfigCodes(filePath, await readFile(filePath, "utf8")).map((code) => ({ code, path: relativePath }));
}
