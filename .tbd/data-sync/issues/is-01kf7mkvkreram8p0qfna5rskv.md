---
close_reason: Added notice() method, updated warn() to respect --quiet, updated info() to require --verbose, updated debug() to require --debug only, added command() method. Comprehensive unit tests added.
closed_at: 2026-01-18T04:22:15.934Z
created_at: 2026-01-18T04:08:07.543Z
dependencies: []
id: is-01kf7mkvkreram8p0qfna5rskv
kind: task
labels: []
priority: 2
status: closed
title: OutputManager output level methods
type: is
updated_at: 2026-01-18T04:22:15.936Z
version: 3
---
Add and update OutputManager output level methods:
- Add notice() method - blue bullet, shown at default level
- Update warn() to respect --quiet flag
- Update info() to require --verbose (not default)
- Update debug() to require --debug only (not --verbose)
- Add command() method for external command display

Reference: plan spec section 2.1 (Output Level Definitions)
