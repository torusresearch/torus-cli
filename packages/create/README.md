# Create Torus App

The easiest way to get started with Web3 is by using `create-torus-app`. This CLI tool enables you to quickly start building a new Web3 application, with everything set up for you. You can create a new app using the default Torus template, or by using one of the [official Torus examples](/examples). To get started, use the following command:

```bash
npx create-torus-app
# or
yarn create torus-app
```

To create a new app in a specific folder, you can send a name as an argument. For example, the following command will create a new Torus app called `my-app` in a folder with the same name:

```bash
npx create-torus-app my-app
# or
yarn create torus-app
```

## Options

`create-torus-app` comes with the following options:

- **-e, --example [name]|[github-url]** - An example to bootstrap the app with. You can use an example name from the [official Torus examples](/examples) or a GitHub URL. The URL can use any branch and/or subdirectory.
- **--example-path &lt;path-to-example&gt;** - In a rare case, your GitHub URL might contain a branch name with a slash (e.g. bug/fix-1) and the path to the example (e.g. foo/bar). In this case, you must specify the path to the example separately: `--example-path foo/bar`
- **--use-npm** - Explicitly tell the CLI to bootstrap the app using npm. To bootstrap using yarn we recommend to run `yarn create torus-app`

## Why use Create Torus App?

`create-torus-app` allows you to create a new Torus app within seconds. It is officially maintained by Torus Labs, and includes a number of benefits:

- **Interactive Experience**: Running `npx create-torus-app` (with no arguments) launches an interactive experience that guides you through setting up a project.
- **Zero Dependencies**: Initializing a project is as quick as one second. Create Torus App has zero dependencies.
- **Offline Support**: Create Torus App will automatically detect if you're offline and bootstrap your project using your local package cache.
- **Support for Examples**: Create Torus App can bootstrap your application using an example from the Torus examples collection (e.g. `npx create-torus-app --example [name][github-url]`).
