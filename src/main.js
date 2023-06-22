const path = require("path");
const fs = require("fs");
const core = require("@actions/core");
const micromatch = require("micromatch");
const { createConversions, convert } = require("./convert");
const {
  getGitCredentials,
  setGitCredentials,
  listFiles,
  listDiffFilesWithStatus,
  merge,
  commit,
  push,
  fetchRemote,
  createBranch,
  getLatestCommit,
  reset,
  getDiffCommits,
} = require("./git");
const { getInputs } = require("./input");
const { createPr, listPrs, updatePr, addLabels } = require("./github");
const { logJson } = require("./util");

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
  reset();

  // Get the last sync commit of the template repository
  const lastSyncCommit = getLastTemplateSyncCommit(inputs.templateSyncFile);
  logJson(lastSyncCommit ? `last sync: ${lastSyncCommit}` : "first sync");

  // Checkout template repository branch
  const remote = "template";
  const workingBranch = `${remote}/${inputs.templateBranch}`;
  fetchRemote(inputs.template, remote);
  createBranch(workingBranch, workingBranch);

  // Get the latest commit of the template repository
  const latestCommit = getLatestCommit();

  // Get changed files from the last synchronized commit to HEAD
  let changedFiles, deletedFiles;
  if (lastSyncCommit) {
    const filesWithStatus = listDiffFilesWithStatus(lastSyncCommit);
    changedFiles = filesWithStatus.filter((f) => f.status !== "D").map((f) => f.name);
    deletedFiles = filesWithStatus.filter((f) => f.status === "D").map((f) => f.name);
    logJson(`${changedFiles.length} files changed`, changedFiles);
    logJson(`${deletedFiles.length} files deleted`, deletedFiles);
  } else {
    changedFiles = listFiles();
    deletedFiles = [];
    logJson(`${changedFiles.length} files changed`, changedFiles);
  }

  // Replace/Rename if needed
  if (inputs.rename) {
    replaceFiles(changedFiles, inputs.fromName, inputs.toName);
    changedFiles = renameFiles(changedFiles, inputs.fromName, inputs.toName);
    deletedFiles = renameFiles(deletedFiles, inputs.fromName, inputs.toName);
    logJson(`replace/renamed ${changedFiles.length + deletedFiles.length} files`, changedFiles.concat(deletedFiles));
    commit(changedFiles, "renamed");
    reset();
  }

  // Checkout PR branch
  createBranch(inputs.prBranch, inputs.prBase);

  // Exclude files to be ignored
  let changeIgnored, deleteIgnored;
  [changedFiles, changeIgnored] = ignoreFiles(changedFiles, inputs.ignorePaths);
  [deletedFiles, deleteIgnored] = ignoreFiles(deletedFiles, inputs.ignorePaths);
  logJson(`ignored ${changeIgnored.length + deleteIgnored.length} files`, changeIgnored.concat(deleteIgnored));

  // Merge
  logJson(`merging ${changedFiles.length} files`, changedFiles);
  merge(workingBranch);
  commit(changedFiles, "changed files");
  reset();

  // Delete files which has been deleted in the template repository
  logJson(`deleting ${deletedFiles.length} files`, deletedFiles);
  deletedFiles.forEach((f) => fs.rmSync(f));
  commit(deletedFiles, "deleted files");
  reset();

  // Update templatesync file
  fs.writeFileSync(inputs.templateSyncFile, latestCommit, "utf8");
  commit([inputs.templateSyncFile], "updated template sync file");
  reset();

  if (inputs.dryRun) {
    core.info("Skip creating PR because dry-run is true");
    return;
  }

  // Push
  push();

  // Create PR if there is any commit
  if (getDiffCommits(inputs.prBase, inputs.prBranch).length > 0) {
    await createOrUpdatePr(inputs);
  }
}

function getLastTemplateSyncCommit(syncCommitFile) {
  if (fs.existsSync(syncCommitFile)) {
    return fs.readFileSync(syncCommitFile, "utf8").trim();
  } else {
    return null;
  }
}

function replaceFiles(files, fromName, toName) {
  const conversions = createConversions(fromName, toName);
  const existingFiles = files.filter((f) => fs.existsSync(f));

  // Replace file contents
  for (const f of existingFiles) {
    const s = fs.readFileSync(f, "utf8");
    const converted = convert(conversions, s);
    if (s !== converted) {
      fs.writeFileSync(f, converted, "utf8");
    }
  }
}

function renameFiles(files, fromName, toName) {
  const conversions = createConversions(fromName, toName);

  // Get directories where the files are located
  const filesAndDirs = getDirsFromFiles(files);
  const existingFilesAndDirs = filesAndDirs.filter((f) => fs.existsSync(f));

  // Rename files and directories
  const cwd = process.cwd();
  for (const f of existingFilesAndDirs) {
    const fromBase = path.basename(f);
    const fromDir = path.dirname(f);
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

function ignoreFiles(files, ignorePaths) {
  if (ignorePaths.length) {
    return [micromatch.not(files, ignorePaths), micromatch(files, ignorePaths)];
  } else {
    return [files, []];
  }
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
  let prNum;
  if (prs.length) {
    prNum = prs[0].number;
    core.info(`updating existing PR #${prNum}`);
    await updatePr(prNum, inputs.prTitle, inputs.prBranch, inputs.prBase);
  } else {
    core.info("creating PR");
    const res = await createPr(inputs.prTitle, inputs.prBranch, inputs.prBase);
    prNum = res.number;
  }
  await addLabels(prNum, inputs.prLabels);
}

module.exports = {
  main,
};
