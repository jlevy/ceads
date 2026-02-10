## What’s Changed

### Fixes

- **YAML duplicate key handling after merge conflicts**: `ids.yml` files that end up
  with duplicate keys after git merge conflict resolution (e.g., both sides of a merge
  keeping the same entries) no longer crash with “Map keys must be unique”.
  tbd now detects duplicate keys, warns about them, and auto-resolves on the next save.
  `tbd doctor` reports duplicate keys and `tbd doctor --fix` cleans them up.

- **Sync debug log showed wrong branch commits**: `tbd sync --debug` was resolving
  `HEAD` against the user’s working branch instead of the `tbd-sync` branch, causing the
  “Commits sent” and “Commits received” debug output to show commits from the wrong
  branch. Now uses explicit branch references.

- **Beads import priority mapping**: `tbd import --beads` now correctly handles priority
  values in all formats (numeric `0`-`4`, string `"P0"`-`"P4"`, or missing) instead of
  only accepting integers.
  Previously, string-format priorities from Beads would silently default to P2.

- **EPIPE handling when quitting pager**: Pressing `q` in the pager (e.g., `less`) while
  viewing long output no longer prints unhandled EPIPE errors.
  Both stdout and stderr EPIPE signals are now caught gracefully.

- **Improved error messages and cause chains**: Error messages from `tbd save` and
  `tbd import` now include the underlying cause (e.g., the actual filesystem or git
  error) instead of a generic wrapper message.
  Debug mode (`--debug`) shows the full cause chain for easier troubleshooting.

### Improvements

- **Workspace save/import progress logging**: `tbd save` and `tbd import --workspace`
  now show progress via spinner updates during long operations, with detailed logging
  available via `--verbose` and `--debug` flags.
  New `OperationLogger` interface enables core logic to report progress without
  depending on the CLI output layer.

- **Test stability**: Fixed flaky `setup-hooks` tests with a `globalSetup` build step
  and increased timeouts.
  Fixed non-deterministic `cli-id-format` test.
  Removed fragile `node -e` JSON-parsing pattern from all 18 tryscript golden tests in
  favor of direct CLI assertions.
  Added explicit timeouts to test files that spawn subprocesses.
  Added new golden tests for sync debug output, verbose logging, and duplicate key
  detection.

### Documentation

- **External docs repos spec**: Finalized the design for prefix-based external
  documentation repositories and skills.sh integration.

- **Skill file restructuring**: Renamed `skill.md` to `skill-baseline.md` and added
  `skill-minimal.md` for lighter-weight agent skill integration.

**Full commit history**: https://github.com/jlevy/tbd/compare/v0.1.17...v0.1.18
