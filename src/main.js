const path = require("path");
const fs = require("fs");
const core = require("@actions/core");
const micromatch = require("micromatch");
const { createConversions, convert } = require("./util");
const {
  getGitCredentials,
  setGitCredentials,
  listFiles,
  listDiffFiles,
  merge,
  commit,
  push,
  getCurrentHash,
  checkoutRemote,
} = require("./git");
const { getInputs } = require("./input");
const { createPr, listPrs, updatePr } = require("./github");

async function main() {
  const inputs = await getInputs();
  const creds = getGitCredentials();
  setGitCredentials(inputs.githubToken);
  try {
    await sync(inputs);
  } finally {
    // Restore credentials
    setGitCredentials(creds);
  }
  core.setOutput("pr-branch", inputs.prBranch);
}

async function sync(inputs) {
  // Checkout template repository
  checkoutRemote(inputs.templateRepo.owner, inputs.templateRepo.name, "template", inputs.templateBranch);

  // Get changed files from the last synchronized commit to HEAD
  let files = getChangedFiles(inputs.templateSyncFile);
  core.info(`changed files: ${files.length}`);

  // Exclude files to be ignored
  files = ignoreFiles(files, inputs.ignorePaths);
  core.info(`changed files with ignored: ${files.length}`);

  // Add .templatesync file
  files.push(inputs.templateSyncFile);

  // Replace/Rename
  if (inputs.rename) {
    files = rename(files, inputs.fromName, inputs.toName);
    commit(files, "renamed");
  }

  // Merge
  merge(inputs.prBranch, inputs.prBase, inputs.templateBranch);
  commit(files, "merged template");

  // Push
  push();

  // Create PR
  await createOrUpdatePr(inputs);
}

function ignoreFiles(files, ignorePaths) {
  if (ignorePaths.length) {
    return micromatch.not(files, ignorePaths);
  } else {
    return files;
  }
}

function getChangedFiles(syncCommitFile) {
  let files;
  if (fs.existsSync(syncCommitFile)) {
    const lastSyncCommit = fs.readFileSync(syncCommitFile, "utf8");
    files = listDiffFiles(lastSyncCommit);
  } else {
    files = listFiles();
  }
  fs.writeFileSync(syncCommitFile, getCurrentHash(), "utf8");
  return files;
}

function rename(files, fromName, toName) {
  core.info(`${files.length} files to replace`);

  const conversions = createConversions(fromName, toName);

  // Replace file contents
  for (const t of files) {
    let s = fs.readFileSync(t, "utf8");
    s = convert(conversions, s);
    fs.writeFileSync(t, s, "utf8");
  }

  // Get directories where the files are located
  const filesAndDirs = getDirsFromFiles(files);
  core.info(`${filesAndDirs.length} files and directories to rename`);

  // Rename files and directories
  const cwd = process.cwd();
  for (const t of filesAndDirs) {
    const fromBase = path.basename(t);
    const fromDir = path.dirname(t);
    const toBase = convert(conversions, fromBase);
    const toDir = convert(conversions, fromDir);
    if (fromBase !== toBase) {
      process.chdir(toDir);
      fs.renameSync(fromBase, toBase);
      process.chdir(cwd);
    }
  }

  return files.map((f) => convert(conversions, f));
}

function getDirsFromFiles(files) {
  let ret = [];
  let dirList = [];
  const dirSet = new Set();
  for (const f of files) {
    let dir = f;
    while (true) {
      dir = path.dirname(dir);
      if (dir === ".") {
        break;
      }
      if (!dirSet.has(dir)) {
        dirList.push(dir);
      }
      dirSet.add(dir);
    }
    dirList.reverse();
    ret = ret.concat(dirList);
    dirList = [];
    ret.push(f);
  }
  return ret;
}

async function createOrUpdatePr(inputs) {
  const prs = await listPrs(inputs.prBranch, inputs.prBase);
  if (prs.length) {
    const prNum = prs[0].number;
    core.info(`updating existing PR #${prNum}`);
    await updatePr(prNum, inputs.prTitle, inputs.prBranch, inputs.prBase);
  } else {
    core.info("creating PR");
    await createPr(inputs.prTitle, inputs.prBranch, inputs.prBase);
  }
}

module.exports = {
  main,
};
