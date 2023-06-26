# github-template-sync-action

GitHub Action for syncing the upstream template repository change.

[Template repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template)
is a convenient way to create a new repository with the same directory structure and files as an existing repository.
Since a new repository created from a template repository does not inherit the commit history, it cannot simply merge the 
template repository changes. This action handles it for you.

## Features

Creates PR that includes the following changes.

- Merges the upstream template repository changes
- Replaces & Renames files and directories of the template repository before merge
  - This does the same as [github-template-rename-action](https://github.com/kota65535/github-template-rename-action)
- Minimizes diff by remembering the last synced commit

## Inputs

| Name                 | Description                                                                                    | Required | Default                                                 |
|----------------------|------------------------------------------------------------------------------------------------|----------|---------------------------------------------------------|
| `template`           | Template repository name with <owner/name> format                                              | No       | Name of the template repository                         |
| `template-branch`    | Template repository branch to sync                                                             | No       | Default branch of the template repository               |
| `template-sync-file` | Path of template sync file that saves the last synced commit                                   | No       | `.templatesync`                                         |
| `rename`             | Rename template repository before sync or not.                                                 | No       | `false`                                                 |
| `from-name`          | Project name to be replaced. Should be kebab, snake, camel or pascal case.                     | No       | Name of the template repository                         |
| `to-name`            | New project name to replace with. Should be kebab, snake, camel or pascal case.                | No       | Name of your repository                                 |
| `paths-ignore`       | Paths to ignore. Accepts [micromatch](https://github.com/micromatch/micromatch) glob patterns. | No       | N/A                                                     |
| `github-token`       | GitHub token                                                                                   | No       | `${{ env.GITHUB_TOKEN }}` or<br/> `${{ github.token }}` | 
| `pr-branch`          | PR branch name                                                                                 | No       | `template-sync`                                         |
| `pr-base-branch`     | PR base branch name                                                                            | No       | Default branch of your repository                       |
| `pr-title`           | PR title                                                                                       | No       | `Template sync`                                         |
| `pr-labels`          | PR labels to add                                                                               | No       | N/A                                                     |
| `dry-run`            | Dry-run or not. If true, it does not create PR.                                                | No       | `false`                                                 |

## Usage

```yaml

  # You need to use GitHub personal access token to access the template repository
  - uses: kota65535/github-template-sync-action@v1
    with:
      github-token: ${{ secrets.PAT }}
  
  # If rename is true, it does the same thing as github-template-rename-action.
  # - Replaces project name identifiers in all files with various naming conventions
  #   - Concatenated (ex. `foobarbaz`)
  #   - Kebab case (ex. `foo-bar-baz`)
  #   - Snake case (ex. `foo_bar_baz`)
  #   - Camel case (ex. `fooBarBaz`)
  #   - Pascal case (ex. `FooBarBaz`)
  # - Renames all files and directories in the same manner.
  - uses: kota65535/github-template-sync-action@v1
    with: 
      rename: true
      from-name: the-sample
      to-name: my-project
      github-token: ${{ secrets.PAT }}
  
```
