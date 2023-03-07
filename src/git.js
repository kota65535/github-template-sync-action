const core = require("@actions/core");
const { exec } = require("./exec");

const extraHeaderKey = `http.https://github.com/.extraHeader`;

function fetchRemote(owner, name, remote) {
  exec("git", ["remote", "add", remote, `https://github.com/${owner}/${name}`]);
  exec("git", ["fetch", "--all"]);
}

function createBranch(branch, base) {
  exec("git", ["checkout", "-b", branch, base]);
}

function merge(branch) {
  try {
    exec("git", ["merge", branch, "-X", "theirs", "--allow-unrelated-histories", "--no-commit"]);
  } catch (e) {
    // no-op
  }
  exec("git", ["reset"]);
}

function restore(path) {
  exec("git", ["reset", path]);
  exec("git", ["checkout", path]);
}

function listFiles() {
  const { stdout } = exec("git", ["ls-files"]);
  return stdout.split("\n");
}

function getLatestCommit() {
  const { stdout } = exec("git", ["rev-parse", "HEAD"]);
  return stdout;
}

function listDiffFiles(fromCommit) {
  const { stdout } = exec("git", ["diff", "--name-only", fromCommit, "HEAD"]);
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

function commit(files, message) {
  setUserAsBot();
  if (files) {
    for (const f of files) {
      try {
        exec("git", ["add", f]);
      } catch (e) {
        // do nothing
      }
    }
  } else {
    exec("git", ["add", "."]);
  }
  try {
    exec("git", ["diff-index", "--quiet", "HEAD"]);
    return;
  } catch (e) {
    // do nothing
  }
  exec("git", ["commit", "-m", message]);
}

function push() {
  exec("git", ["push", "-f", "origin", "HEAD"]);
}

function reset() {
  exec("git", ["reset", "--hard"]);
  exec("git", ["clean", "-fd"]);
}

module.exports = {
  fetchRemote,
  createBranch,
  merge,
  restore,
  listFiles,
  listDiffFiles,
  getLatestCommit,
  getGitCredentials,
  setGitCredentials,
  commit,
  push,
  reset,
};
