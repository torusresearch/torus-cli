// Port of eslint-plugin-tsdoc's `syntax` rule. The upstream plugin depends on
// @typescript-eslint/utils, which forces TypeScript 5 into the tree and cannot
// load with TypeScript 7. This wrapper keeps the rule on @microsoft/tsdoc.

import { statSync } from "node:fs";
import path from "node:path";

import { TextRange, TSDocConfiguration, TSDocParser } from "@microsoft/tsdoc";
import { TSDocConfigFile } from "@microsoft/tsdoc-config";

const configFiles = new Map();

function isStale(configFile) {
  if (configFile.checkForModifiedFiles()) return true;
  // A missing file records no timestamp, so an edit check cannot see one appear later.
  if (!configFile.fileNotFound || !configFile.filePath) return false;
  try {
    statSync(configFile.filePath);
    return true;
  } catch {
    return false;
  }
}

function configFor(filename) {
  const sourceFolder = path.dirname(path.resolve(filename));
  const configFilePath = TSDocConfigFile.findConfigPathForFolder(sourceFolder);
  const cacheKey = configFilePath || `${sourceFolder}/`;
  let configFile = configFiles.get(cacheKey);
  if (!configFile || isStale(configFile)) {
    configFile = TSDocConfigFile.loadFile(configFilePath);
    configFiles.set(cacheKey, configFile);
  }
  return configFile;
}

function parserFor(configFile) {
  const configuration = new TSDocConfiguration();
  if (configFile.fileNotFound) return { parser: new TSDocParser(configuration), applyError: undefined };
  let applyError;
  try {
    configFile.configureParser(configuration);
  } catch (error) {
    applyError = error;
  }
  return { parser: new TSDocParser(configuration), applyError };
}

const syntax = {
  meta: {
    type: "problem",
    docs: { description: "Validates that TypeScript documentation comments conform to the TSDoc standard" },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const configFile = configFor(context.physicalFilename || context.filename);
    const { parser, applyError } = parserFor(configFile);
    function checkCommentBlocks() {
      if (!configFile.fileNotFound && configFile.hasErrors) {
        context.report({
          loc: { line: 1, column: 0 },
          message: `error loading TSDoc config file:\n${configFile.getErrorSummary()}`,
        });
      }
      if (applyError) {
        context.report({
          loc: { line: 1, column: 0 },
          message: `error applying TSDoc configuration: ${applyError.message}`,
        });
      }
      for (const comment of sourceCode.getAllComments()) {
        if (comment.type !== "Block" || !comment.range) continue;
        const textRange = TextRange.fromStringRange(sourceCode.text, comment.range[0], comment.range[1]);
        // Smallest doc comment is "/***/"; it must start with "/**".
        if (textRange.length < 5 || textRange.buffer[textRange.pos + 2] !== "*") continue;
        const parserContext = parser.parseRange(textRange);
        for (const message of parserContext.log.messages) {
          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(message.textRange.pos),
              end: sourceCode.getLocFromIndex(message.textRange.end),
            },
            message: `${message.messageId}: ${message.unformattedText}`,
          });
        }
      }
    }
    return { Program: checkCommentBlocks };
  },
};

export default {
  meta: { name: "tsdoc" },
  rules: { syntax },
};
