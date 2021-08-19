#!/usr/bin/env node

import chalk from "chalk";
import Commander from "commander";
import path from "path";
import prompts from "prompts";
import checkForUpdate from "update-check";
import { createApp, DownloadError } from "./create-app";
import { shouldUseYarn } from "./helpers/should-use-yarn";
import { validateNpmName } from "./helpers/validate-pkg";
import packageJson from "./package.json";

let projectPath: string = "";

const program = new Commander.Command(packageJson.name)
  .version(packageJson.version, "-v, --version")
  .argument("[<project-directory>]", "project directory")
  .action((arg) => {
    projectPath = arg;
  })
  .option(
    "--use-npm",
    `

  Explicitly tell the CLI to bootstrap the app using npm
`
  )
  .option(
    "-e, --example [name]|[github-url]",
    `

  An example to bootstrap the app with. You can use an example name
  from the official Torus examples or a GitHub URL. The URL can use
  any branch and/or subdirectory
`
  )
  .option(
    "--example-path <path-to-example>",
    `

  In a rare case, your GitHub URL might contain a branch name with
  a slash (e.g. bug/fix-1) and the path to the example (e.g. foo/bar).
  In this case, you must specify the path to the example separately:
  --example-path foo/bar
`
  )
  .parse(process.argv);

async function run(): Promise<void> {
  const options = program.opts();

  if (typeof projectPath === "string") {
    projectPath = projectPath.trim();
  }

  if (!projectPath) {
    const res = await prompts({
      type: "text",
      name: "path",
      message: "What is your project named?",
      initial: "my-app",
      validate: (name) => {
        const { valid, problems } = validateNpmName(
          path.basename(path.resolve(name))
        );
        return valid ? true : `Invalid project name: ${problems?.[0]}`;
      },
    });

    if (typeof res.path === "string") {
      projectPath = res.path.trim();
    }
  }

  if (!projectPath) {
    console.log();
    console.log("Please specify the project directory:");
    console.log(
      `  ${chalk.cyan(program.name())} ${chalk.green("<project-directory>")}`
    );
    console.log();
    console.log("For example:");
    console.log(`  ${chalk.cyan(program.name())} ${chalk.green("my-app")}`);
    console.log();
    console.log(
      `Run ${chalk.cyan(`${program.name()} --help`)} to see all options.`
    );
    process.exit(1);
  }

  const resolvedProjectPath = path.resolve(projectPath);
  const projectName = path.basename(resolvedProjectPath);

  const { valid, problems } = validateNpmName(projectName);
  if (!valid) {
    console.error(
      `Could not create a project called ${chalk.red(
        `"${projectName}"`
      )} because of npm naming restrictions:`
    );
    problems?.forEach((p) => console.error(`    ${chalk.red.bold("*")} ${p}`));
    process.exit(1);
  }

  if (options.example === true) {
    console.error(
      "Please provide an example name or url, otherwise remove the example option."
    );
    process.exit(1);
  }

  if (!options.example && options.examplePath) {
    console.error(
      "Please provide an example when providing example-path, otherwise remove the example-path option."
    );
    process.exit(1);
  }

  let example = typeof options.example === "string" && options.example.trim();
  if (!example) {
    const res = await prompts({
      type: "select",
      name: "example",
      message: "Choose an example",
      choices: [
        {
          value: "wallet",
          title: "Your First Dapp (HTML)",
        },
        {
          value: "wallet-react",
          title: "Your First Dapp (React)",
        },
        {
          value: "wallet-vue",
          title: "Your First Dapp (Vue)",
        },
        {
          value: "openlogin",
          title:
            "Dapp with Multi-factor Passwordless, SSO, Face/TouchID Login (HTML)",
        },
        {
          value: "customauth",
          title: "Dapp with Fully-Customizable Login (HTML)",
        },
      ],
    });
    if (typeof res.example === "string") {
      example = res.example.trim();
      if (example.includes(" ")) {
        const values = example.split(" ");
        example = values[0].trim();
        options.examplePath = values[1].trim();
      }
    }
  }

  if (!example) {
    console.log();
    console.log("No example selected. Using default template.");
    console.log();
  }

  try {
    await createApp({
      appPath: resolvedProjectPath,
      useNpm: !!options.useNpm,
      example: example && example !== "default" ? example : undefined,
      examplePath: options.examplePath,
    });
  } catch (error) {
    if (!(error instanceof DownloadError)) {
      throw error;
    }

    const res = await prompts({
      type: "confirm",
      name: "builtin",
      message:
        `Could not download example "${example}" because of a connectivity issue between your machine and GitHub.\n` +
        `Do you want to use the default template instead?`,
      initial: true,
    });
    if (!res.builtin) {
      throw error;
    }

    await createApp({
      appPath: resolvedProjectPath,
      useNpm: !!options.useNpm,
    });
  }
}

const update = checkForUpdate(packageJson).catch(() => null);

async function notifyUpdate(): Promise<void> {
  try {
    const res = await update;
    if (res?.latest) {
      const isYarn = shouldUseYarn();

      console.log();
      console.log(
        chalk.yellow.bold("A new version of `create-torus-app` is available!")
      );
      console.log(
        "You can update by running: " +
          chalk.cyan(
            isYarn
              ? "yarn global add create-torus-app"
              : "npm i -g create-torus-app"
          )
      );
      console.log();
    }
    process.exit();
  } catch {
    // Ignore.
  }
}

run()
  .then(notifyUpdate)
  .catch(async (error) => {
    console.log();
    console.log("Aborting installation.");
    if (error.command) {
      console.log(`  ${chalk.cyan(error.command)} has failed.`);
    } else {
      console.log(chalk.red("Unexpected error. Please report it as a bug:"));
      console.log(error);
    }
    console.log();
    await notifyUpdate();
    process.exit(1);
  });
