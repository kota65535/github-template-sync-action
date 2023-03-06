const core = require("@actions/core");
const { initOctokit, getRepo } = require("./github");

const getInputs = async () => {
  const rename = core.getInput("rename") === "true";
  let fromName = core.getInput("from-name");
  let toName = core.getInput("to-name");
  const ignorePaths = core
    .getInput("ignore-paths")
    .split("\n")
    .filter((f) => f);
  let githubToken = core.getInput("github-token");
  const defaultGithubToken = core.getInput("default-github-token");
  let templateBranch = core.getInput("template-branch");
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
  if (!repo.template_repository) {
    throw new Error("Could not get the template repository.");
  }
  if (!fromName) {
    fromName = repo.template_repository.name;
  }
  if (!toName) {
    toName = repo.name;
  }
  if (!prBase) {
    prBase = repo.default_branch;
  }

  const templateRepo = await getRepo(repo.template_repository.owner.login, repo.template_repository.name);
  if (!templateBranch) {
    templateBranch = templateRepo.default_branch;
  }

  const ret = {
    rename,
    fromName,
    toName,
    ignorePaths,
    githubToken,
    templateBranch,
    prBranch,
    prBase,
    prTitle,
    prLabels,
    templateSyncFile,
    dryRun,
    templateRepo: {
      owner: templateRepo.owner.login,
      name: templateRepo.name,
    },
  };
  core.info(ret);
  return ret;
};

module.exports = {
  getInputs,
};
