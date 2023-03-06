const path = require("path");
const fs = require("fs");
const core = require("@actions/core");
const micromatch = require("micromatch");
const { createConversions, convert } = require("./util");
const {
  getGitCredentials,
  setGitCredentials,
  listFiles,
  checkoutTemplate,
  merge,
  commit,
  restore,
  push,
  listDiffFiles,
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
    setGitCredentials(creds);
  }
  core.setOutput("pr-head", inputs.prHead);
}

async function sync(inputs) {
  const files = renameTemplate(inputs);
  core.info(`changed files: ${files.length}`);
  mergeTemplate(inputs, files);
  commit();
  push();
  await createOrUpdatePr(inputs);
}

function renameTemplate(inputs) {
  checkoutTemplate(inputs.templateRepo);
  rename(inputs.fromName, inputs.toName);
  return getTemplateChangedFiles(inputs.templateSyncFile);
}

function mergeTemplate(inputs, files) {
  merge(inputs.prHead);
  if (inputs.ignorePaths.length) {
    const ignoredFiles = micromatch(files, inputs.ignorePaths);
    core.info(`${ignoredFiles.length} files to ignore`);
    for (const f of ignoredFiles) {
      restore(f);
    }
  }
}

function getTemplateChangedFiles(inputs) {
  let files;
  if (fs.existsSync(inputs.templateSyncFile)) {
    const lastSyncCommit = fs.readFileSync(inputs.templateSyncFile, "utf8");
    files = listDiffFiles(lastSyncCommit);
  } else {
    files = listFiles();
  }
  const conversions = createConversions(inputs);
  return files.map((f) => convert(conversions, f));
}

function rename(fromName, toName) {
  const files = listFiles();
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

  commit("renamed");
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
  const prs = await listPrs(inputs.prHead, inputs.prBase);
  if (prs.length) {
    const prNum = prs[0].number;
    core.info(`updating existing PR #${prNum}`);
    await updatePr(prNum, inputs.prTitle, inputs.prHead, inputs.prBase);
  } else {
    core.info("creating PR");
    await createPr(inputs.prTitle, inputs.prHead, inputs.prBase);
  }
}

module.exports = {
  main,
};
