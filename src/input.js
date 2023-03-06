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
  const prBranch = core.getInput("pr-branch");
  const prTitle = core.getInput("pr-title");
  const prLabels = core
    .getInput("pr-labels")
    .split("\n")
    .filter((f) => f);
  const dryRun = core.getInput("dry-run") === "true";

  githubToken = githubToken || process.env.GITHUB_TOKEN || defaultGithubToken;
  if (!githubToken) {
    throw new Error("No GitHub token provided");
  }

  initOctokit(githubToken);

  const repo = await getRepo();
  if (!repo.template_repository) {
    throw new Error("Could not get template repository.");
  }
  const templateRepo = repo.template_repository.full_name;

  if (!(fromName && toName)) {
    if (!fromName) {
      fromName = repo.template_repository.name;
      console.info(`Using '${fromName}' as from-name`);
    }
    if (!toName) {
      toName = repo.name;
      console.info(`Using '${toName}' as to-name`);
    }
  }

  const ret = {
    templateRepo,
    fromName,
    toName,
    prBranch,
    prTitle,
    prLabels,
    githubToken,
    ignorePaths,
    dryRun,
  };
  console.info(ret);
  return ret;
};

module.exports = {
  getInputs,
};
