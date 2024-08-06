"use strict";

const ctx = { webpackWatchers: [], rollupWatchers: [] };
import chalk from "chalk";

function closeWatchers() {
  console.log(chalk.yellow("Stopping dev server..."));
  ctx.webpackWatchers.forEach((watcher) => {
    if (watcher) watcher.close();
  });
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
import webpack from "webpack";
import { Listr } from "listr2";
import { Observable } from "rxjs";
import parseArgs from "yargs-parser";
import dotenv from "dotenv";

import generateRollupConfig from "../config/rollup.config.js";
import generateWebpackConfig from "../config/webpack.config.js";
import torusConfig from "../config/torus.config.js";
import paths from "../config/paths.js";
import formatWebpackMessages from "../helpers/formatWebpackMessages.js";
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

function addOutput({ webpackWatcher, rollupWatcher }) {
  if (webpackWatcher) ctx.webpackWatchers.push(webpackWatcher);
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

function getWebpackTasks() {
  const configs = generateWebpackConfig(finalArgs.name);
  return configs.map((x) => {
    return {
      title: x.output.filename,
      task: () => {
        return new Observable((observer) => {
          const compiler = webpack(x);
          observer.next(`Building ${x.output.filename}...`);
          compiler.watch(
            {
              ignored: /node_modules/,
            },
            (err, stats) => {
              let messages;
              if (err) {
                if (!err.message) {
                  observer.next(chalk.red("Build failed"));
                  console.error(err);
                }

                messages = formatWebpackMessages({
                  errors: [err.message],
                  warnings: [],
                });
              } else {
                messages = formatWebpackMessages(stats.toJson({ all: false, warnings: false, errors: true }));
              }

              if (messages.errors.length) {
                // Only keep the first error. Others are often indicative
                // of the same problem, but confuse the reader with noise.
                if (messages.errors.length > 1) {
                  messages.errors.length = 1;
                }
                observer.next(chalk.red("Build failed"));
                console.error(new Error(messages.errors.join("\n\n")));
                return;
              }

              observer.next(`Build complete for ${x.output.filename}...`);
              observer.next(`Done. Watching for changes...`);
            },
          );
          addOutput({ webpackWatcher: compiler });
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
  const webpackTasks = getWebpackTasks();
  if (webpackTasks.length > 0) tasks.add(webpackTasks);
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
