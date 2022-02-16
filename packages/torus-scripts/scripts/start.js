"use strict";

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = "development";
process.env.NODE_ENV = "development";

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on("unhandledRejection", (err) => {
  throw err;
});

const argv = process.argv.slice(2);

const finalArgs = {};
argv.forEach((val) => {
  if (val.includes("=")) {
    const [key, value] = val.split("=");
    finalArgs[key.slice(2)] = value;
  } else {
    finalArgs[val] = true;
  }
});

const rollup = require("rollup");
const webpack = require("webpack");
const chalk = require("chalk");
const { Listr } = require("listr2");
const { Observable } = require("rxjs");

const generateRollupConfig = require("../config/rollup.config");
const generateWebpackConfig = require("../config/webpack.config");
const torusConfig = require("../config/torus.config");
const paths = require("../config/paths");
const formatWebpackMessages = require("../helpers/formatWebpackMessages");

finalArgs.name = finalArgs.name || torusConfig.name;

if (paths.dotenv) {
  require("dotenv").config({ path: paths.dotenv });
}

function getRollupTasks() {
  const config = generateRollupConfig(finalArgs.name);
  const outputOptions = Array.isArray(config.output) ? config.output : [config.output];
  config.watch = {
    clearScreen: false,
  };
  return outputOptions.map((outputOption) => {
    const filenameChunks = outputOption.file.split("/");
    const filename = filenameChunks[filenameChunks.length - 1];
    return {
      title: filename,
      task: () => {
        return new Observable((observer) => {
          const watcher = rollup.watch(config);
          watcher.on("event", async (event) => {
            const bundle = event.result;
            if (event.code === "START") {
              observer.next(`Building ${filename}...`);
            } else if (bundle && event.code === "BUNDLE_END") {
              // If result is present, write it
              await bundle.write(outputOption);
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
              ignored: [/node_modules/],
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
            }
          );
        });
      },
      options: {
        persistentOutput: false,
      },
    };
  });
}

async function main() {
  const tasks = new Listr([], { concurrent: true });
  console.log(chalk.yellow("Collating for dev..."));
  if (torusConfig.esm) {
    tasks.add(getRollupTasks());
  }
  tasks.add(getWebpackTasks());
  try {
    await tasks.run();
  } catch (error) {
    console.error(chalk.red(error.message));
    console.error(chalk.red(error.stack));
    // Throw to exit with code 1
    throw new Error("Build failed");
  }
}

main();
