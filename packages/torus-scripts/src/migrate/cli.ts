#!/usr/bin/env node

import { argv, stderr, stdout } from "node:process";

import { run } from "./run.js";

process.exitCode = await run(argv.slice(2), {
  stdout: (text) => stdout.write(text),
  stderr: (text) => stderr.write(text),
});
