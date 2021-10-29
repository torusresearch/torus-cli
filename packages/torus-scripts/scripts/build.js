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
const generateRollupConfig = require("../config/rollup.config");
const generateWebpackConfig = require("../config/webpack.config");
const torusConfig = require("../config/torus.config");
const formatWebpackMessages = require("../helpers/formatWebpackMessages");
const paths = require("../config/paths");

finalArgs.name = finalArgs.name || torusConfig.name;

if (paths.dotenv) {
  require("dotenv").config({ path: paths.dotenv });
}

async function buildRollup() {
  const config = generateRollupConfig(finalArgs.name);
  const outputOptions = Array.isArray(config.output) ? config.output : [config.output];
  // console.log(bundle.watchFiles);
  const bundle = await rollup.rollup(config);

  await Promise.all(
    outputOptions.map(async (outputOption) => {
      await bundle.generate(outputOption);
      // console.log(output);
      await bundle.write(outputOption);
    })
  );
  await bundle.close();
}

async function buildWebpack() {
  const configs = generateWebpackConfig(finalArgs.name);
  const results = await Promise.all(
    configs.map(async (x) => {
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

          const resolveArgs = {
            stats,
            warnings: messages.warnings,
          };
          return resolve(resolveArgs);
        });
      });
    })
  );
  console.log(
    results.map((x) =>
      x.stats?.toJson({
        all: false,
        assets: true,
      })
    )
  );
}

if (torusConfig.esm) buildRollup();

buildWebpack();
