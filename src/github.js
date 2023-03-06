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

const createPr = async (title, head, base) => {
  return await octokit.rest.pulls.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    title,
    head,
    base,
  });
};

const updatePr = async (prNum, title, head, base) => {
  return await octokit.rest.pulls.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: prNum,
    title,
    head,
    base,
  });
};

const listPrs = async (head, base) => {
  const res = await octokit.rest.pulls.list({
    owner: context.repo.owner,
    repo: context.repo.repo,
    head,
    base,
  });
  return res.data;
};

module.exports = {
  initOctokit,
  getRepo,
  createPr,
  updatePr,
  listPrs,
};
