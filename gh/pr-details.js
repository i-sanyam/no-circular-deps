import * as github from '@actions/github';
import * as core from '@actions/core';

async function run() {
  // This should be a token with access to your repository scoped in as a secret.
  // The YML workflow will need to set myToken with the GitHub Secret Token
  // myToken: ${{ secrets.GITHUB_TOKEN }}
  // https://help.github.com/en/actions/automating-your-workflow-with-github-actions/authenticating-with-the-github_token#about-the-github_token-secret

  const githubtoken = process.env.GHT;
  const octokit = github.getOctokit(githubtoken);

  // You can also pass in additional options as a second parameter to getOctokit
  // const octokit = github.getOctokit(myToken, {userAgent: "MyActionVersion1"});

  const { data: pullRequest } = await octokit.rest.pulls.get({
    owner: 'i-sanyam',
    repo: 'no-circular-deps',
    pull_number: 4,
  });

  core.notice(pullRequest);
}

run();
