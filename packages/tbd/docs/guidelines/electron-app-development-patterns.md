---
title: Electron App Development Patterns
description: Guidelines for Electron development ecosystems including npm, pnpm, and Bun, with security baselines and framework comparisons
---
# Electron App Development Patterns

This guideline covers modern Electron app development, comparing package manager
ecosystems (npm, pnpm, Bun), alternative frameworks (Electrobun, Tauri), and security
best practices. Use this when building desktop applications with Electron or evaluating
lightweight alternatives.

## Document Structure

This guideline is organized in three parts:

1. **Part 1: Verified Facts** — Technical details verified through direct testing,
   source code analysis, and documented issue reports
2. **Part 2: Third-Party Perspectives** — Community opinions and blog posts, clearly
   marked as such
3. **Part 3: Analysis and Recommendations** — Decision frameworks and recommendations
   based on available evidence, with explicit uncertainty acknowledgment

## Research Methodology

### Primary Sources (Direct Verification)

| Source | Verification Method |
| --- | --- |
| Electron 39.x + macOS 14.x | Direct testing on local machine + CI comparison |
| craft-agents-oss | Full source code analysis (`/repos/craft-agents-oss`) |
| Electrobun | Full source code analysis (`/repos/electrobun`) |
| GitHub issue reports | Reviewed error messages and reproduction steps |
| tbd guidelines | bun-monorepo-patterns, pnpm-monorepo-patterns |

### Verification Confidence Levels

- **Verified**: Directly tested or confirmed in source code
- **Documented**: Appears in issue trackers with reproduction steps
- **Reported**: Community reports without independent verification

# Part 1: Verified Facts

## 1. Electron Architecture Fundamentals

### How Electron Works (Verified)

Electron applications consist of three process types:

```
┌─────────────────────────────────────────────────┐
│                Electron Application              │
├─────────────────────────────────────────────────┤
│  Main Process (Node.js)                         │
│  ├── App lifecycle (app.whenReady, etc.)        │
│  ├── Window management (BrowserWindow)          │
│  ├── Native OS integration                      │
│  └── IPC main-side handlers                     │
├─────────────────────────────────────────────────┤
│  Preload Scripts (Node.js, sandboxed)           │
│  ├── contextBridge API exposure                 │
│  └── IPC bridge to renderer                     │
├─────────────────────────────────────────────────┤
│  Renderer Process (Chromium)                    │
│  ├── HTML/CSS/JavaScript                        │
│  └── Web application (React, Vue, etc.)         │
└─────────────────────────────────────────────────┘
```

**Critical fact**: Main and preload processes execute in **Node.js**, not Bun.
Even when using Bun for package management, Electron itself runs Node.js internally.

### Module Format Requirements (Verified)

| Process | Runtime | Required Format | Reason |
| --- | --- | --- | --- |
| Main | Node.js | CJS or ESM | Electron loads via Node.js |
| Preload | Node.js | CJS or ESM | Sandboxed Node.js context |
| Renderer | Chromium | ESM (preferred) | Web standard |

## 2. Package Manager Technical Characteristics

### npm (Verified)

**Technical implementation:**
- Flat `node_modules` with hoisting
- `package-lock.json` for determinism
- No symlinks (copies files directly)
- Electron tooling designed natively for npm

**Electron compatibility**: Full support for all Electron tooling

### pnpm (Verified)

**Technical implementation:**
- Content-addressable store (`~/.local/share/pnpm/store`)
- Symlinks from `node_modules` to store
- Strict dependency isolation (no phantom dependencies)
- `pnpm-lock.yaml` for determinism

**Electron compatibility**: Full support.
electron-builder works without modification.

**Required configuration (`.npmrc`):**
```ini
save-workspace-protocol=true
prefer-workspace-packages=true
```

### Bun (Verified)

**Technical implementation:**
- Flat `node_modules` (similar to npm)
- `bun.lock` (JSONC format since Bun 1.2, text-based and diffable)
- Native TypeScript execution (no transpilation for scripts)
- Reported 5-10x faster installs than npm (vendor claim; varies by workload)

**Electron compatibility**: Partial.
See “Verified Compatibility Issues” below.

## 3. Verified Compatibility Issues

### 3.1 Electron 39.x + macOS 14.x Incompatibility

**Status**: Verified via direct testing

**Test environment comparison:**

| Factor | Local (FAILED) | CI (PASSED) |
| --- | --- | --- |
| macOS | 14.6 (Darwin 23.6.0) | 15.7.3 (Darwin 24.x) |
| Node.js | 22.22.0 | 22.x |
| Electron | 39.5.1 | 39.5.1 |
| npm | 10.9.4 | ~10.x |
| Architecture | ARM64 | ARM64 |

**Test code used:**
```javascript
const { app } = require('electron');
console.log('app type:', typeof app);
console.log('process.type:', process.type);
console.log('electron version:', process.versions.electron);
```

**Results:**
- macOS 15.x: `app type: object`, `process.type: browser` → SUCCESS
- macOS 14.x: `app type: undefined`, `process.type: undefined` → FAIL

**Root cause analysis:**
1. Electron binary executes (`npx electron --version` works)
2. Node.js module interception does NOT activate
3. `require('electron')` returns string (path) instead of API object
4. JavaScript bridge initialization fails silently

**Evidence**: CI run on macOS 15.7.3 demonstrating successful Electron 39.x execution
(internal reference: actions/runs/21639950110)

**Observed behavior**: Electron 39.5.1 fails to initialize on macOS 14.6 (arm64) while
succeeding on macOS 15.7.3.

**Status**: Suspected bug or OS-specific regression.
Electron’s official platform policy states v38+ requires macOS 12+, so macOS 14 should
be supported. Needs upstream confirmation.

**Next actions**:
1. Test latest Electron 39 patch + Electron 40 on macOS 14
2. Reproduce on a second macOS 14 machine
3. File upstream Electron issue with minimal repro

### 3.2 electron-builder + Bun Segmentation Faults

**Status**: Documented in GitHub issue tracker

**Source**: [oven-sh/bun#18249](https://github.com/oven-sh/bun/issues/18249) (March
2025\)

**Reported error:**
```
panic(main thread): Segmentation fault at address 0x0
```

**Context**: Occurs during electron-builder’s build phase on macOS

**Analysis**: This is a crash in Bun’s runtime during electron-builder’s module
scanning, not a configuration issue.

### 3.3 electron-builder Script Resolution Failure

**Status**: Documented in GitHub issue tracker

**Source**: [oven-sh/bun#9895](https://github.com/oven-sh/bun/issues/9895) (April 2024)

**Reported error:**
```
cannot execute cause=exit status 1 errorOut=error: Script not found "rebuild"
```

**Analysis**: electron-builder relies on npm lifecycle scripts that Bun resolves
differently.

### 3.4 electron-forge npm Version Check

**Status**: Documented (Stack Overflow, verified in forge source)

**Source**:
[stackoverflow.com/questions/77295981](https://stackoverflow.com/questions/77295981/how-run-electron-js-with-bun)

**Error:**
```
Incompatible version of NPM detected
```

**Analysis**: electron-forge explicitly checks for npm and rejects other package
managers. This is intentional behavior.

### 3.5 Lockfile Mismatches with Bun

**Status**: Documented in Quasar issue tracker

**Source**:
[github.com/quasarframework/quasar/issues/17085](https://github.com/quasarframework/quasar/issues/17085)

**Issue**: electron-builder creates UnPackaged folder with lockfile that doesn’t match
the Bun lockfile.

**Workaround**: `--no-frozen-lockfile` (defeats dependency pinning)

### 3.6 Windows File Locking with Bun

**Status**: Verified in craft-agents-oss codebase

**Source**: Comment in `apps/electron/electron-builder.yml`

**Error**: EBUSY when electron-builder tries to copy `bun.exe`

**Solution implemented:**
```yaml
win:
  files:
    - "!vendor/bun/**/*"
  extraResources:
    - from: vendor/bun/bun.exe
      to: vendor/bun/bun.exe
```

### 3.7 Development vs Production Build Behavior

**Status**: Reported by multiple community members

**Sources**:
- [Reddit: Electron app works in dev but fails after build](https://www.reddit.com/r/electronjs/comments/1gnm7g5/help_needed_electron_app_works_in_dev_but_fails/)
- Community reports in Bun issues

**Pattern observed**: Development builds (`bun run dev`, `electron .`) often work
correctly, while production builds (`electron-builder`, packaging) fail with crashes or
errors.

**Analysis**: This suggests the issues are specifically in electron-builder’s
packaging/bundling phase, not in Electron itself.
Development mode doesn’t trigger the problematic code paths.

### 3.8 Electron Installation Issues with Bun

**Status**: Documented in GitHub issue tracker

**Source**: [oven-sh/bun#1588](https://github.com/oven-sh/bun/issues/1588) - “Electron
failed to install correctly”

**Issue**: Early Bun versions had issues installing Electron’s native binaries correctly
due to postinstall script handling differences.

**Current status**: Partially resolved in newer Bun versions, but edge cases remain.

## 4. Reference Implementation Analysis: craft-agents-oss

**Source**: Full analysis of `/repos/craft-agents-oss`

### Architecture (Verified from Source)

```
craft-agents-oss/
├── apps/
│   ├── electron/           # Electron desktop app
│   │   ├── src/
│   │   │   ├── main/       # → esbuild → dist/main.cjs
│   │   │   ├── preload/    # → esbuild → dist/preload.cjs
│   │   │   └── renderer/   # → Vite → dist/renderer/
│   │   ├── electron-builder.yml
│   │   └── vite.config.ts
│   └── viewer/
├── packages/
│   ├── core/               # Types (no external deps)
│   ├── shared/             # Business logic
│   └── ui/                 # React components
├── scripts/
│   ├── electron-build-main.ts
│   ├── electron-build-preload.ts
│   └── electron-dev.ts
├── bunfig.toml
└── bun.lock
```

### Build Configuration (Verified from Source)

**Main process build** (`scripts/electron-build-main.ts`):
```typescript
const proc = spawn({
  cmd: [
    "bun", "run", "esbuild",
    "apps/electron/src/main/index.ts",
    "--bundle",
    "--platform=node",
    "--format=cjs",
    "--outfile=apps/electron/dist/main.cjs",
    "--external:electron",
  ],
});
```

Key decisions:
- **Format**: CJS (CommonJS) for Node.js compatibility
- **Platform**: `node` (not browser)
- **External**: Only `electron` is externalized

### Workarounds Implemented (Verified)

| Issue | Solution in codebase |
| --- | --- |
| File write timing | Poll 3x (100ms each) to detect stabilization |
| Syntax validation | `node --check` after bundling |
| SDK path resolution | Explicit `setPathToClaudeCodeExecutable()` call |
| Windows file locking | `extraResources` instead of `files` |
| React duplication | Vite `resolve.dedupe` + explicit aliases |

### SDK Path Resolution Issue (Verified)

**Problem**: Packages using `import.meta.url` break after esbuild bundling.

**Error observed:**
```
Error: The "path" argument must be of type string or an instance of URL. Received undefined
```

**Solution in code:**
```typescript
const cliPath = join(process.cwd(), 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'cli.js');
setPathToClaudeCodeExecutable(cliPath);
```

## 5. Electrobun Technical Analysis

**Source**: Full analysis of `/repos/electrobun`

**See also**:
[Electrobun Desktop Framework Research](./research-2026-02-03-electrobun-desktop-framework.md)
for detailed analysis including Anthropic/Bun acquisition implications, RPC system
details, and build/distribution best practices.

### Architecture (Verified from Source)

```
┌─────────────────────────────────────────────────┐
│                Electrobun Application            │
├─────────────────────────────────────────────────┤
│  Main Process                                   │
│  ├── Runtime: Bun (NOT Node.js)                 │
│  ├── FFI calls to libNativeWrapper              │
│  └── Window/view management                     │
├─────────────────────────────────────────────────┤
│  Webview (choose one)                           │
│  ├── System: WKWebView / WebView2 / WebKitGTK   │
│  └── CEF: Chromium Embedded Framework           │
├─────────────────────────────────────────────────┤
│  Native Bridge                                  │
│  ├── macOS: Objective-C (nativeWrapper.mm)      │
│  ├── Windows: C++ (nativeWrapper.cpp)           │
│  └── Linux: C++ with GTK+                       │
└─────────────────────────────────────────────────┘
```

**Key difference from Electron**: Electrobun uses Bun runtime directly, not Node.js.

### Build Output Size (Verified from Build System)

| Component | Size |
| --- | --- |
| Bun runtime | ~12MB |
| System webview | 0 (uses OS) |
| CEF (optional) | ~100MB+ |
| **Total (system webview)** | **~12MB** |
| **Total (with CEF)** | **~120MB** |

### Platform Support (Verified from Source)

| Platform | Architectures | System Webview | CEF |
| --- | --- | --- | --- |
| macOS | ARM64, x64 | WKWebView | Yes |
| Windows | x64 (ARM via emulation) | WebView2 | Yes |
| Linux | x64, ARM64 | WebKitGTK | Yes |

### Update System (Verified from Source)

Uses bsdiff for delta patches.
Documentation claims ~14KB patches for small changes (not independently verified).

### Known Technical Limitations (from Source Code Comments)

1. **Bun FFI threading**: JSCallback has memory issues during concurrent operations
   - Workaround in code: 2ms delay for resize events
2. **WebView2 requirement**: Windows requires runtime installed
3. **Linux launcher**: Requires bash wrapper for LD_PRELOAD handling

### Reported Stability Issues

**Source**: [oven-sh/bun#24876](https://github.com/oven-sh/bun/issues/24876) (November
2025\)

**Issue**: Crash reports on macOS with Apple Silicon (M2 Pro specifically)

**Status**: Resolved in Electrobun 0.1.21-beta.0+ (closed as duplicate of #21068).
Demonstrates that Electrobun is actively maintained with platform-specific issues being
addressed.

### Current Version

**As of 2026-02-03:** ~0.0.19-beta.x (see
[GitHub releases](https://github.com/blackboardsh/electrobun/releases))

**Note:** Version numbers in npm/GitHub may appear inconsistent.
The project uses prerelease tags; treat as beta regardless of semver appearance.

## 6. Alternative Lightweight Frameworks

### Buntralino

**Source**: [buntralino.github.io](https://buntralino.github.io)

**What it is**: Combines Bun with [Neutralino.js](https://neutralino.js.org) as a
lighter Electron alternative.

**Architecture**:
- Uses Bun for backend/main process
- Uses Neutralino.js for the webview layer
- Neutralino.js uses system webviews (like Electrobun and Tauri)

**Bundle size**: Smaller than Electron (~5-10MB range)

**Maturity**: Early stage, smaller community than Electrobun

**When to consider**: If you want Bun runtime but Electrobun doesn’t meet your needs

### Tauri (for comparison)

**Source**: [tauri.app](https://tauri.app)

**What it is**: Rust-based desktop framework using system webviews

**Relevance**: Often compared to Electrobun; uses similar system webview approach but
with Rust backend instead of Bun

**Bundle size**: ~5-10MB

**Maturity**: More mature than Electrobun (1.0+ released)

### Desktop Support Discussion in Bun

**Source**: [oven-sh/bun#790](https://github.com/oven-sh/bun/discussions/790) - “Desktop
support (Electron replacement)”

**Context**: Long-running discussion about native desktop app support in Bun ecosystem.
Shows community interest and various approaches being explored.

## 7. Summary of Verified Facts

### Package Manager Electron Support

| Package Manager | electron-builder | electron-forge | Stability |
| --- | --- | --- | --- |
| npm | Full | Full | High |
| pnpm | Full | Supported | High |
| Bun | Crashes/issues | Blocked | Low |

### Electron Version + macOS Compatibility (Observed)

*Note: Based on local testing and CI runs.
Official Electron policy states v38+ requires macOS 12+, so all versions below should
theoretically be supported.*

| Electron | macOS 14.x | macOS 15.x | Notes |
| --- | --- | --- | --- |
| 34.x | ✅ | ✅ | Stable |
| 37-38.x | ✅ | ✅ | Stable |
| 39.x | ⚠️ | ✅ | Observed failure on 14.x (see Section 3.1) |

⚠️ = Issue observed in our environment; not confirmed as intentional platform drop.

### Bundle Size Comparison

| Framework | Minimum Bundle |
| --- | --- |
| Electron | ~150MB |
| Electrobun (system webview) | ~12MB* |
| Electrobun (with CEF) | ~120MB* |

*Vendor-claimed values from [Blackboard](https://blackboard.sh/opensource/). Independent
verification recommended for production decisions.

### Update Mechanisms

Electron update payloads are typically large because the runtime is bundled, but
differential update mechanisms exist:

- **Squirrel deltas**: Built-in support via `autoUpdater` for macOS/Windows
  ([docs](https://electronjs.org/docs/latest/tutorial/updates))
- **electron-updater blockmap**: Differential downloads for NSIS targets
  ([docs](https://www.electron.build/auto-update.html))

These can reduce downloads to MB-to-tens-of-MB range (vs full ~~150MB), but not KB-level
like Electrobun's bsdiff patches (which claim ~~14KB for small changes).

# Part 2: Third-Party Perspectives

*Note: The following represents community opinions and blog posts, not independently
verified facts.*

## Community Reports on Bun + Electron

### electron-forge Issue #3906 (April 2025)

**Source**:
[github.com/electron/forge/issues/3906](https://github.com/electron/forge/issues/3906)

A commenter states “bun works decently now with Electron” and requests official Bun
support. This suggests improving compatibility but is a single user report.

### Stack Overflow Discussion

**Source**:
[stackoverflow.com/questions/77295981](https://stackoverflow.com/questions/77295981/how-run-electron-js-with-bun)

Community consensus is to install both Node.js and Bun, using Bun for speed but Node.js
for Electron tooling.

## Blog Post Perspectives

### “Why We Ditched Node for Bun in 2026”

**Source**:
[dev.to article](https://dev.to/rayenmabrouk/why-we-ditched-node-for-bun-in-2026-and-why-you-should-too-48kg)

Claims >95% Node API compatibility in Bun.
This is a promotional piece, not a technical audit.

### Hacker News Discussion on Electrobun

**Source**:
[news.ycombinator.com/item?id=42199486](https://news.ycombinator.com/item?id=42199486)

Mixed reactions. Praise for small bundle size, concerns about beta stability and system
webview limitations.

## Industry Events

### Anthropic Acquisition of Bun (December 2025)

**Sources**:
- [Anthropic announcement](https://www.anthropic.com/news/anthropic-acquires-bun-as-claude-code-reaches-usd1b-milestone)
  (December 3, 2025)
- [Bun blog post](https://bun.com/blog/bun-joins-anthropic) (December 2, 2025)

Anthropic acquired Bun as its first-ever acquisition, announced alongside Claude Code
reaching $1 billion in annual run-rate revenue.
Bun will remain open-source and MIT-licensed.
This signals significant investment in Bun’s future but doesn’t change current
compatibility facts.

# Part 3: Analysis and Recommendations

## Comparative Analysis

### Approach Comparison

| Criterion | npm + Electron | pnpm + Electron | Bun Hybrid | Electrobun |
| --- | --- | --- | --- | --- |
| **Stability** | Verified High | Verified High | Medium (workarounds needed) | Beta |
| **Install Speed** | Baseline | ~2-3x faster | ~5-10x faster* | ~5-10x faster* |
| **Bundle Size** | ~150MB | ~150MB | ~150MB | ~12MB* |
| **Tooling Support** | Full | Full | Partial | Framework-specific |
| **Production Deployments** | Thousands | Many | Few documented | Very few |

*Vendor-claimed values; actual performance varies by workload.

### Uncertainty Acknowledgment

| Claim | Confidence | Uncertainty |
| --- | --- | --- |
| npm/pnpm work with Electron | High | None identified |
| Bun + electron-builder crashes | Medium | May improve with Bun updates |
| Electron 39.x needs macOS 15.x | High | May be unintended; could be fixed |
| Electrobun ~12MB bundles | Medium | Depends on configuration |
| Electrobun production readiness | Low | Beta status, limited deployments |

## Decision Framework

Building a desktop app involves three separate decisions:

1. **Framework/runtime**: Electron vs Electrobun (vs Tauri, etc.)
2. **Package manager**: npm vs pnpm vs Bun (as a toolchain)
3. **Packaging & updates**: electron-builder vs electron-forge vs Electrobun’s built-in
   pipeline

The sections below address these decisions, starting with package manager choice for
Electron apps, then framework choice (Electron vs Electrobun).

### When to Use npm + Electron

**Choose when:**
- Production application with stability requirements
- Team unfamiliar with pnpm/Bun
- electron-forge is required
- Strict dependency auditing needed

**Risk level**: Low

### When to Use pnpm + Electron

**Choose when:**
- Monorepo with multiple packages
- Disk space efficiency matters
- CI install speed is important
- Team comfortable with modern tooling

**Risk level**: Low

### When to Use Bun Hybrid Approach

**Choose when:**
- Already using Bun for non-Electron code
- Team has Bun expertise
- Willing to maintain workarounds
- electron-forge not required

**Required mitigations:**
1. Use `bun install` but invoke electron-builder via Node.js
2. Implement file stabilization polling
3. Validate syntax with `node --check`
4. Handle SDK path resolution explicitly

**Risk level**: Medium

### When to Evaluate Electrobun

**Choose when:**
- Bundle size is critical constraint
- Update bandwidth is constrained
- Building internal tools / MVPs
- Team accepts beta-quality software
- System webview limitations acceptable

**Uncertainties:**
- API stability before 1.0
- System webview feature parity varies by platform
- Smaller community for troubleshooting

**Risk level**: Medium-High

## Recommended Stacks

### Maximum Stability

```
npm 10.x + Node.js 24.x
├── electron@38 (or @39 on macOS 15.x)
├── electron-builder
├── esbuild
├── Vite
└── TypeScript
```

### Modern Monorepo

```
pnpm 10.x + Node.js 24.x
├── electron
├── electron-builder
├── tsdown (libraries)
├── esbuild (Electron main/preload)
├── Vite (renderer)
├── TypeScript
├── Vitest
├── Changesets
└── lefthook
```

### Bun Hybrid

```
Bun 1.3.x
├── electron
├── electron-builder (via npx, not bunx)
├── esbuild
├── Vite
└── TypeScript
```

### Future-Oriented (with caveats)

```
Bun + Electrobun
├── TypeScript
├── React/Svelte/Vue
└── System webviews or CEF
```

## Electron Security Baseline

Per
[Electron security documentation](https://electronjs.org/docs/latest/tutorial/security),
these are non-optional defaults for any Electron application:

### Required Settings

| Setting | Value | Rationale |
| --- | --- | --- |
| `contextIsolation` | `true` | Isolate preload from renderer |
| `nodeIntegration` | `false` | Prevent direct Node.js access in renderer |
| `sandbox` | `true` | OS-level process isolation |

### Preload Boundary

Use `contextBridge` to expose a minimal API. Treat the preload boundary like an internal
RPC boundary—audit exposed APIs carefully.

**Common failure mode**: Many Electron security incidents are effectively “XSS → RCE”
due to overexposed preload APIs.

### Content Security Policy

Apply strict CSP for renderer windows.
Avoid `unsafe-eval` and `unsafe-inline`.

### Additional Hardening

- Gate `shell.openExternal`, navigation, and protocol handlers
- Validate all file paths before access
- Treat remote content as hostile (avoid loading in privileged windows)
- Use `webContents.setWindowOpenHandler` to control new windows

## Open Questions

1. **Will Electron 39.x macOS 14.x compatibility be fixed?** Unknown.
   Could be intentional OS requirement or bug.

2. **Will Bun + electron-builder crashes be resolved?** Uncertain.
   Fundamental runtime crashes are harder to fix than configuration issues.

3. **When will Electrobun reach 1.0?** Unknown.
   Active development but no public roadmap.

4. **How does Anthropic’s Bun acquisition affect Electron compatibility?** Unclear.
   Investment doesn’t automatically fix compatibility.

## Related Guidelines

- For monorepo setup with pnpm, see `tbd guidelines pnpm-monorepo-patterns`
- For monorepo setup with Bun, see `tbd guidelines bun-monorepo-patterns`

## References

### Primary Sources (Directly Analyzed)

- [craft-agents-oss source](https://github.com/lukilabs/craft-agents-oss)
- [Electrobun source](https://github.com/blackboardsh/electrobun)

### Official Documentation

- [Electron Documentation](https://electronjs.org/docs)
- [electron-builder Documentation](https://electron.build)
- [electron-builder Common Configuration](https://www.electron.build/configuration.html)
- [Bun Documentation](https://bun.sh/docs)
- [pnpm Documentation](https://pnpm.io)
- [Electrobun Documentation](https://electrobun.dev)
- [Neutralino.js Documentation](https://neutralino.js.org)
- [Buntralino Documentation](https://buntralino.github.io)
- [Tauri Documentation](https://tauri.app)

### GitHub Issue Reports (Bun + Electron)

- [Bun #18249: Segfault during electron-builder build phase](https://github.com/oven-sh/bun/issues/18249)
  (March 2025)
- [Bun #9895: Does not work with electron-builder](https://github.com/oven-sh/bun/issues/9895)
  (April 2024)
- [Bun #1588: Electron failed to install correctly](https://github.com/oven-sh/bun/issues/1588)
- [electron-forge #3906: Use bun when bunx is used](https://github.com/electron/forge/issues/3906)
  (April 2025)
- [Quasar #17085: Electron build error with Bun and pnpm](https://github.com/quasarframework/quasar/issues/17085)
  — Fixed in Quasar v1.8.5, v2.0.0-beta.11, v3.12.8, v4.0.0-beta.12

### GitHub Issue Reports (Electrobun)

- [Bun #24876: Crash on MacBook Pro M2 Pro](https://github.com/oven-sh/bun/issues/24876)
  (November 2025) — Closed as duplicate; resolved in Electrobun 0.1.21-beta.0+

### GitHub Discussions

- [Bun #790: Desktop support (Electron replacement)](https://github.com/oven-sh/bun/discussions/790)
  — Community discussion on Bun desktop app support

### Community Resources (Stack Overflow)

- [How to run Electron.js with Bun?](https://stackoverflow.com/questions/77295981/how-run-electron-js-with-bun)
- [Error when building my Electron app](https://stackoverflow.com/questions/46868107/error-when-building-my-electron-app)
- [electron-builder not working for production due to path](https://stackoverflow.com/questions/53422717/electron-builder-not-working-for-production-due-to-path)

### Community Resources (Reddit)

- [Electron app works in dev but fails after build](https://www.reddit.com/r/electronjs/comments/1gnm7g5/help_needed_electron_app_works_in_dev_but_fails/)
- [Why everyone does not just use Bun in 2025](https://www.reddit.com/r/bun/comments/1m69ui2/why_everyone_does_not_just_using_bun_in_2025/)
- [Electron app reference architecture](https://www.reddit.com/r/node/comments/vkffcq/basic1_electron_app_reference_architecture/)

### Blog Posts and News (Third-Party Opinions)

- [Why We Ditched Node for Bun in 2026](https://dev.to/rayenmabrouk/why-we-ditched-node-for-bun-in-2026-and-why-you-should-too-48kg)
  — Opinion piece
- [Electrobun on Hacker News](https://news.ycombinator.com/item?id=42199486)
- [Electrobun on Brian Lovin’s HN](https://brianlovin.com/hn/42199486)

### Anthropic/Bun Acquisition (Primary Sources)

- [Anthropic acquires Bun as Claude Code reaches $1B milestone](https://www.anthropic.com/news/anthropic-acquires-bun-as-claude-code-reaches-usd1b-milestone)
  — Official Anthropic announcement (December 3, 2025)
- [Bun is joining Anthropic](https://bun.com/blog/bun-joins-anthropic) — Bun’s
  announcement (December 2, 2025)

### Other Bug Reports

- [Launchpad #1944468: Electron applications all crash upon launch](https://bugs.launchpad.net/bugs/1944468)
  — Ubuntu-specific Electron issues
