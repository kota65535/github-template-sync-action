const path = require("path");
const fs = require("fs");
const core = require("@actions/core");
const micromatch = require("micromatch");
const { createConversions, convert } = require("./convert");
const {
  getGitCredentials,
  setGitCredentials,
  listFiles,
  listDiffFiles,
  merge,
  commit,
  push,
  fetchRemote,
  createBranch,
  getLatestCommit,
  reset,
} = require("./git");
const { getInputs } = require("./input");
const { createPr, listPrs, updatePr } = require("./github");
const { toJson } = require("./util");

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

  // Checkout template repository branch
  const remote = "template";
  const workingBranch = `${remote}/${inputs.templateBranch}`;
  fetchRemote(inputs.templateRepo.owner, inputs.templateRepo.name, remote);
  createBranch(workingBranch, workingBranch);

  // Get the latest commit of the template repository
  const latestCommit = getLatestCommit();

  // Get changed files from the last synchronized commit to HEAD
  let files;
  if (lastSyncCommit) {
    files = listDiffFiles(lastSyncCommit);
    core.info(`${files.length} changed files from the last sync ${lastSyncCommit}: ${toJson(files)}`);
  } else {
    files = listFiles();
    core.info(`${files.length} changed files: ${toJson(files)}`);
  }

  // Replace/Rename if needed
  if (inputs.rename) {
    files = rename(files, inputs.fromName, inputs.toName);
    commit(files, "renamed");
    reset();
  }

  // Checkout PR branch
  createBranch(inputs.prBranch, inputs.prBase);

  // Exclude files to be ignored
  files = ignoreFiles(files, inputs.ignorePaths);
  core.info(`merging ${files.length} files: ${toJson(files)}`);

  // Merge
  merge(workingBranch);
  commit(files, "merged template");
  reset();

  // Update templatesync file
  fs.writeFileSync(inputs.templateSyncFile, latestCommit, "utf8");
  commit([inputs.templateSyncFile], "updated template sync file");
  reset();

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

function getLastTemplateSyncCommit(syncCommitFile) {
  if (fs.existsSync(syncCommitFile)) {
    return fs.readFileSync(syncCommitFile, "utf8").trim();
  } else {
    return null;
  }
}

function rename(files, fromName, toName) {
  core.info(`replacing ${files.length} files: ${toJson(files)}`);

  const conversions = createConversions(fromName, toName);

  // Replace file contents
  for (const t of files) {
    let s = fs.readFileSync(t, "utf8");
    s = convert(conversions, s);
    fs.writeFileSync(t, s, "utf8");
  }

  // Get directories where the files are located
  const filesAndDirs = getDirsFromFiles(files);
  core.info(`renaming ${filesAndDirs.length} files and directories: ${toJson(filesAndDirs)}`);

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
