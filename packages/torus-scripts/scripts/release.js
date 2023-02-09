"use strict";

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on("unhandledRejection", (err) => {
  throw err;
});

import releaseIt from "release-it";
import parseArgs from "yargs-parser";
import chalk from "chalk";

import updatePackageNotification from "../helpers/updatePackage.js";

const aliases = {
  c: "config",
  d: "dry-run",
  h: "help",
  i: "increment",
  v: "version",
  V: "verbose",
};

const parseCliArguments = (args) => {
  const options = parseArgs(args, {
    boolean: ["dry-run", "ci"],
    alias: aliases,
    configuration: {
      "parse-numbers": false,
      "camel-case-expansion": false,
    },
  });
  if (options.V) {
    options.verbose = typeof options.V === "boolean" ? options.V : options.V.length;
    delete options.V;
  }
  options.increment = options._[0] || options.i;
  return options;
};

async function main() {
  try {
    const options = parseCliArguments([].slice.call(process.argv, 2));
    await releaseIt(options);
  } catch (error) {
    console.error(chalk.red(error.message));
    console.error(chalk.red(error.stack));
    // Throw to exit with code 1
    throw new Error("Release failed");
  }
}

updatePackageNotification();
main();
