# @toruslabs/eslint-config-node

Sharable ESLint config for Node.js repositories at Torus Labs.

Please use the `@toruslabs/eslint-config-node` package in your project.

Work with Eslint ^9.0.0, flat config file.

## Usage

```bash
npm install --save-dev @toruslabs/eslint-config-node
```

In your project, add the following to your `.eslintrc.js` file:

```js
import torusNodeConfig from "@toruslabs/eslint-config-node";

export default [
  ...torusNodeConfig,
  {
    // your custom rules and config here
  },
];
```
