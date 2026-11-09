// Port of eslint-plugin-tsdoc's `syntax` rule, wrapping @microsoft/tsdoc directly.
// The upstream plugin depends on @typescript-eslint/utils, which forces TypeScript 5
// into the tree and cannot load with TypeScript 7. This wrapper keeps the rule while
// depending only on @microsoft/tsdoc.

import { TextRange, TSDocConfiguration, TSDocParser } from "@microsoft/tsdoc";

const configuration = new TSDocConfiguration();
const parser = new TSDocParser(configuration);

const syntax = {
  meta: {
    type: "problem",
    docs: { description: "Validates that TypeScript documentation comments conform to the TSDoc standard" },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    function checkCommentBlocks() {
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
