# @toruslabs/eslint-config-vue

Sharable ESLint config for React repositories at Torus Labs.

Please use the `@toruslabs/eslint-config-react` package in your project.

Work with Eslint ^9.0.0, flat config file.

## Usage

```bash
npm install --save-dev @toruslabs/eslint-config-react
```

In your project, add the following to your `.eslintrc.js` file:

```js
import torusReactConfig from "@toruslabs/eslint-config-react";

export default [
  ...torusReactConfig,
  {
    // your custom rules and config here
  },
];
```
