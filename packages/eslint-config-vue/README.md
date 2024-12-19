# @toruslabs/eslint-config-vue

Sharable ESLint config for Vue 3 + TypeScript repositories at Torus Labs.

Please use the `@toruslabs/eslint-config-vue` package in your project.

Work with Eslint ^9.0.0, flat config file.

## Usage

```bash
npm install --save-dev @toruslabs/eslint-config-vue
```

In your project, add the following to your `.eslintrc.js` file:

```js
import torusVueConfig from "@toruslabs/eslint-config-vue";

export default [
  ...torusVueConfig,
  {
    // your custom rules and config here
  },
];
```
