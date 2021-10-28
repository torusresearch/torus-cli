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
const generateRollupConfig = require("../config/rollup.config");

async function build() {
  console.log(finalArgs);
  const config = await generateRollupConfig(finalArgs.name);
  console.log(config);
  const outputOptions = config.output;
  const bundle = await rollup.rollup(config);
  // console.log(bundle.watchFiles);
  await bundle.generate(outputOptions);
  // console.log(output);
  await bundle.write(outputOptions);
  await bundle.close();
}

build();
