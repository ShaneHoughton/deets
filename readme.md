# deets
This is a github action for generating simple changelogs for your repository based on merged PRs.
## What this does
The Deets action pulls a list of your repository's merged PRs and extracts details from the descriptions.
After iterating the PRs for pertinent information, it writes all that information to a markdown file that is created in the root of the repo the workflow was run from.

Format of the returned markdown changelog:
```md
## added
#### [Pr title](link-to-pr)
- detail about change
  - any other information

## changed
...

## fixed
...
```

## How to get the deets from your merged pull requests...
Deets can capture what has been `added`, `changed`, and `fixed` when your PR descriptions contain tags to document updates:
```html
<added>Added new feature.</added>
<changed>Changed process for completing thing.</changed>
<fixed>Fixed an ongoing issue.</fixed>
```

### Example Usage

To make it easier for developers to copy and use these tags, you can include the following example in your `PULL_REQUEST_TEMPLATE.md`

```html
<!-- Add details about the changes in your PR using the tags below -->

<added>Describe what was added in this PR.</added>
<changed>Describe what was changed in this PR.</changed>
<fixed>Describe what was fixed in this PR.</fixed>
```
## Inputs
```yaml
  id: deets
  uses: ShaneHoughton/deets@v0
  with:
    github-token:
    # Your github token from ${{ secrets.GITHUB_TOKEN }}
    # This is used to make an api call to get the previously merged PRs of your repo.

    days-back:
    # The number of days from today to look back at.
    # This action will iterate through all merged PRs from then until now.

    date-range:
    # A date range for merged PRs in this format (MM/DD/YYYY-MM/DD/YYYY)
    # If this is supplied, days-back will be ignored.

    timezone:
    # A specified timezone.

    md-output-name:
    # The desired name for the returned markdown file,
```
## Outputs
| Name | Description | example |
| -- | -- | -- |
| filePath | The name of the markdown file generated from the action. | DEETS.md | 
## Getting the markdown file:
To make getting this markdown file easier, you can append the [upload-artifact](https://github.com/actions/upload-artifact) action which allows you do upload the file as an artifact on your repo and make it available for download.
```yaml
  uses: actions/upload-artifact@v4
  with:
    name: my-output-file
    path: ${{ steps.deets.outputs.filePath }}
```