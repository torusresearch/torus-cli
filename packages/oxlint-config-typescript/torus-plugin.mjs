// Ports of @typescript-eslint rules whose package cannot load with TypeScript 7.

const TYPE_LIKE_SELECTORS = {
  ClassDeclaration: "Class",
  ClassExpression: "Class",
  TSInterfaceDeclaration: "Interface",
  TSTypeAliasDeclaration: "Type Alias",
  TSEnumDeclaration: "Enum",
  TSTypeParameter: "Type Parameter",
};

function isCamelCase(name) {
  return name.length === 0 || (name[0] === name[0].toLowerCase() && !name.includes("_"));
}

function isPascalCase(name) {
  return name.length === 0 || (name[0] === name[0].toUpperCase() && !name.includes("_"));
}

function isUpperCase(name) {
  return name.length === 0 || (name === name.toUpperCase() && !name.startsWith("_") && !name.endsWith("_") && !name.includes("__"));
}

const typeNames = {
  meta: {
    type: "suggestion",
    docs: { description: "Require camelCase, UPPER_CASE, or PascalCase type-like names" },
  },
  create(context) {
    function check(node) {
      const identifier = node.type === "TSTypeParameter" ? node.name : node.id;
      const name = typeof identifier === "string" ? identifier : identifier?.name;
      if (!name || isCamelCase(name) || isUpperCase(name) || isPascalCase(name)) return;
      context.report({
        node: identifier && typeof identifier === "object" ? identifier : node,
        message: `${TYPE_LIKE_SELECTORS[node.type]} name \`${name}\` must match one of the following formats: camelCase, UPPER_CASE, PascalCase`,
      });
    }
    return Object.fromEntries(Object.keys(TYPE_LIKE_SELECTORS).map((type) => [type, check]));
  },
};

function memberGroupOrder(type) {
  const accessibilities = ["public", "protected", "private", "#private"];
  return [
    ...accessibilities.map((access) => `${access}-static-${type}`),
    ...accessibilities.slice(0, 3).map((access) => `${access}-decorated-${type}`),
    ...accessibilities.map((access) => `${access}-instance-${type}`),
    ...accessibilities.slice(0, 2).map((access) => `${access}-abstract-${type}`),
    ...accessibilities.map((access) => `${access}-${type}`),
    `static-${type}`,
    `instance-${type}`,
    `abstract-${type}`,
    `decorated-${type}`,
    type,
  ];
}

const DEFAULT_ORDER = [
  "signature",
  "call-signature",
  ...memberGroupOrder("field"),
  "static-initialization",
  "public-constructor",
  "protected-constructor",
  "private-constructor",
  "constructor",
  ...memberGroupOrder("accessor"),
  ...memberGroupOrder("get"),
  ...memberGroupOrder("set"),
  ...memberGroupOrder("method"),
];

const FUNCTION_EXPRESSIONS = new Set(["FunctionExpression", "ArrowFunctionExpression"]);

function getNodeType(node) {
  switch (node.type) {
    case "TSAbstractMethodDefinition":
    case "MethodDefinition":
    case "TSMethodSignature":
      return node.kind;
    case "TSCallSignatureDeclaration":
      return "call-signature";
    case "TSConstructSignatureDeclaration":
      return "constructor";
    case "TSAbstractPropertyDefinition":
    case "TSPropertySignature":
      return node.readonly ? "readonly-field" : "field";
    case "TSAbstractAccessorProperty":
    case "AccessorProperty":
      return "accessor";
    case "PropertyDefinition":
      if (node.value && FUNCTION_EXPRESSIONS.has(node.value.type)) return "method";
      return node.readonly ? "readonly-field" : "field";
    case "TSIndexSignature":
      return node.readonly ? "readonly-signature" : "signature";
    case "StaticBlock":
      return "static-initialization";
    default:
      return null;
  }
}

function getMemberName(node, sourceCode) {
  switch (node.type) {
    case "TSConstructSignatureDeclaration":
      return "new";
    case "TSCallSignatureDeclaration":
      return "call";
    case "TSIndexSignature":
      return `[${node.parameters.map((parameter) => sourceCode.getText(parameter)).join(", ")}]`;
    case "StaticBlock":
      return "static block";
    default:
      break;
  }
  if ((node.type === "MethodDefinition" || node.type === "TSAbstractMethodDefinition") && node.kind === "constructor") return "constructor";
  const { key } = node;
  if (!key) return null;
  if (key.type === "Identifier" || key.type === "PrivateIdentifier") return key.name;
  if (key.type === "Literal") return String(key.value);
  return sourceCode.getText(key);
}

function getAccessibility(node) {
  if (node.accessibility) return node.accessibility;
  if (node.key?.type === "PrivateIdentifier") return "#private";
  return "public";
}

function getRank(node, supportsModifiers) {
  const type = getNodeType(node);
  if (node.type === "MethodDefinition" && node.value.type === "TSEmptyBodyFunctionExpression") return -1;
  if (type == null) return DEFAULT_ORDER.length - 1;

  const abstract = node.type.startsWith("TSAbstract");
  const scope = node.static ? "static" : abstract ? "abstract" : "instance";
  const accessibility = getAccessibility(node);
  const groups = [];
  if (supportsModifiers) {
    if (node.decorators?.length > 0 && ["readonly-field", "field", "method", "accessor", "get", "set"].includes(type)) {
      groups.push(`${accessibility}-decorated-${type}`, `decorated-${type}`);
      if (type === "readonly-field") groups.push(`${accessibility}-decorated-field`, "decorated-field");
    }
    if (type !== "readonly-signature" && type !== "signature" && type !== "static-initialization") {
      if (type !== "constructor") {
        groups.push(`${accessibility}-${scope}-${type}`, `${scope}-${type}`);
        if (type === "readonly-field") groups.push(`${accessibility}-${scope}-field`, `${scope}-field`);
      }
      groups.push(`${accessibility}-${type}`);
      if (type === "readonly-field") groups.push(`${accessibility}-field`);
    }
  }
  groups.push(type);
  if (type === "readonly-signature") groups.push("signature");
  else if (type === "readonly-field") groups.push("field");

  for (const group of groups) {
    const rank = DEFAULT_ORDER.indexOf(group);
    if (rank !== -1) return rank;
  }
  return -1;
}

function getLowestRank(ranks, target) {
  let lowest = ranks[ranks.length - 1];
  for (const rank of ranks) {
    if (rank > target) lowest = Math.min(lowest, rank);
  }
  return DEFAULT_ORDER[lowest].replaceAll("-", " ");
}

const memberOrdering = {
  meta: {
    type: "suggestion",
    docs: { description: "Require the default @typescript-eslint member declaration order" },
  },
  create(context) {
    function check(members, supportsModifiers) {
      const previousRanks = [];
      for (const member of members) {
        const rank = getRank(member, supportsModifiers);
        if (rank === -1) continue;
        const lastRank = previousRanks[previousRanks.length - 1];
        if (rank < lastRank) {
          context.report({
            node: member,
            message: `Member ${getMemberName(member, context.sourceCode)} should be declared before all ${getLowestRank(previousRanks, rank)} definitions.`,
          });
        } else if (rank !== lastRank) {
          previousRanks.push(rank);
        }
      }
    }
    return {
      ClassBody: (node) => check(node.body, true),
      TSInterfaceBody: (node) => check(node.body, false),
      TSTypeLiteral: (node) => check(node.members, false),
    };
  },
};

export default {
  meta: { name: "torus" },
  rules: {
    "type-names": typeNames,
    "member-ordering": memberOrdering,
  },
};
