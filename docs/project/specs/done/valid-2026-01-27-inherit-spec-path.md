# Feature Validation: Inherit spec_path from Parent Beads

## Purpose

Validation spec for the spec_path inheritance feature, confirming that child beads
correctly inherit, propagate, and respect explicit overrides of spec_path from parent
beads.

**Feature Plan:** plan-2026-01-27-inherit-spec-path.md

## Automated Validation (Testing Performed)

### Unit Testing

All 8 unit tests pass in `tests/spec-inherit.test.ts`:

1. **Child inherits parent spec_path when created with `--parent` (no `--spec`)**
   - Verifies `spec_path` is copied from parent to child
2. **Child keeps explicit `--spec` when both `--parent` and `--spec` provided**
   - Verifies explicit spec overrides inheritance
3. **Child gets no spec when parent has no spec_path**
   - Verifies no spurious inheritance
4. **Propagation: setting spec on parent updates children without explicit spec**
   - Creates parent + 2 children with no spec, sets parent spec, verifies both children
     updated
5. **Propagation: children with explicit different spec are not overwritten**
   - Creates parent with spec-a, child inherits, another child has explicit spec-b;
     changes parent to spec-b; verifies inherited child updates but explicit child is
     unchanged
6. **Propagation: children with old inherited value update, explicit children don’t**
   - Tests the “old value matching” logic for determining which children to propagate to
7. **Re-parenting: child with no spec inherits new parent’s spec**
   - Creates orphan child, re-parents to parent with spec, verifies inheritance
8. **Re-parenting: child with existing spec is not overwritten**
   - Re-parents child that already has explicit spec, verifies it’s preserved

### Integration and End-to-End Testing

Golden tryscript test `tests/cli-spec-inherit.tryscript.md` covers 4 full CLI scenarios
(A-D) exercising the complete create/update/show workflow through the actual CLI binary.

All 645 project tests pass (38 test files).

## Manual Testing Needed

The following manual validation steps confirm the feature works in a real project
context:

### 1. Basic inheritance on create

```bash
# In a tbd-initialized repo with a spec file:
mkdir -p docs/specs
echo "# Test" > docs/specs/my-feature.md

tbd create "My Epic" --type epic --spec docs/specs/my-feature.md
# Note the epic ID (e.g., tbd-xxxx)

tbd create "Subtask 1" --parent tbd-xxxx
# Verify: should say Created

tbd show <subtask-id> --json | jq .spec_path
# Expected: "docs/specs/my-feature.md"
```

### 2. Propagation on parent spec change

```bash
tbd create "Another Epic" --type epic
# Note ID (e.g., tbd-yyyy)

tbd create "Task A" --parent tbd-yyyy
tbd create "Task B" --parent tbd-yyyy

tbd update tbd-yyyy --spec docs/specs/my-feature.md

tbd show <task-a-id> --json | jq .spec_path
tbd show <task-b-id> --json | jq .spec_path
# Expected: both show "docs/specs/my-feature.md"
```

### 3. Verify tree view shows inherited specs consistently

```bash
tbd list --pretty --spec docs/specs/my-feature.md
# Expected: parent and all children with inherited spec appear
```

### 4. Verify docs are accurate

- Review `tbd --help` for create and update commands — `--parent` and `--spec` option
  descriptions should reflect inheritance behavior
- Review `tbd design` output — spec_path section should mention inheritance

## Open Questions

None — all planned behavior is implemented and tested.
