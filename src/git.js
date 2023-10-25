const core = require("@actions/core");
const { exec } = require("./exec");

const GITHUB_HOST = "github.com";
const extraHeaderKey = `http.https://${GITHUB_HOST}/.extraHeader`;

function fetchRemote(fullName, remote) {
  exec("git", ["remote", "add", remote, `https://github.com/${fullName}`]);
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

function listFiles() {
  const { stdout } = exec("git", ["ls-files"]);
  return stdout.split("\n").filter((s) => s);
}

function getLatestCommit() {
  const { stdout } = exec("git", ["rev-parse", "HEAD"]);
  return stdout;
}

function getLatestCommitBefore(datetime) {
  const { stdout } = exec("git", ["log", "-1", "--before", datetime, "--pretty=%H"]);
  return stdout;
}

function listDiffFiles(fromCommit, toCommit) {
  const options = ["diff-tree", "--no-commit-id", "--name-only", "-r", fromCommit];
  if (toCommit) {
    options.push(toCommit);
  }
  const { stdout } = exec("git", options);
  return stdout.split("\n").filter((s) => s);
}

function listDiffFilesWithStatus(fromCommit) {
  const { stdout } = exec("git", ["diff", "--name-status", "--no-renames", fromCommit, "HEAD"]);
  const ret = [];
  for (const s of stdout.split("\n").filter((s) => s)) {
    const [status, name] = s.split("\t");
    ret.push({ status, name });
  }
  return ret;
}

function setUserAsBot() {
  exec("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
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
  try {
    exec("git", ["config", "--unset-all", extraHeaderKey, "^AUTHORIZATION: basic"]);
  } catch (e) {
    if (e.exitCode === 5) {
      core.info("already unset, continue");
    } else {
      throw e;
    }
  }
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
    exec("git", ["diff-index", "--cached", "--quiet", "HEAD"]);
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

function getDiffCommits(refA, refB) {
  const { stdout } = exec("git", ["log", `${refA}..${refB}`, "--oneline", "--no-merges"]);
  return stdout.split("\n").filter((s) => s);
}

module.exports = {
  GITHUB_HOST,
  fetchRemote,
  createBranch,
  merge,
  listFiles,
  listDiffFiles,
  listDiffFilesWithStatus,
  getLatestCommit,
  getLatestCommitBefore,
  getGitCredentials,
  setGitCredentials,
  commit,
  push,
  reset,
  getDiffCommits,
};
