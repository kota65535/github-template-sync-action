const core = require("@actions/core");
const execa = require("execa");

const exec = (file, options) => {
  core.startGroup(`running command: ${file} ${(options || []).join(" ")}`);
  const res = execa.sync(file, options);
  core.info(res.stdout);
  core.endGroup();
  return res;
};

module.exports = {
  exec,
};
