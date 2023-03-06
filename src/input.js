const core = require("@actions/core");
const { getOctokit } = require("@actions/github");
const { context } = require("@actions/github");

const getInputs = async () => {
  let fromName = core.getInput("from-name");
  let toName = core.getInput("to-name");
  const ignorePaths = core
      .getInput("ignore-paths")
      .split("\n")
      .filter((f) => f);
  const commitMessage = core.getInput("commit-message");
  const dryRun = core.getInput("dry-run") === "true";
  const prBranchPrefix = core.getInput("pr-branch-prefix")

  let githubToken = core.getInput("github-token");
  const defaultGithubToken = core.getInput("default-github-token");

  githubToken = githubToken || process.env.GITHUB_TOKEN || defaultGithubToken;
  if (!githubToken) {
    throw new Error("No GitHub token provided");
  }

  const octokit = getOctokit(githubToken);
  const res = await octokit.rest.repos.get({
    owner: context.repo.owner,
    repo: context.repo.repo,
  });
  const templateRepo = res.data.template_repository.full_name;

  if (!(fromName && toName)) {
    if (!fromName) {
      fromName = res.data.template_repository.name;
      console.info(`Using '${fromName}' as from-name`);
    }
    if (!toName) {
      toName = res.data.name;
      console.info(`Using '${toName}' as to-name`);
    }
  }

  const ret = {
    templateRepo,
    fromName,
    toName,
    prBranchPrefix,
    githubToken,
    commitMessage,
    ignorePaths,
    dryRun,
  };
  console.info(ret);
  return ret;
};

module.exports = {
  getInputs,
};
