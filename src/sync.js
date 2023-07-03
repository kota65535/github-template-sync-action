const fs = require("fs");
const path = require("path");
const core = require("@actions/core");
const micromatch = require("micromatch");
const { convert, createConversions } = require("./convert");
const {
  commit,
  createBranch,
  fetchRemote,
  getDiffCommits,
  getLatestCommit,
  listDiffFilesWithStatus,
  merge,
  push,
  reset,
  getLatestCommitBefore,
} = require("./git");
const { addLabels, createPr, listPrs, updatePr } = require("./github");
const { ensurePrefix, logJson } = require("./util");

async function sync(inputs) {
  // Get the last sync commit of the template repository
  let lastSyncCommit = getLastTemplateSyncCommit(inputs.templateSyncFile);
  if (lastSyncCommit) {
    core.info(`last sync: ${lastSyncCommit}`);
  }

  // Checkout template repository branch
  const remote = "template";
  const workingBranch = `${remote}/${inputs.templateBranch}`;
  fetchRemote(inputs.template, remote);
  createBranch(workingBranch, workingBranch);

  // If this is the first sync, get the commit of the template repository from which this repository is created
  if (!lastSyncCommit) {
    lastSyncCommit = getLatestCommitBefore(inputs.createdAt);
    core.info(`first sync: ${lastSyncCommit}`);
  }

  // Get the latest commit of the template repository
  const latestCommit = getLatestCommit();

  // Get changed files from the last synchronized commit to HEAD
  let changedFiles, deletedFiles;
  const filesWithStatus = listDiffFilesWithStatus(lastSyncCommit);
  changedFiles = filesWithStatus.filter((f) => f.status !== "D").map((f) => f.name);
  deletedFiles = filesWithStatus.filter((f) => f.status === "D").map((f) => f.name);
  logJson(`${changedFiles.length} files changed`, changedFiles);
  logJson(`${deletedFiles.length} files deleted`, deletedFiles);

  // Replace/Rename if needed
  if (inputs.rename) {
    const conversions = createConversions(inputs.fromName, inputs.toName);
    logJson("conversions", conversions);

    replaceFiles(changedFiles, conversions);
    changedFiles = renameFiles(changedFiles, conversions);
    deletedFiles = renameFiles(deletedFiles, conversions);
    logJson(
      `replaced & renamed ${changedFiles.length + deletedFiles.length} files`,
      changedFiles.concat(deletedFiles)
    );
    commit(changedFiles, "renamed");
    reset();
  }

  const prBaseWithRemote = ensurePrefix("origin/", inputs.prBase);

  // Checkout PR branch
  createBranch(inputs.prBranch, prBaseWithRemote);

  // Exclude files to be ignored
  let changeIgnored, deleteIgnored;
  [changedFiles, changeIgnored] = ignoreFiles(changedFiles, inputs.ignorePaths);
  [deletedFiles, deleteIgnored] = ignoreFiles(deletedFiles, inputs.ignorePaths);
  logJson(`ignored ${changeIgnored.length + deleteIgnored.length} files`, changeIgnored.concat(deleteIgnored));

  // Merge
  logJson(`merging ${changedFiles.length} files`, changedFiles);
  merge(workingBranch);
  commit(changedFiles, "changed files");

  // Delete files which has been deleted in the template repository
  deletedFiles = deletedFiles.filter((f) => fs.existsSync(f));
  deletedFiles.forEach((f) => fs.rmSync(f));
  logJson(`deleted ${deletedFiles.length} files`, deletedFiles);
  commit(deletedFiles, "deleted files");

  // Update templatesync file
  fs.writeFileSync(inputs.templateSyncFile, latestCommit, "utf8");
  commit([inputs.templateSyncFile], "updated template sync file");

  if (inputs.dryRun) {
    core.info("Skip creating PR because dry-run is true");
    return;
  }

  // Push
  push();

  // Create PR if there is any commit
  if (getDiffCommits(prBaseWithRemote, inputs.prBranch).length > 0) {
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

function replaceFiles(files, conversions) {
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

function renameFiles(files, conversions) {
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
  if (inputs.prLabels.length > 0) {
    await addLabels(prNum, inputs.prLabels);
  }
}

module.exports = {
  sync,
  renameFiles,
  replaceFiles,
  ignoreFiles,
};
