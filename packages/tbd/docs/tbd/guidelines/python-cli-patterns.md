---
title: Python CLI Patterns
description: Modern patterns for Python CLI application architecture
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Python CLI Patterns

## Recommended Stack

- **uv** for package management, venvs, Python versions
- **Typer** or **argparse + rich_argparse** for CLI framework
- **Rich** for terminal output, tables, progress
- **Ruff** for linting and formatting
- **BasedPyright** for type checking
- **pytest** for testing

## Key Patterns

### Directory Structure

```
src/myproject/
├── __init__.py             # Package entry, VERSION export
├── cli.py                  # Main entry point, app setup
├── commands/               # Command implementations
├── lib/                    # Shared utilities and base classes
│   ├── base_command.py     # Base class for handlers
│   ├── output_manager.py   # Unified output handling
│   └── formatters.py       # Domain-specific formatters
└── types/
    └── options.py          # TypedDict for command options
```

### Agent & CI Compatibility

Support automation with explicit flags:
- `--non-interactive`: Disable prompts, fail if input required
- `--yes` / `-y`: Assume yes to confirmations
- `--format text|json|jsonl`: Output format
- `--no-progress`: Disable spinners (critical for AI agents)

Respect environment variables:
- `CI`: Set by GitHub Actions, GitLab CI, etc.
- `NO_COLOR`: Disable colors (https://no-color.org/)

### Dual Output Mode (Text + JSON)

Use OutputManager for format switching:
- Data (results) -> stdout, always
- Success messages -> stdout, text mode only
- Errors/warnings -> stderr, always
- Spinners/progress -> stderr, TTY only

### Base Command Pattern

Centralize common functionality:
- Context extraction from Typer context
- Output management initialization
- Error handling with consistent formatting
- Dry-run checking

### Error Handling

Define custom exceptions with exit codes:
- `CLIError`: Base exception (exit code 1)
- `ValidationError`: Input validation failed (exit code 2)
- `UserCancelled`: User cancelled (exit code 0)

Exit codes: 0 success, 1 error, 2 validation, 130 interrupted (SIGINT)

### Version Handling

Use `uv-dynamic-versioning` for git-based versions:
- Version derived from git tags
- No manual version bumping required
- Use `importlib.metadata.version()` for runtime lookup

## Best Practices

1. Disable spinners/progress in non-TTY contexts
2. Route output correctly: data to stdout, errors to stderr
3. Support `--dry-run` for safe testing of destructive commands
4. Separate handlers from command definitions for testability
5. Use TypedDict or dataclasses for type-safe options
6. Test with Typer’s CliRunner for isolated, fast tests
