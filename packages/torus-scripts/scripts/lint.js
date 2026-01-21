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
  const files = finalArgs._.length > 0 ? finalArgs._ : [paths.appSrc];

  console.log(chalk.yellow("Linting files..."));

  const eslint = new ESLint({
    fix: finalArgs.fix || false,
    cache: finalArgs.cache || true,
    cwd: paths.appPath,
  });

  try {
    // Lint files
    const results = await eslint.lintFiles(files);

    // Apply fixes if --fix was specified
    if (finalArgs.fix) {
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
      process.exit(1);
    } else if (warningCount > 0) {
      console.log(chalk.yellow(`\n⚠ ${warningCount} warning(s) found.`));
      console.log(chalk.green("✔"), "Lint completed with warnings");
    } else {
      console.log(chalk.green("✔"), "Lint passed - no issues found");
    }
  } catch (error) {
    console.error(chalk.red("Linting failed:"));
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
