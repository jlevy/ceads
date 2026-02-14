#!/usr/bin/env bash
# validate-docs.sh - Compare doc output between released and dev builds.
#
# Usage: ./scripts/validate-docs.sh
#
# Compares output of shortcut/guidelines/template/reference commands between:
#   - Released: npx --yes get-tbd@latest (if available)
#   - Dev:      node packages/tbd/dist/bin.mjs (local build)
#
# Reports MATCH/DIFF/NEW for each doc entry.

set -euo pipefail

DEV_CMD="node packages/tbd/dist/bin.mjs"
RELEASED_CMD="npx --yes get-tbd@latest"

# Check if we're in the right directory
if [[ ! -f packages/tbd/dist/bin.mjs ]]; then
  echo "Error: Run from repo root after 'pnpm build'"
  exit 1
fi

# Check if released version is available
HAS_RELEASED=true
if ! command -v npx &>/dev/null; then
  HAS_RELEASED=false
  echo "Warning: npx not available, skipping released comparison"
fi

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

echo "=== Doc Validation Report ==="
echo ""

for TYPE in shortcut guidelines template reference; do
  echo "--- ${TYPE}s ---"

  # Get dev listing
  TBD_DEV_VERSION=dev $DEV_CMD $TYPE --list 2>/dev/null | grep -oP '^\S+' > "$TMPDIR/dev-$TYPE.txt" || true

  if [[ "$HAS_RELEASED" == "true" ]]; then
    # Get released listing (may not have reference command)
    TBD_DEV_VERSION=dev $RELEASED_CMD $TYPE --list 2>/dev/null | grep -oP '^\S+' > "$TMPDIR/rel-$TYPE.txt" || true
  fi

  # Report each doc
  while IFS= read -r name; do
    [[ -z "$name" ]] && continue
    DEV_OUT=$( TBD_DEV_VERSION=dev $DEV_CMD $TYPE "$name" 2>/dev/null || echo "[NOT FOUND]" )

    if [[ "$HAS_RELEASED" == "true" ]] && grep -qxF "$name" "$TMPDIR/rel-$TYPE.txt" 2>/dev/null; then
      REL_OUT=$( TBD_DEV_VERSION=dev $RELEASED_CMD $TYPE "$name" 2>/dev/null || echo "[NOT FOUND]" )
      if [[ "$DEV_OUT" == "$REL_OUT" ]]; then
        echo "  MATCH: $name"
      else
        echo "  DIFF:  $name"
      fi
    else
      echo "  NEW:   $name"
    fi
  done < "$TMPDIR/dev-$TYPE.txt"

  # Check for removed docs
  if [[ "$HAS_RELEASED" == "true" ]] && [[ -f "$TMPDIR/rel-$TYPE.txt" ]]; then
    while IFS= read -r name; do
      [[ -z "$name" ]] && continue
      if ! grep -qxF "$name" "$TMPDIR/dev-$TYPE.txt" 2>/dev/null; then
        echo "  REMOVED: $name"
      fi
    done < "$TMPDIR/rel-$TYPE.txt"
  fi

  echo ""
done

echo "=== Done ==="
