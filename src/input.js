const core = require("@actions/core");
const { initOctokit, getRepo } = require("./github");

const getInputs = async () => {
  let fromName = core.getInput("from-name");
  let toName = core.getInput("to-name");
  const ignorePaths = core
    .getInput("ignore-paths")
    .split("\n")
    .filter((f) => f);
  let githubToken = core.getInput("github-token");
  const defaultGithubToken = core.getInput("default-github-token");
  const prHead = core.getInput("pr-head");
  let prBase = core.getInput("pr-base");
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
  const templateRepo = repo.template_repository.full_name;

  if (!fromName) {
    fromName = repo.template_repository.name;
  }
  if (!toName) {
    toName = repo.name;
  }
  if (!prBase) {
    prBase = repo.default_branch;
  }

  const ret = {
    fromName,
    toName,
    ignorePaths,
    githubToken,
    prHead,
    prBase,
    prTitle,
    prLabels,
    templateSyncFile,
    dryRun,
    templateRepo,
  };
  core.info(JSON.stringify(ret));
  return ret;
};

module.exports = {
  getInputs,
};
