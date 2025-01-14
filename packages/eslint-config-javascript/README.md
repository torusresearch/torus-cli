# @toruslabs/eslint-config-javascript

Sharable ESLint config for JavaScript repositories at Torus Labs.

Please use the `@toruslabs/eslint-config-javascript` package in your project.

Work with Eslint ^9.0.0, flat config file.

## Usage

```bash
npm install --save-dev @toruslabs/eslint-config-javascript
```

In your project, add the following to your `.eslintrc.js` file:

```js
import torusJavascriptConfig from "@toruslabs/eslint-config-javascript";

export default [
  ...torusJavascriptConfig,
  {
    // your custom rules and config here
  },
];
```
