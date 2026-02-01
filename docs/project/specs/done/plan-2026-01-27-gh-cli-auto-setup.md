# Plan Spec: Automatic GitHub CLI Setup via SessionStart Hook

## Purpose

This spec designs the feature for tbd to automatically ensure the GitHub CLI (`gh`) is
installed and authenticated in agent sessions by managing an `ensure-gh-cli.sh` script
in `.claude/scripts/`. This behavior is on by default but can be disabled via CLI flag
or config setting.

## Background

The GitHub CLI is essential for agent workflows: creating PRs, managing issues,
interacting with GitHub’s API. Currently, this project manually includes an
`ensure-gh-cli.sh` script in `.claude/scripts/` and a corresponding SessionStart hook in
`.claude/settings.json`. This works but requires manual setup per project.

tbd already manages Claude Code hooks and scripts during `tbd setup` (see setup.ts).
It installs a global `tbd-session.sh` script to `~/.claude/scripts/` and configures
SessionStart/PreCompact hooks in `~/.claude/settings.json`. It also installs
project-local hooks in `.claude/settings.json` for PostToolUse reminders.

This feature extends that pattern to also manage a project-local `ensure-gh-cli.sh`
script and its corresponding SessionStart hook entry in `.claude/settings.json`.

### Related Work

- [plan-2026-01-20-streamlined-init-setup-design.md](done/plan-2026-01-20-streamlined-init-setup-design.md)
  \- Designed the unified `tbd setup` command
- [github-cli-setup.md](../../../general/agent-setup/github-cli-setup.md) \- Existing
  documentation for GitHub CLI setup and GH_TOKEN

## Summary of Task

Add automatic GitHub CLI installation to tbd’s setup flow:

1. **New config setting**: `settings.use_gh_cli` (boolean, default: `true`) in
   `.tbd/config.yml`
2. **New CLI flag**: `--no-gh-cli` on `tbd setup` to disable the feature
3. **Idempotent script management**:
   - When `use_gh_cli` is `true` (default): `tbd setup` installs
     `.claude/scripts/ensure-gh-cli.sh` and adds a SessionStart hook entry in
     `.claude/settings.json` if they don’t already exist
   - When `use_gh_cli` is `false`: `tbd setup` removes
     `.claude/scripts/ensure-gh-cli.sh` and the corresponding SessionStart hook entry if
     they exist
4. **`--no-gh-cli` flag behavior**: Sets `use_gh_cli: false` in config and triggers the
   removal path
5. **Documentation**: Update reference docs to explain that tbd installs gh by default
   and how to disable it

## Backward Compatibility

| Area | Impact | Notes |
| --- | --- | --- |
| Code | Backward compatible | New optional config field with default preserving new behavior |
| API | N/A | No API changes |
| File format | Backward compatible | New optional `settings.use_gh_cli` field; missing = `true` |
| Database schema | N/A | No database |

## Stage 1: Planning Stage

### Feature Requirements

1. **Config Setting**
   - `settings.use_gh_cli: true` (default) in `.tbd/config.yml`
   - When missing from config, treated as `true`
   - Preserved across `tbd setup` runs (not overwritten if explicitly set to `false`)

2. **CLI Flag**
   - `tbd setup --no-gh-cli` sets `use_gh_cli: false` in config
   - `tbd setup` (without flag) preserves whatever `use_gh_cli` is in config
   - `tbd setup --no-gh-cli` is equivalent to manually setting `use_gh_cli: false` and
     running setup

3. **Script Installation (when `use_gh_cli` is `true`)**
   - Copy `ensure-gh-cli.sh` to `.claude/scripts/ensure-gh-cli.sh` in the project
   - Make it executable (chmod 755)
   - Add a SessionStart hook entry in `.claude/settings.json` that runs the script
   - Idempotent: skip if script already exists with correct content, update if stale

4. **Script Removal (when `use_gh_cli` is `false`)**
   - Remove `.claude/scripts/ensure-gh-cli.sh` if it exists
   - Remove the corresponding SessionStart hook entry from `.claude/settings.json`
   - Idempotent: no-op if already removed

5. **Script Source**
   - The `ensure-gh-cli.sh` lives as a real `.sh` file at
     `packages/tbd/docs/install/ensure-gh-cli.sh`
   - It is copied to `dist/docs/install/` during the postbuild step (the `install/`
     directory is already recursively copied by `copy-docs.mjs`)
   - At runtime, `setup.ts` reads the script from the bundled location using
     `import.meta.url`-based path resolution (same pattern as `getDocsBasePath()`)

6. **Hook Entry Format**
   - Added to the project-local `.claude/settings.json` (not global), since this is
     per-project behavior
   - SessionStart entry with matcher `""`, command pointing to the project script:
     `bash .claude/scripts/ensure-gh-cli.sh`, timeout 120

### Acceptance Criteria

1. Fresh `tbd setup --auto` installs `ensure-gh-cli.sh` and SessionStart hook
2. Subsequent `tbd setup --auto` is idempotent (no duplicate hooks)
3. `tbd setup --no-gh-cli` removes the script and hook, sets config to `false`
4. Manually setting `use_gh_cli: false` in config and running `tbd setup --auto` removes
   the script and hook
5. `use_gh_cli` defaults to `true` when missing from config
6. Config value is preserved across setup runs (not reset to `true` unless `--no-gh-cli`
   is absent AND config has no value)
7. Reference docs updated

### Not in Scope

- Global installation of gh CLI (this is project-local)
- Managing GH_TOKEN (that’s an environment variable, documented separately)
- Supporting non-Claude agents (this uses Claude Code’s hook system)

## Stage 2: Architecture Stage

### Files to Modify

```
packages/tbd/
├── docs/
│   └── install/
│       └── ensure-gh-cli.sh     # NEW: source script, copied to dist/ at build time
├── scripts/
│   └── copy-docs.mjs            # Modified: add ensure-gh-cli.sh to postbuild copy
├── src/
│   ├── cli/commands/
│   │   └── setup.ts             # Modified: read bundled script, install/remove logic,
│   │                            #   --no-gh-cli flag
│   └── lib/
│       └── schemas.ts           # Modified: add use_gh_cli to SettingsSchema
```

```
docs/
└── general/agent-setup/
    └── github-cli-setup.md      # Updated: reference tbd auto-setup
```

### Build Pipeline for ensure-gh-cli.sh

The script lives as a real `.sh` file at `packages/tbd/docs/install/ensure-gh-cli.sh`
(alongside `claude-header.md` which is already in `docs/install/`).

**Build flow:**

1. **Source**: `packages/tbd/docs/install/ensure-gh-cli.sh`
2. **Postbuild** (`copy-docs.mjs`): Copy to `dist/docs/install/ensure-gh-cli.sh`
   - The `install/` directory is already copied recursively via
     `copyDir(INSTALL_DIR, join(distDocs, 'install'))` in copy-docs.mjs, so this
     requires **no changes** to copy-docs.mjs — adding the file to `docs/install/` is
     sufficient.
3. **Runtime** (`setup.ts`): Read the script from the bundled location using the same
   `import.meta.url`-based path resolution pattern used by `getDocsBasePath()` in
   `doc-sync.ts`

**Runtime resolution in setup.ts:**

```typescript
async function loadBundledScript(name: string): Promise<string> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // Bundled: dist/docs/install/<name>
  const bundledPath = join(__dirname, '..', 'docs', 'install', name);
  // Dev fallback: packages/tbd/docs/install/<name>
  const devPath = join(__dirname, '..', '..', '..', 'docs', 'install', name);
  for (const p of [bundledPath, devPath]) {
    try {
      return await readFile(p, 'utf-8');
    } catch {
      continue;
    }
  }
  throw new Error(`Bundled script not found: ${name}`);
}
```

This replaces the string-constant pattern (`TBD_SESSION_SCRIPT`) with a file-based
approach. The script is a real `.sh` file that can be edited, linted, and tested
independently.

### Schema Change

```typescript
// In schemas.ts - SettingsSchema
export const SettingsSchema = z.object({
  auto_sync: z.boolean().default(false),
  doc_auto_sync_hours: z.number().default(24),
  use_gh_cli: z.boolean().default(true),   // NEW
}).default({});
```

### Setup.ts Changes

1. **New function**: `loadBundledScript(name)` - reads `.sh` file from bundled
   `dist/docs/install/` at runtime (see Build Pipeline section above)

2. **New constant**: `GH_CLI_HOOK_ENTRY` - the SessionStart hook object:
   ```typescript
   {
     matcher: '',
     hooks: [{ type: 'command', command: 'bash .claude/scripts/ensure-gh-cli.sh', timeout: 120 }],
   }
   ```

3. **Modified `installClaudeSetup()`**: After installing project-local hooks, check
   `use_gh_cli` config setting:
   - If `true`: install `ensure-gh-cli.sh` to `.claude/scripts/`, add SessionStart hook
     entry to project `.claude/settings.json` (idempotent - check if already present by
     matching command string)
   - If `false`: remove script file, remove matching SessionStart hook entry

4. **Modified command registration**: Add `--no-gh-cli` option to setup command.
   When present, set `use_gh_cli: false` in config before running setup.

### Idempotency Strategy

**Script file**: Compare content.
Write only if missing or different.

**Hook entry**: The project `.claude/settings.json` SessionStart array may contain
multiple entries (tbd’s and others).
To be idempotent:
- When adding: check if any existing SessionStart entry has a command matching
  `ensure-gh-cli`. If yes, skip.
  If no, append.
- When removing: filter out any SessionStart entry whose command matches
  `ensure-gh-cli`. If the SessionStart array becomes empty, remove the key.

This follows the same pattern used for cleaning up legacy hooks in setup.ts (see
`LEGACY_TBD_HOOK_PATTERNS`).

### Integration with Existing Hook Management

The current `installClaudeSetup()` merges `CLAUDE_PROJECT_HOOKS` into project settings
using spread:
```typescript
projectSettings.hooks = {
  ...existingProjectHooks,
  ...CLAUDE_PROJECT_HOOKS.hooks,
};
```

This overwrites the entire `PostToolUse` key.
For SessionStart, we need to be more careful since both the gh CLI hook and potentially
other hooks may coexist.
The approach should be:
1. After the spread merge, handle SessionStart separately
2. Check if gh CLI hook already exists in SessionStart array
3. Add or remove as needed

Alternatively, add the gh CLI hook entry to `CLAUDE_PROJECT_HOOKS` conditionally based
on the config setting, before the merge.
This is simpler but means the merge logic handles it.

**Recommended approach**: Handle gh CLI hook as a separate step after the main hook
merge, using explicit array manipulation.
This keeps the logic clear and avoids coupling with the existing merge.

## Stage 3: Refine Architecture

### Existing Components to Reuse

1. **`getDocsBasePath()` pattern** in `doc-sync.ts` - `import.meta.url`-based path
   resolution with dev fallback; reuse this pattern for `loadBundledScript()`
2. **`copy-docs.mjs` postbuild** - Already copies `docs/install/` recursively to
   `dist/docs/install/`; no changes needed, just add the `.sh` file to that directory
3. **`installClaudeSetup()` method** - Already handles project `.claude/settings.json`
   read/write/merge
4. **`LEGACY_TBD_HOOK_PATTERNS` cleanup** - Pattern for finding and removing hooks by
   command string matching
5. **`readConfig()` / `writeConfig()`** - Config persistence with Zod validation
6. **`pathExists()`** - File existence check utility

### Simplification Decisions

1. No migration needed - `use_gh_cli` defaults to `true` when missing, which is the
   desired default behavior
2. No need for a separate handler class - this integrates into existing
   `SetupClaudeHandler`
3. Script is a real `.sh` file in `packages/tbd/docs/install/`, read from the bundled
   `dist/docs/install/` at runtime via `loadBundledScript()` — no string constants
4. No version tracking for the script - always overwrite with current version (matches
   tbd-session.sh behavior)
5. No changes to `copy-docs.mjs` - the `install/` directory is already recursively
   copied in the postbuild step

## Open Questions

1. **Script location**: `.claude/scripts/` (project-local) vs `~/.claude/scripts/`
   (global). Project-local is better because different projects may want different
   settings. The hook reference uses a relative path (`bash .claude/scripts/...`) which
   works for project-local.

   **Decision**: Project-local `.claude/scripts/ensure-gh-cli.sh`.

2. **Should `.claude/scripts/` be gitignored?** Currently `.claude/.gitignore` only
   ignores `*.bak`. The scripts directory contains generated files but also potentially
   user-edited scripts.
   For now, keep it tracked in git (not gitignored) so team members benefit from the
   hook without running setup.

   **Decision**: Keep tracked in git.
   The script is idempotent and safe to commit.

3. **Should the hook entry be in project or global settings?** Global would apply to all
   projects. Project-local allows per-project control.

   **Decision**: Project-local, matching the PostToolUse hook pattern.

## Stage 4: Testing

Tests go in `packages/tbd/tests/setup-flows.test.ts`, extending the existing
`describe('setup flows')` suite which already covers fresh setup, legacy cleanup, beads
migration, etc.
The test infrastructure uses Vitest with temp directories, `spawnSync` to
run the built CLI binary, and direct filesystem assertions.

### End-to-End Golden Tests

Add a new `describe('gh CLI setup')` block with these tests:

#### Test 1: Fresh setup installs ensure-gh-cli.sh and SessionStart hook

```typescript
it('installs ensure-gh-cli.sh script and SessionStart hook by default', async () => {
  initGitRepo();
  const result = runTbd(['setup', '--auto', '--prefix=test']);
  expect(result.status).toBe(0);

  // Script file should exist and be executable
  const scriptPath = join(tempDir, '.claude', 'scripts', 'ensure-gh-cli.sh');
  await expect(access(scriptPath)).resolves.not.toThrow();
  const scriptContent = await readFile(scriptPath, 'utf-8');
  expect(scriptContent).toContain('#!/bin/bash');
  expect(scriptContent).toContain('gh');

  // Project settings.json should have SessionStart hook for gh CLI
  const settingsPath = join(tempDir, '.claude', 'settings.json');
  const settings = JSON.parse(await readFile(settingsPath, 'utf-8'));
  const sessionStart = settings.hooks?.SessionStart ?? [];
  const hasGhHook = sessionStart.some((h: any) =>
    h.hooks?.some((hook: any) => hook.command?.includes('ensure-gh-cli')),
  );
  expect(hasGhHook).toBe(true);
});
```

#### Test 2: Idempotent — no duplicate hooks on repeated setup

```typescript
it('does not duplicate SessionStart hook on repeated setup', async () => {
  initGitRepo();
  runTbd(['setup', '--auto', '--prefix=test']);
  runTbd(['setup', '--auto']); // second run

  const settingsPath = join(tempDir, '.claude', 'settings.json');
  const settings = JSON.parse(await readFile(settingsPath, 'utf-8'));
  const sessionStart = settings.hooks?.SessionStart ?? [];
  const ghHookCount = sessionStart.filter((h: any) =>
    h.hooks?.some((hook: any) => hook.command?.includes('ensure-gh-cli')),
  ).length;
  expect(ghHookCount).toBe(1);
});
```

#### Test 3: --no-gh-cli removes script and hook

```typescript
it('--no-gh-cli removes ensure-gh-cli.sh and SessionStart hook', async () => {
  initGitRepo();

  // First setup with gh CLI enabled (default)
  runTbd(['setup', '--auto', '--prefix=test']);
  const scriptPath = join(tempDir, '.claude', 'scripts', 'ensure-gh-cli.sh');
  await expect(access(scriptPath)).resolves.not.toThrow();

  // Now disable
  const result = runTbd(['setup', '--auto', '--no-gh-cli']);
  expect(result.status).toBe(0);

  // Script should be removed
  await expect(access(scriptPath)).rejects.toThrow();

  // Hook should be removed from settings.json
  const settingsPath = join(tempDir, '.claude', 'settings.json');
  const settings = JSON.parse(await readFile(settingsPath, 'utf-8'));
  const sessionStart = settings.hooks?.SessionStart ?? [];
  const hasGhHook = sessionStart.some((h: any) =>
    h.hooks?.some((hook: any) => hook.command?.includes('ensure-gh-cli')),
  );
  expect(hasGhHook).toBe(false);
});
```

#### Test 4: Config use_gh_cli: false prevents installation

```typescript
it('respects use_gh_cli: false in config', async () => {
  initGitRepo();
  runTbd(['init', '--prefix=test']);

  // Manually set use_gh_cli: false in config
  const { readConfig, writeConfig } = await import('../src/file/config.js');
  const config = await readConfig(tempDir);
  config.settings.use_gh_cli = false;
  await writeConfig(tempDir, config);

  // Run setup — should NOT install gh CLI script
  runTbd(['setup', '--auto']);

  const scriptPath = join(tempDir, '.claude', 'scripts', 'ensure-gh-cli.sh');
  await expect(access(scriptPath)).rejects.toThrow();
});
```

#### Test 5: Config value preserved across setup runs

```typescript
it('preserves use_gh_cli: false across setup runs', async () => {
  initGitRepo();

  // Setup with --no-gh-cli
  runTbd(['setup', '--auto', '--prefix=test', '--no-gh-cli']);

  // Verify config has use_gh_cli: false
  const { readConfig } = await import('../src/file/config.js');
  const config = await readConfig(tempDir);
  expect(config.settings.use_gh_cli).toBe(false);

  // Run setup again without --no-gh-cli — should preserve false
  runTbd(['setup', '--auto']);

  const config2 = await readConfig(tempDir);
  expect(config2.settings.use_gh_cli).toBe(false);

  // Script should still not exist
  const scriptPath = join(tempDir, '.claude', 'scripts', 'ensure-gh-cli.sh');
  await expect(access(scriptPath)).rejects.toThrow();
});
```

#### Test 6: Existing non-gh SessionStart hooks are preserved

```typescript
it('preserves non-gh SessionStart hooks when adding/removing gh hook', async () => {
  initGitRepo();

  // Pre-create settings with a custom SessionStart hook
  const settingsDir = join(tempDir, '.claude');
  await mkdir(settingsDir, { recursive: true });
  await writeFile(
    join(settingsDir, 'settings.json'),
    JSON.stringify({
      hooks: {
        SessionStart: [
          {
            matcher: '',
            hooks: [{ type: 'command', command: 'echo custom-hook' }],
          },
        ],
      },
    }, null, 2),
  );

  // Setup should add gh hook alongside custom hook
  runTbd(['init', '--prefix=test']);
  runTbd(['setup', '--auto']);

  const settings1 = JSON.parse(
    await readFile(join(settingsDir, 'settings.json'), 'utf-8'),
  );
  const sessionStart1 = settings1.hooks?.SessionStart ?? [];
  expect(sessionStart1.length).toBeGreaterThanOrEqual(2);
  expect(sessionStart1.some((h: any) =>
    h.hooks?.some((hook: any) => hook.command === 'echo custom-hook'),
  )).toBe(true);

  // Disable gh CLI — custom hook should remain
  runTbd(['setup', '--auto', '--no-gh-cli']);

  const settings2 = JSON.parse(
    await readFile(join(settingsDir, 'settings.json'), 'utf-8'),
  );
  const sessionStart2 = settings2.hooks?.SessionStart ?? [];
  expect(sessionStart2.some((h: any) =>
    h.hooks?.some((hook: any) => hook.command === 'echo custom-hook'),
  )).toBe(true);
  expect(sessionStart2.some((h: any) =>
    h.hooks?.some((hook: any) => hook.command?.includes('ensure-gh-cli')),
  )).toBe(false);
});
```

#### Test 7: Script content matches bundled source

```typescript
it('installed script matches bundled ensure-gh-cli.sh', async () => {
  initGitRepo();
  runTbd(['setup', '--auto', '--prefix=test']);

  // Read installed script
  const scriptPath = join(tempDir, '.claude', 'scripts', 'ensure-gh-cli.sh');
  const installed = await readFile(scriptPath, 'utf-8');

  // Read bundled source
  const bundledPath = join(__dirname, '..', 'docs', 'install', 'ensure-gh-cli.sh');
  const bundled = await readFile(bundledPath, 'utf-8');

  expect(installed).toBe(bundled);
});
```

### Summary

These 7 tests cover the full matrix:

| Scenario | Script file | Hook entry | Config value |
| --- | --- | --- | --- |
| Fresh setup (default) | Installed | Added | `true` (default) |
| Repeated setup | Unchanged | No duplicate | Preserved |
| `--no-gh-cli` after enabled | Removed | Removed | Set to `false` |
| Config `false`, no flag | Not installed | Not added | Preserved |
| Config `false` preserved | Still absent | Still absent | Still `false` |
| Other hooks coexist | Correct | Others preserved | N/A |
| Content correctness | Matches bundled | N/A | N/A |
