const updater = require("update-notifier");
const pkg = require("../package.json");

module.exports = function () {
  updater({ pkg }).notify();
};
