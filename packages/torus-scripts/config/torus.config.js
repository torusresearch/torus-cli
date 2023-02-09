// gets the babel config for build
// merges the user provided config with the default config
// and returns the merged config

import merge from "lodash.mergewith";

import paths from "./paths.js";
import defaultConfig from "../defaults/torus.config.js";
import { readCjsFile } from "../helpers/utils.js";

const userConfig = await readCjsFile(paths.appTorusConfig);

export default merge(defaultConfig, userConfig.default || {});
