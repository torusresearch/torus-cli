// gets the babel config for build
// merges the user provided config with the default config
// and returns the merged config

import merge from "babel-merge";

import paths from "./paths.js";
import defaultConfig from "@toruslabs/config/babel.config.js";
import { readFile } from "../helpers/utils.js";

const userConfig = await readFile(paths.appBabelConfig);

const finalConfig = merge(defaultConfig, userConfig.default || userConfig || {});

export default finalConfig;
