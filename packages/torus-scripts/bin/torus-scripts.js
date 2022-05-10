#!/usr/bin/env node

"use strict";

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on("unhandledRejection", (err) => {
  throw err;
});

const parseArgs = require("yargs-parser");
const { helpText } = require("../helpers/constants");

const aliases = {
  h: "help",
  v: "version",
};

const parseCliArguments = (args) => {
  const options = parseArgs(args, {
    alias: aliases,
    configuration: {
      "parse-numbers": false,
      "camel-case-expansion": false,
    },
  });
  return options;
};

const args = [].slice.call(process.argv, 2);
const parsedArgs = parseCliArguments(args);

if (parsedArgs.help) {
  console.log(helpText);
  process.exit(0);
} else if (parsedArgs.version) {
  console.log(`v${require("../package.json").version}`);
  process.exit(0);
}

const spawn = require("cross-spawn");

const scriptIndex = args.findIndex((x) => x === "build" || x === "start" || x === "release");

const script = scriptIndex === -1 ? args[0] : args[scriptIndex];
const nodeArgs = scriptIndex > 0 ? args.slice(0, scriptIndex) : [];

if (["build", "start", "release"].includes(script)) {
  const result = spawn.sync(process.execPath, nodeArgs.concat(require.resolve("../scripts/" + script)).concat(args.slice(scriptIndex + 1)), {
    stdio: "inherit",
  });
  if (result.signal) {
    if (result.signal === "SIGKILL") {
      console.log(
        "The script failed because the process exited too early. " +
          "This probably means the system ran out of memory or someone called " +
          "`kill -9` on the process."
      );
    } else if (result.signal === "SIGTERM") {
      console.log(
        "The script failed because the process exited too early. " +
          "Someone might have called `kill` or `killall`, or the system could " +
          "be shutting down."
      );
    }
    process.exit(1);
  }
  process.exit(result.status);
} else {
  console.log('Unknown script "' + script + '".');
  console.log("Perhaps you need to update torus-scripts?");
}
