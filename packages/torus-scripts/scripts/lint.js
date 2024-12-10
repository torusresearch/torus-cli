import { ESLint } from "eslint";

const eslintInstance = new ESLint({
    baseConfig: require("../eslint.config.mjs"),
});

eslintInstance.lintFiles(["**/*.js", "**/*.ts"]);
