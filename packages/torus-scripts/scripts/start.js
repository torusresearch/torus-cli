"use strict";

const ctx = { rollupWatchers: [] };
import chalk from "chalk";

function closeWatchers() {
  console.log(chalk.yellow("Stopping dev server..."));
  ctx.rollupWatchers.forEach((watcher) => {
    if (watcher) watcher.close();
  });
}
const killEvents = ["SIGINT", "SIGTERM"];

killEvents.forEach(function (sig) {
  process.on(sig, function () {
    closeWatchers();
    process.exit();
  });
});

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on("unhandledRejection", (err) => {
  closeWatchers();
  throw err;
});

import { watch } from "rollup";
import { Listr } from "listr2";
import { Observable } from "rxjs";
import parseArgs from "yargs-parser";
import dotenv from "dotenv";

import generateRollupConfig from "../config/rollup.config.js";
import torusConfig from "../config/torus.config.js";
import paths from "../config/paths.js";
import updatePackageNotification from "../helpers/updatePackage.js";
import { startHelpText } from "../helpers/constants.js";
import { deleteFolder } from "../helpers/utils.js";

const aliases = {
  n: "name",
  h: "help",
};

const parseCliArguments = (args) => {
  const options = parseArgs(args, {
    alias: aliases,
    configuration: {
      "parse-numbers": false,
      "camel-case-expansion": false,
    },
  });
  options.name = options.name || torusConfig.name;
  return options;
};

const finalArgs = parseCliArguments([].slice.call(process.argv, 2));

if (paths.dotenv) {
  dotenv.config({ path: paths.dotenv });
}

function addOutput({ rollupWatcher }) {
  if (rollupWatcher) ctx.rollupWatchers.push(rollupWatcher);
}

function getRollupTasks() {
  const config = generateRollupConfig(finalArgs.name);
  const configOptions = Array.isArray(config) ? config : [config];
  config.watch = {
    clearScreen: false,
  };
  return configOptions.map((configOption) => {
    // use dir option for dynamic imports
    const filenameChunks = configOption.output.dir ? configOption.output.dir.split("/") : configOption.output.file.split("/");
    const filename = filenameChunks[filenameChunks.length - 1];
    return {
      title: filename,
      task: () => {
        return new Observable((observer) => {
          const watcher = watch(configOption);
          watcher.on("event", async (event) => {
            const bundle = event.result;
            if (event.code === "START") {
              observer.next(`Building ${filename}...`);
            } else if (bundle && event.code === "BUNDLE_END") {
              // If result is present, write it
              await bundle.write(configOption.output);
              await bundle.close();
              observer.next(`Build complete for ${filename}...`);
            } else if (bundle && event.code === "ERROR") {
              await bundle.close();
              observer.next(chalk.red("Build failed"));
              console.error(event.error);
            } else if (event.code === "END") {
              observer.next(`Done. Watching for changes...`);
            }
          });
          addOutput({ rollupWatcher: watcher });
        });
      },
      options: {
        persistentOutput: false,
      },
    };
  });
}

async function main() {
  console.log(chalk.yellow("Cleaning dist folder..."));
  await deleteFolder(paths.appBuild);
  const tasks = new Listr([], { concurrent: true });
  console.log(chalk.yellow("Collating for dev..."));
  const rollupTasks = getRollupTasks();
  if (rollupTasks.length > 0) tasks.add(rollupTasks);
  try {
    await tasks.run();
  } catch (error) {
    console.error(chalk.red(error.message));
    console.error(chalk.red(error.stack));
    // Throw to exit with code 1
    throw new Error("Build failed");
  }
}

updatePackageNotification();

if (finalArgs.help) {
  console.log(startHelpText);
  process.exit(0);
}

main();
