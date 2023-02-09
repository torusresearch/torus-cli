// gets the babel config for build
// merges the user provided config with the default config
// and returns the merged config

import merge from "babel-merge";

import paths from "./paths.js";
import defaultConfig from "../defaults/babel.config.js";
import { readCjsFile } from "../helpers/utils.js";

const userConfig = await readCjsFile(paths.appBabelConfig);

export default merge(defaultConfig, userConfig.default || {});
