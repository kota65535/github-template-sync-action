const core = require("@actions/core");
const { initOctokit, getRepo } = require("./github");
const { logJson } = require("./util");

const getInputs = async () => {
  let template = core.getInput("template");
  let templateBranch = core.getInput("template-branch");
  const rename = core.getInput("rename") === "true";
  let fromName = core.getInput("from-name");
  let toName = core.getInput("to-name");
  const ignorePaths = core
    .getInput("ignore-paths")
    .split("\n")
    .filter((f) => f);
  let githubToken = core.getInput("github-token");
  const defaultGithubToken = core.getInput("default-github-token");
  const prBranch = core.getInput("pr-branch");
  let prBase = core.getInput("pr-base-branch");
  const prTitle = core.getInput("pr-title");
  const prLabels = core
    .getInput("pr-labels")
    .split("\n")
    .filter((f) => f);
  const templateSyncFile = core.getInput("template-sync-file");
  const dryRun = core.getInput("dry-run") === "true";

  githubToken = githubToken || process.env.GITHUB_TOKEN || defaultGithubToken;
  if (!githubToken) {
    throw new Error("No GitHub token provided");
  }

  initOctokit(githubToken);

  const repo = await getRepo();

  if (!template) {
    if (!repo.template_repository) {
      throw new Error("Could not get the template repository");
    }
    template = repo.template_repository.full_name;
  }
  if (!templateBranch) {
    const [owner, repo] = template.split("/");
    const templateRepo = await getRepo(owner, repo);
    templateBranch = templateRepo.default_branch;
  }
  if (!fromName) {
    const [owner, repo] = template.split("/");
    const templateRepo = await getRepo(owner, repo);
    fromName = templateRepo.name;
  }
  if (!toName) {
    toName = repo.name;
  }
  if (!prBase) {
    prBase = repo.default_branch;
  }

  const ret = {
    template,
    templateBranch,
    rename,
    fromName,
    toName,
    ignorePaths,
    githubToken,
    prBranch,
    prBase,
    prTitle,
    prLabels,
    templateSyncFile,
    dryRun,
  };
  logJson("inputs", ret);
  return ret;
};

module.exports = {
  getInputs,
};
