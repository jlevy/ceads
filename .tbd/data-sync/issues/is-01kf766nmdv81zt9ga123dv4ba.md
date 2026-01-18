---
close_reason: "Fixed: Top-level error handler now checks for --json flag and outputs errors as JSON when specified"
closed_at: 2026-01-18T04:08:41.240Z
created_at: 2026-01-17T23:56:15.372Z
dependencies: []
id: is-01kf766nmdv81zt9ga123dv4ba
kind: bug
labels: []
priority: 2
status: closed
title: "Bug: Errors not JSON with --json flag"
type: is
updated_at: 2026-01-18T04:08:41.240Z
version: 3
---
When --json flag is used, errors still output as plain text instead of JSON, making parsing unreliable for agents.
