# Changesets

This folder stores changesets - descriptions of package changes.

## Creating a changeset

Run `pnpm changeset` to create a new changeset.

## How it works

1. When you make changes, run `pnpm changeset` and describe what changed
2. Commit the changeset file with your PR
3. When merged to main, the release workflow creates a "Version Packages" PR
4. Merging that PR publishes to npm and creates GitHub releases

## More info

- [Changesets documentation](https://github.com/changesets/changesets)
- [Using Changesets with pnpm](https://pnpm.io/using-changesets)
