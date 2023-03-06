const path = require("path");
const fs = require("fs");
const core = require("@actions/core");
const micromatch = require("micromatch");
const { toJoined, toSnake, toCamel, toPascal } = require("./util");
const {
  getGitCredentials,
  setGitCredentials,
  listFiles,
  checkoutTemplate,
  merge,
  commit,
  restore,
  push,
} = require("./git");
const { getInputs } = require("./input");
const { createPr } = require("./github");

async function main() {
  const inputs = await getInputs();
  const creds = getGitCredentials();
  setGitCredentials(inputs.githubToken);
  try {
    await sync(inputs)
  } finally {
    setGitCredentials(creds);
  }
}

async function sync(inputs) {
  checkoutTemplate(inputs.templateRepo);
  renameTemplate(inputs);
  mergeTemplate(inputs);
  commit();
  push();
  await createPr(inputs.prTitle);
}

function mergeTemplate(inputs) {
  merge(inputs.prBranch);
  const trackedFiles = listFiles();
  if (inputs.ignorePaths.length) {
    const ignoredFiles = micromatch(trackedFiles, inputs.ignorePaths);
    for (const f of ignoredFiles) {
      restore(f);
    }
  }
}

function renameTemplate(inputs) {
  let files = listFiles();
  if (inputs.ignorePaths.length) {
    files = micromatch.not(files, inputs.ignorePaths);
  }
  core.info(`${files.length} files`);

  const conversions = getConversions(inputs);

  // Replace file contents
  for (const t of files) {
    let s = fs.readFileSync(t, "utf-8");
    s = convert(conversions, s);
    fs.writeFileSync(t, s, "utf-8");
  }

  // Get directories where the files are located
  const filesAndDirs = getDirsFromFiles(files);
  core.info(`${filesAndDirs.length} files and directories`);

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

function getConversions(inputs) {
  return [
    {
      from: inputs.fromName,
      to: inputs.toName,
    },
    {
      from: toJoined(inputs.fromName),
      to: toJoined(inputs.toName),
    },
    {
      from: toSnake(inputs.fromName),
      to: toSnake(inputs.toName),
    },
    {
      from: toCamel(inputs.fromName),
      to: toCamel(inputs.toName),
    },
    {
      from: toPascal(inputs.fromName),
      to: toPascal(inputs.toName),
    },
  ];
}

function convert(conversions, str) {
  conversions.forEach((c) => (str = str.replaceAll(c.from, c.to)));
  return str;
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

module.exports = {
  main,
  rename: renameTemplate,
};
