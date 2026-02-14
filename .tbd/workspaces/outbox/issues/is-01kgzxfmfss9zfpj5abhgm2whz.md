---
created_at: 2026-02-09T00:40:34.552Z
dependencies:
  - target: is-01kgzxfqrfxmt6pcdnw1t8vem6
    type: blocks
id: is-01kgzxfmfss9zfpj5abhgm2whz
kind: task
labels: []
parent_id: is-01kgzxe3p3qc7m2zxz0ga530vy
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "GREEN: Migrate ShortcutHandler to extend DocCommandHandler"
type: is
updated_at: 2026-02-09T01:51:03.438Z
version: 4
---
TDD Step 2 (Green): Change ShortcutHandler to extend DocCommandHandler instead of BaseCommand. Map existing behavior to DocCommandHandler interface: typeName='shortcut', typeNamePlural='shortcuts', paths from config.docs_cache?.lookup_path ?? DEFAULT_SHORTCUT_PATHS, excludeFromList=['skill','skill-brief','shortcut-explanation'], noQueryDocName='shortcut-explanation', docType='shortcut'. All characterization tests from step 1 must still pass.
