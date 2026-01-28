# Publishing (npm)

This project uses [Changesets](https://github.com/changesets/changesets) for version
management and tag-based releases with provenance attestation to npm.

For daily development workflow, see [development.md](../../development.md).
For release notes format and guidelines, see
[release-notes-guidelines.md](../agent-guidelines/release-notes-guidelines.md).

## One-Time Setup

Before the first release, complete these steps:

### 1. Manual First Publish

The package must exist on npm before automated releases can work.

**IMPORTANT**: Create the git tag FIRST, then build.
The version is baked in at build time from git tags.
If you build before tagging, you’ll get a `-dev.N.hash` version suffix.

```bash
cd packages/tbd

# 1. Create and push the tag FIRST (so build sees the correct version)
git tag v0.1.0
git push --tags

# 2. Build (now getGitVersion() will return "0.1.0" not "0.1.0-dev.N.hash")
pnpm build

# 3. Publish
npm publish --access public
```

This will prompt for web-based authentication in your browser.

### 2. Configure NPM_TOKEN Secret

1. Generate an npm access token at https://www.npmjs.com/settings/~/tokens
   - Select “Automation” type for CI/CD use
2. Add the token as a repository secret:
   - Go to https://github.com/jlevy/tbd/settings/secrets/actions
   - Add secret named `NPM_TOKEN` with the token value

### 3. Verify Repository Setup

- Repository must be public for provenance attestation
- Ensure the release workflow at `.github/workflows/release.yml` has `id-token: write`
  permission

## During Development

Merge PRs to `main` without creating changesets.
Changesets are created only at release time.

## Release Workflow

Follow these steps to publish a new version.

### Step 1: Prepare

```bash
git checkout main
git pull
git status  # Must be clean
```

### Step 2: Determine Version

Review changes since last release:

```bash
git log $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~20")..HEAD --oneline
```

Choose version bump:

- `patch` (0.1.0 → 0.1.1): Bug fixes, docs, internal changes
- `minor` (0.1.0 → 0.2.0): New features, non-breaking changes
- `major` (0.1.0 → 1.0.0): Breaking changes

### Step 3: Create Changeset

Run the interactive changeset command:

```bash
pnpm changeset
```

This prompts for package selection, bump type (patch/minor/major), and a summary.

Commit:

```bash
git add .changeset
git commit -m "chore: add changeset for vX.X.X"
```

### Step 4: Version Packages

Run changesets to bump version and update CHANGELOG:

```bash
pnpm changeset version
```

Review and commit:

```bash
git diff  # Verify package.json and CHANGELOG.md
git add .
git commit -m "chore: release get-tbd vX.X.X"
```

### Step 5: Write Release Notes

**Before pushing**, write release notes following
[release-notes-guidelines.md](../agent-guidelines/release-notes-guidelines.md).

```bash
# Review changes since last release
git log $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~20")..HEAD --oneline

# Write release notes to release-notes.md or prepare for PR body
```

### Step 6: Push and Tag

**Option A: Direct git push (local development)**

```bash
git push
git tag vX.X.X
git push --tags
```

**Option B: Via PR and GitHub API (restricted environments)**

When direct push to main is restricted:

```bash
# Push to feature branch
git push -u origin <branch-name>

# Create and merge PR (use release notes in body)
gh pr create -R jlevy/tbd --base main --head <branch-name> \
  --title "chore: release get-tbd vX.X.X" \
  --body-file release-notes.md
gh pr merge <pr-number> -R jlevy/tbd --merge

# Get merge commit SHA and create tag
MERGE_SHA=$(gh pr view <pr-number> -R jlevy/tbd --json mergeCommit -q '.mergeCommit.oid')
gh api repos/jlevy/tbd/git/refs -X POST \
  -f ref="refs/tags/vX.X.X" \
  -f sha="$MERGE_SHA"
```

### Step 7: Update GitHub Release

After the release workflow completes:

```bash
# Wait for release workflow
gh run list -R jlevy/tbd --limit 3

# Update release notes
gh release edit vX.X.X -R jlevy/tbd --notes-file release-notes.md
```

### Step 8: Verify

```bash
gh release view vX.X.X -R jlevy/tbd
npm view get-tbd
```

## Quick Reference

### Local Development (direct push)

```bash
git checkout main && git pull
pnpm changeset  # Interactive: select package, bump type, summary
git add .changeset && git commit -m "chore: add changeset for v0.2.0"
pnpm changeset version
git add . && git commit -m "chore: release get-tbd v0.2.0"

# Write release notes (see release-notes-guidelines.md)
git push && git tag v0.2.0 && git push --tags

# Update GitHub release after workflow completes
gh release edit v0.2.0 -R jlevy/tbd --notes-file release-notes.md
```

### Restricted Environments (via PR and API)

```bash
pnpm changeset  # Interactive: select package, bump type, summary
git add .changeset && git commit -m "chore: add changeset for v0.2.0"
pnpm changeset version
git add . && git commit -m "chore: release get-tbd v0.2.0"

# Write release notes, push to branch
git push -u origin <branch-name>

# Create PR, merge, tag via API
gh pr create -R jlevy/tbd --base main --head <branch-name> \
  --title "chore: release get-tbd v0.2.0" --body-file release-notes.md
gh pr merge <pr-number> -R jlevy/tbd --merge
MERGE_SHA=$(gh pr view <pr-number> -R jlevy/tbd --json mergeCommit -q '.mergeCommit.oid')
gh api repos/jlevy/tbd/git/refs -X POST -f ref="refs/tags/v0.2.0" -f sha="$MERGE_SHA"

# Update GitHub release after workflow completes
gh release edit v0.2.0 -R jlevy/tbd --notes-file release-notes.md
```

## How Publishing Works

This project uses npm token-based publishing with provenance:

- **NPM_TOKEN secret**: Repository secret containing npm automation token
- **Provenance attestation**: `NPM_CONFIG_PROVENANCE=true` adds signed build provenance

The release workflow (`.github/workflows/release.yml`) triggers on `v*` tags and
publishes automatically.

## GitHub Releases

The release workflow automatically creates a GitHub Release when a tag is pushed:

- **Release name**: Matches the tag (e.g., `v0.2.0`)
- **Release notes**: Initially extracted from CHANGELOG; update with formatted notes
- **Pre-release flag**: Automatically set for versions containing `-` (e.g.,
  `1.0.0-beta.1`)

After pushing a tag:

1. Verify the release appears at: https://github.com/jlevy/tbd/releases
2. Update the release with formatted notes (Step 7 above)

## Troubleshooting

**Release workflow not running?**

- Ensure tag format is `v*` (e.g., `v0.2.0`)
- Check tag was pushed: `git ls-remote --tags origin`

**npm publish failing with 401/403?**

- Verify `NPM_TOKEN` secret is configured in repository settings
- Check the token hasn’t expired
- Ensure token has publish permissions for `get-tbd`

**First publish?**

- The package must already exist on npm before the workflow can publish
- Do a manual `npm publish --access public` first from `packages/tbd` directory
