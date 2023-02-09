import updater from "update-notifier";

import { readJSONFile } from "./utils.js";

const pkg = readJSONFile(new URL("../package.json", import.meta.url));

export default function () {
  updater({ pkg }).notify();
}
