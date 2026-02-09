---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 30000
patterns:
  ULID: '[0-9a-z]{26}'
  SHORTID: '[0-9a-z]{4,5}'
  TIMESTAMP: "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z"
before: |
  # Set up a test git repository
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  # Initialize tbd with test prefix
  tbd init --prefix=test
  # Create spec files for testing
  mkdir -p docs/specs
  echo "# Feature A Spec" > docs/specs/feature-a.md
  echo "# Feature B Spec" > docs/specs/feature-b.md
---
# tbd CLI: Spec Path Inheritance

Tests for inheriting spec_path from parent beads to children.

* * *

## Scenario A: Child Inherits spec_path from Parent on Create

# Test: Create parent epic with spec

```console
$ tbd create "Epic: Feature A" --type epic --spec docs/specs/feature-a.md --json | jq -r '.id' | tee parent_id.txt
test-[SHORTID]
? 0
```

# Test: Create child with --parent (no --spec) — should inherit

```console
$ tbd create "Task: Implement A" --parent $(cat parent_id.txt) --json | jq -r '.id' | tee child1_id.txt
test-[SHORTID]
? 0
```

# Test: Verify child inherited parent’s spec_path

```console
$ tbd show $(cat child1_id.txt) --json
{
...
}
? 0
```

# Test: Create child with explicit --spec — should NOT inherit

```console
$ tbd create "Task: Related B" --parent $(cat parent_id.txt) --spec docs/specs/feature-b.md --json | jq -r '.id' | tee child2_id.txt
test-[SHORTID]
? 0
```

# Test: Verify child kept explicit spec_path

```console
$ tbd show $(cat child2_id.txt) --json
{
...
}
? 0
```

# Test: Create child with parent that has no spec — child gets no spec

```console
$ tbd create "Epic: No Spec" --type epic --json | jq -r '.id' | tee nospec_parent_id.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Task under no-spec parent" --parent $(cat nospec_parent_id.txt) --json
{
...
}
? 0
```

* * *

## Scenario B: Updating Parent Spec Propagates to Children

# Test: Create parent with no spec and two children

```console
$ tbd create "Epic: Feature Z" --type epic --json | jq -r '.id' | tee pz_id.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Task Z1" --parent $(cat pz_id.txt) --json | jq -r '.id' | tee z1_id.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Task Z2" --parent $(cat pz_id.txt) --json | jq -r '.id' | tee z2_id.txt
test-[SHORTID]
? 0
```

# Test: Set spec on parent — children should get it

```console
$ tbd update $(cat pz_id.txt) --spec docs/specs/feature-a.md
✓ Updated [..]
? 0
```

```console
$ tbd show $(cat z1_id.txt) --json
{
...
}
? 0
```

```console
$ tbd show $(cat z2_id.txt) --json
{
...
}
? 0
```

# Test: Change parent spec — children with old value should update

```console
$ tbd update $(cat pz_id.txt) --spec docs/specs/feature-b.md
✓ Updated [..]
? 0
```

```console
$ tbd show $(cat z1_id.txt) --json
{
...
}
? 0
```

```console
$ tbd show $(cat z2_id.txt) --json
{
...
}
? 0
```

* * *

## Scenario C: Child with Explicit Spec is NOT Overwritten by Parent Change

# Test: Create parent with spec-a, child inherits, another child has explicit spec-b

```console
$ tbd create "Epic: Mixed" --type epic --spec docs/specs/feature-a.md --json | jq -r '.id' | tee pm_id.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Inheriting child" --parent $(cat pm_id.txt) --json | jq -r '.id' | tee mc1_id.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Explicit child" --parent $(cat pm_id.txt) --spec docs/specs/feature-b.md --json | jq -r '.id' | tee mc2_id.txt
test-[SHORTID]
? 0
```

# Test: Change parent to spec-b — inheriting child updates, explicit child unchanged

```console
$ tbd update $(cat pm_id.txt) --spec docs/specs/feature-b.md
✓ Updated [..]
? 0
```

```console
$ tbd show $(cat mc1_id.txt) --json
{
...
}
? 0
```

```console
$ tbd show $(cat mc2_id.txt) --json
{
...
}
? 0
```

* * *

## Scenario D: Re-parenting Inherits New Parent’s Spec

# Test: Create orphan child with no spec, re-parent to parent with spec

```console
$ tbd create "Orphan task" --json | jq -r '.id' | tee orphan_id.txt
test-[SHORTID]
? 0
```

```console
$ tbd update $(cat orphan_id.txt) --parent $(cat parent_id.txt)
✓ Updated [..]
? 0
```

```console
$ tbd show $(cat orphan_id.txt) --json
{
...
}
? 0
```

# Test: Re-parenting child with existing spec does NOT overwrite

```console
$ tbd create "Task with own spec" --spec docs/specs/feature-b.md --json | jq -r '.id' | tee owned_id.txt
test-[SHORTID]
? 0
```

```console
$ tbd update $(cat owned_id.txt) --parent $(cat parent_id.txt)
✓ Updated [..]
? 0
```

```console
$ tbd show $(cat owned_id.txt) --json
{
...
}
? 0
```
