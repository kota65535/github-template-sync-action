const { getOctokit } = require("@actions/github");
const { context } = require("@actions/github");

let octokit;

const initOctokit = (token) => {
  octokit = getOctokit(token);
};

const getRepo = async () => {
  const res = await octokit.rest.repos.get({
    owner: context.repo.owner,
    repo: context.repo.repo,
  });
  return res.data;
};

const createPr = async (title) => {
  return await octokit.rest.pulls.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    title: title,
  });
};

module.exports = {
  initOctokit,
  getRepo,
  createPr,
};
