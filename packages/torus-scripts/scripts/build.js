"use strict";

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = "production";
process.env.NODE_ENV = "production";

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
const ui = require("cliui")({ width: process.stdout.columns || 80 });

const generateRollupConfig = require("../config/rollup.config");
const generateWebpackConfig = require("../config/webpack.config");
const torusConfig = require("../config/torus.config");
const paths = require("../config/paths");
const formatWebpackStats = require("../helpers/formatWebpackStats");
const formatWebpackMessages = require("../helpers/formatWebpackMessages");
const formatRollupStats = require("../helpers/formatRollupStats");

finalArgs.name = finalArgs.name || torusConfig.name;

if (paths.dotenv) {
  require("dotenv").config({ path: paths.dotenv });
}

function addOutput({ ctx, filename, formattedStats, type, warnings }) {
  if (!ctx.outputs) ctx.outputs = {};
  ctx.outputs[filename] = {
    type,
    formattedStats,
    warnings,
  };
}

function getRollupTasks() {
  const config = generateRollupConfig(finalArgs.name);
  const outputOptions = Array.isArray(config.output) ? config.output : [config.output];

  return outputOptions.map((outputOption) => {
    const filenameChunks = outputOption.file.split("/");
    const filename = filenameChunks[filenameChunks.length - 1];
    return {
      title: filename,
      task: async (ctx) => {
        const start = process.hrtime.bigint();
        const bundle = await rollup.rollup(config);
        await bundle.generate(outputOption);
        const output = await bundle.write(outputOption);
        await bundle.close();
        const end = process.hrtime.bigint();
        const time = ((end - start) / BigInt(1e6)).toString();
        const formattedStats = formatRollupStats(output.output, paths.appBuild, time);

        // time is in ms
        addOutput({ ctx, filename, formattedStats, warnings: [], type: "rollup" });
      },
    };
  });
}

function getWebpackTasks() {
  const configs = generateWebpackConfig(finalArgs.name);
  return configs.map((x) => {
    return {
      title: x.output.filename,
      task: (ctx) => {
        return new Promise((resolve, reject) => {
          webpack(x, (err, stats) => {
            let messages;
            if (err) {
              if (!err.message) {
                return reject(err);
              }

              messages = formatWebpackMessages({
                errors: [err.message],
                warnings: [],
              });
            } else {
              messages = formatWebpackMessages(stats.toJson({ all: false, warnings: true, errors: true }));
            }

            if (messages.errors.length) {
              // Only keep the first error. Others are often indicative
              // of the same problem, but confuse the reader with noise.
              if (messages.errors.length > 1) {
                messages.errors.length = 1;
              }
              return reject(new Error(messages.errors.join("\n\n")));
            }

            const formattedStats = formatWebpackStats(stats, paths.appBuild);

            addOutput({ ctx, filename: x.output.filename, warnings: messages.warnings, formattedStats, type: "webpack" });

            return resolve();
          });
        });
      },
    };
  });
}

async function main() {
  const tasks = new Listr([], { concurrent: true });
  console.log(chalk.yellow("Collating builds..."));
  if (torusConfig.esm) {
    tasks.add(getRollupTasks());
  }
  tasks.add(getWebpackTasks());
  try {
    const ctx = await tasks.run();

    Object.keys(ctx.outputs).forEach((filename) => {
      const outputObj = ctx.outputs[filename];
      const warnings = outputObj.warnings;
      if (warnings.length > 0) {
        console.log(chalk.yellow("\nCompiled with warnings.\n"));
        console.log(warnings.join("\n\n"));
        console.log("\nSearch for the " + chalk.underline(chalk.yellow("keywords")) + " to learn more about each warning.");
        console.log("To ignore, add " + chalk.cyan("// eslint-disable-next-line") + " to the line before.\n");
      }
    });

    ui.div(chalk.cyan.bold(`File`), chalk.cyan.bold(`Size`), chalk.cyan.bold(`Gzipped`), chalk.cyan.bold(`Time`));

    Object.keys(ctx.outputs).forEach((filename) => {
      const outputObj = ctx.outputs[filename];
      outputObj.formattedStats.map((x) => ui.div(...x));
    });

    ui.div(`\n ${chalk.gray(`Images and other types of assets omitted.`)}\n`);

    console.log(ui.toString());

    console.log(chalk.green("✔"), "Build complete");
  } catch (error) {
    console.error(chalk.red(error.message));
    console.error(chalk.red(error.stack));
    // Throw to exit with code 1
    throw new Error("Build failed");
  }
}

main();
