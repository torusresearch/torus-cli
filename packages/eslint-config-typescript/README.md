# @toruslabs/eslint-config-vue

Sharable ESLint config for TypeScript repositories at Torus Labs.

Please use the `@toruslabs/eslint-config-typescript` package in your project.

Work with Eslint ^9.0.0, flat config file.

## Usage

```bash
npm install --save-dev @toruslabs/eslint-config-typescript
```

In your project, add the following to your `.eslintrc.js` file:

```js
import torusTypescriptConfig from "@toruslabs/eslint-config-typescript";

export default [
  ...torusTypescriptConfig,
  {
    // your custom rules and config here
  },
];
```
