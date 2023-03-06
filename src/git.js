const core = require("@actions/core");
const { exec } = require("./exec");

const extraHeaderKey = `http.https://github.com/.extraHeader`;

function checkoutTemplateMain(branch, repo) {
  exec("git", ["remote", "add", "template", `https://github.com/${repo}`]);
  exec("git", ["fetch", "template"]);
  exec("git", ["checkout", "-b", "template/main", "template/main"]);
}

function merge(branch, repo) {
  exec("git", ["checkout", "-b", "template-sync", "main"]);
  exec("git", ["merge", "template/main", "--allow-unrelated-histories", "--no-commit"]);
}

function restore(path) {
  exec("git", ["reset", path]);
  exec("git", ["checkout", path]);
}

function listFiles() {
  const { stdout } = exec("git", ["ls-files"]);
  return stdout.split("\n");
}

function setUserAsBot() {
  exec("git", ["config", "user.email", "github-actions[bot]@users.noreply.github.com"]);
  exec("git", ["config", "user.name", "github-actions[bot]"]);
}

function getGitCredentials() {
  try {
    const { stdout } = exec("git", ["config", "--get", extraHeaderKey, "^AUTHORIZATION: basic"]);
    return stdout;
  } catch (e) {
    return "";
  }
}

function setGitCredentials(token) {
  if (!token) {
    return;
  }
  // cf. https://github.com/actions/checkout/blob/main/src/git-auth-helper.ts#L57
  const base64Token = Buffer.from(`x-access-token:${token}`, "utf8").toString("base64");
  core.setSecret(base64Token);
  exec("git", ["config", "--unset-all", extraHeaderKey, "^AUTHORIZATION: basic"]);
  exec("git", ["config", extraHeaderKey, `AUTHORIZATION: basic ${base64Token}`]);
}

function commit(message) {
  setUserAsBot();
  try {
    exec("git", ["diff", "--quiet"]);
    return;
  } catch (e) {
    // do nothing
  }
  exec("git", ["add", "."]);
  exec("git", ["commit", "-m", message]);
}

function push() {
  exec("git", ["push", "origin", "HEAD"]);
}

module.exports = {
  listFiles,
  getGitCredentials,
  setGitCredentials,
  commit,
  push,
  checkoutTemplateMain,
  merge,
  restore
};
