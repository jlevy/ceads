---
close_reason: Added IdMappingYamlSchema and Ulid schema to schemas.ts. Updated id-mapping.ts to validate parsed YAML with Zod. Updated ShortId regex to handle legacy dotted IDs from imports. Skipped prefix-detection schema - it only reads legacy .beads config for migration and handles errors gracefully.
closed_at: 2026-02-02T19:52:47.962Z
created_at: 2026-02-02T19:43:10.083Z
dependencies:
  - target: is-01kgfy2s3b37y02tya2nmnn6mm
    type: blocks
id: is-01kgfy2r84tfbc9zc5mx8jvkx5
kind: task
labels: []
parent_id: is-01kgfy2a5tz9hx3b7twjg2est7
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-skill-md-comprehensive-update.md
status: closed
title: Add Zod schemas for id-mapping.ts and prefix-detection.ts
type: is
updated_at: 2026-02-02T19:52:47.963Z
version: 4
---
Add IdMappingSchema and PrefixDetectionCacheSchema to schemas.ts for validating parsed YAML data.
