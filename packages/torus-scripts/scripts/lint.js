"use strict";

// Makes the script crash on unhandled rejections instead of silently
// ignoring them.
process.on("unhandledRejection", (err) => {
  throw err;
});

import { ESLint } from "eslint";
import chalk from "chalk";
import parseArgs from "yargs-parser";

import paths from "../config/paths.js";
import updatePackageNotification from "../helpers/updatePackage.js";
import { lintHelpText } from "../helpers/constants.js";

/**
 * Run ESLint on specified files
 * @param {Object} options - Lint options
 * @param {string[]} [options.files] - Files to lint. Defaults to src directory
 * @param {boolean} [options.fix=false] - Whether to auto-fix issues
 * @param {boolean} [options.cache=true] - Whether to use cache
 * @returns {Promise<{errorCount: number, warningCount: number}>} Lint results
 * @throws {Error} If linting fails with errors
 */
export async function runLint({ files, fix = false, cache = true } = {}) {
  const filesToLint = files || [paths.appSrc];

  console.log(chalk.yellow("Linting files..."));

  const eslint = new ESLint({
    fix,
    cache,
    cwd: paths.appPath,
  });

  const results = await eslint.lintFiles(filesToLint);

  // Apply fixes if --fix was specified
  if (fix) {
    await ESLint.outputFixes(results);
  }

  // Format and output results
  const formatter = await eslint.loadFormatter("stylish");
  const resultText = await formatter.format(results);

  if (resultText) {
    console.log(resultText);
  }

  // Calculate totals
  const errorCount = results.reduce((acc, result) => acc + result.errorCount, 0);
  const warningCount = results.reduce((acc, result) => acc + result.warningCount, 0);

  if (errorCount > 0) {
    console.log(chalk.red(`\n✖ ${errorCount} error(s) and ${warningCount} warning(s) found.`));
    throw new Error("Lint failed");
  } else if (warningCount > 0) {
    console.log(chalk.yellow(`\n⚠ ${warningCount} warning(s) found.`));
    console.log(chalk.green("✔"), "Lint completed with warnings");
  } else {
    console.log(chalk.green("✔"), "Lint passed - no issues found");
  }

  return { errorCount, warningCount };
}

// Only run CLI when executed directly (not when imported)
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ""));

if (isMainModule) {
  const aliases = {
    f: "fix",
    h: "help",
    c: "cache",
  };

  const parseCliArguments = (args) => {
    const options = parseArgs(args, {
      alias: aliases,
      boolean: ["fix", "cache"],
      configuration: {
        "parse-numbers": false,
        "camel-case-expansion": false,
      },
    });
    return options;
  };

  const finalArgs = parseCliArguments([].slice.call(process.argv, 2));

  async function main() {
    // Files to lint - default to src directory if no files specified
    const files = finalArgs._.length > 0 ? finalArgs._ : undefined;

    try {
      await runLint({
        files,
        fix: finalArgs.fix || false,
        cache: finalArgs.cache !== false,
      });
    } catch (error) {
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  }

  updatePackageNotification();

  if (finalArgs.help) {
    console.log(lintHelpText);
    process.exit(0);
  }

  main();
}
