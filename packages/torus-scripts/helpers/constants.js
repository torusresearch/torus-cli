import { readJSONFile } from "./utils.js";

const pkg = readJSONFile(new URL("../package.json", import.meta.url));

export const helpText = `torus-scripts v${pkg.version}
  Usage: torus-scripts <script-name> [options]
  Use e.g. "torus-scripts build" directly".
  -h --help              Print this help
  -v --version           Print torus-scripts version number
For more details, please see https://github.com/torusresearch/torus-cli/tree/main/packages/torus-scripts`;

export const startHelpText = `torus-scripts v${pkg.version}
  Usage: torus-scripts start [options]
  Use e.g. "torus-scripts start" directly".
  -h --help              Print this help
  -n --name              Name of the project
For more details, please see https://github.com/torusresearch/torus-cli/tree/main/packages/torus-scripts`;

export const buildHelpText = `torus-scripts v${pkg.version}
  Usage: torus-scripts build [options]
  Use e.g. "torus-scripts build" directly".
  -h --help              Print this help
  -n --name              Name of the project
For more details, please see https://github.com/torusresearch/torus-cli/tree/main/packages/torus-scripts`;
