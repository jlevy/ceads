/**
 * Test helpers and constants for tbd tests.
 *
 * Provides valid ULID-format IDs for use in tests.
 * All ULIDs MUST be exactly 26 lowercase alphanumeric characters (a-z, 0-9).
 */

import type { Issue } from '../src/lib/types.js';
import type { InternalIssueId } from '../src/lib/ids.js';

// Valid ULID strings for testing (exactly 26 lowercase alphanumeric characters)
// Each uses format: 01 + identifier (8 chars) + padding zeros + number suffix = 26 total
export const TEST_ULIDS = {
  // General purpose test ULIDs (26 chars each)
  ULID_1: '01aaaaaaaaaaaaaaaaaaaaaa01', // 2 + 22 + 2 = 26
  ULID_2: '01aaaaaaaaaaaaaaaaaaaaaa02',
  ULID_3: '01aaaaaaaaaaaaaaaaaaaaaa03',
  ULID_4: '01aaaaaaaaaaaaaaaaaaaaaa04',
  ULID_5: '01aaaaaaaaaaaaaaaaaaaaaa05',
  ULID_6: '01aaaaaaaaaaaaaaaaaaaaaa06',
  ULID_7: '01aaaaaaaaaaaaaaaaaaaaaa07',
  ULID_8: '01aaaaaaaaaaaaaaaaaaaaaa08',
  ULID_9: '01aaaaaaaaaaaaaaaaaaaaaa09',
  ULID_10: '01aaaaaaaaaaaaaaaaaaaaa010',

  // Parser tests (26 chars): 01 + parser00 + 0000000000000 + 01 = 2+8+13+3
  PARSER_1: '01parser000000000000000001',
  PARSER_2: '01parser000000000000000002',
  PARSER_3: '01parser000000000000000003',

  // Storage tests (26 chars)
  STORAGE_1: '01storage00000000000000001',
  STORAGE_2: '01storage00000000000000002',
  STORAGE_3: '01storage00000000000000003',
  STORAGE_DEL: '01storagedel00000000000001',

  // Ready command tests (26 chars)
  READY_1: '01readytest00000000000001a',
  READY_2: '01readytest00000000000002a',
  READY_3: '01readytest00000000000003a',

  // Blocked command tests (26 chars)
  BLOCKED_1: '01blockedtest000000000001a',
  BLOCKED_2: '01blockedtest000000000002a',
  BLOCKED_3: '01blockedtest000000000003a',
  BLOCKED_4: '01blockedtest000000000004a',

  // Stale command tests (26 chars)
  STALE_1: '01staletest0000000000001aa',
  STALE_2: '01staletest0000000000002aa',
  STALE_3: '01staletest0000000000003aa',
  STALE_4: '01staletest0000000000004aa',

  // Workflow tests (26 chars)
  WORKFLOW_1: '01workflow0000000000000001',
  WORKFLOW_2: '01workflow0000000000000002',
  WORKFLOW_3: '01workflow0000000000000003',
  WORKFLOW_4: '01workflow0000000000000004',
  WORKFLOW_5: '01workflow0000000000000005',
  WORKFLOW_6: '01workflow0000000000000006',

  // Label/depends tests (26 chars)
  LABEL_1: '01labeltest0000000000001aa',
  LABEL_2: '01labeltest0000000000002aa',
  LABEL_3: '01labeltest0000000000003aa',
  LABEL_4: '01labeltest0000000000004aa',
  DEPENDS_1: '01dependstest000000000001a',
  DEPENDS_2: '01dependstest000000000002a',
  DEPENDS_3: '01dependstest000000000003a',
  DEPENDS_4: '01dependstest000000000004a',
  DEPENDS_5: '01dependstest000000000005a',
  DEPENDS_6: '01dependstest000000000006a',
  DEPENDS_7: '01dependstest000000000007a',

  // Close/reopen tests (26 chars)
  CLOSE_1: '01closetest0000000000001aa',
  CLOSE_2: '01closetest0000000000002aa',
  CLOSE_3: '01closetest0000000000003aa',
  CLOSE_4: '01closetest0000000000004aa',
  CLOSE_5: '01closetest0000000000005aa',

  // Doctor/sync tests (26 chars)
  DOCTOR_1: '01doctortest000000000001aa',
  DOCTOR_2: '01doctortest000000000002aa',
  DOCTOR_3: '01doctortest000000000003aa',
  DOCTOR_4: '01doctortest000000000004aa',
  DOCTOR_999: '01doctortest0000000000999a',
  SYNC_1: '01synctest00000000000001aa',

  // Attic/import tests (26 chars)
  ATTIC_1: '01attictest0000000000001aa',
  ATTIC_2: '01attictest0000000000002aa',
  IMPORT_1: '01importtest000000000001aa',
  IMPORT_2: '01importtest000000000002aa',
  IMPORT_3: '01importtest000000000003aa',

  // Git remote integration tests (26 chars)
  REMOTE_1: '01remotetest000000000001aa',
  REMOTE_2: '01remotetest000000000002aa',
  REMOTE_3: '01remotetest000000000003aa',
  REMOTE_4: '01remotetest000000000004aa',
  REMOTE_5: '01remotetest000000000005aa',
  CONCURRENT_1: '01concurrent0000000000001a',
  CONCURRENT_2: '01concurrent0000000000002a',
  CONCURRENT_3: '01concurrent0000000000003a',
  CONCURRENT_4: '01concurrent0000000000004a',

  // Child ordering tests (26 chars)
  CHILD_ORDER_PARENT: '01childorder0000000000001a',
  CHILD_ORDER_A: '01childorder0000000000002a',
  CHILD_ORDER_B: '01childorder0000000000003a',
  CHILD_ORDER_C: '01childorder0000000000004a',
  CHILD_ORDER_D: '01childorder0000000000005a',
  CHILD_ORDER_E: '01childorder0000000000006a',
};

/**
 * Create a test issue ID from a ULID.
 */
export function testId(ulid: string): InternalIssueId {
  return `is-${ulid}` as InternalIssueId;
}

/**
 * Create a minimal valid issue for testing.
 */
export function createTestIssue(overrides: Partial<Issue> & { id: string; title: string }): Issue {
  return {
    type: 'is',
    version: 1,
    kind: 'task',
    status: 'open',
    priority: 2,
    labels: [],
    dependencies: [],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// ============================================================================
// File Location Verification Helpers (tbd-1837)
// ============================================================================

/**
 * Check if a file path is in the correct worktree location.
 * Files should be in .tbd/data-sync-worktree/.tbd/data-sync/ NOT directly in .tbd/data-sync/.
 */
export function isCorrectWorktreePath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  return normalized.includes('.tbd/data-sync-worktree/.tbd/data-sync/');
}

/**
 * Check if a file path is on the wrong location (main branch).
 * Returns true if file is in .tbd/data-sync/ without the worktree prefix.
 */
export function isWrongMainBranchPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  return (
    (normalized.startsWith('.tbd/data-sync/') || normalized.includes('/.tbd/data-sync/')) &&
    !normalized.includes('data-sync-worktree')
  );
}

// ============================================================================
// ID Format Validation Helpers (tbd-1838)
// ============================================================================

/**
 * Verify that an ID string is in the correct short format.
 * Short IDs must be 1-16 alphanumeric characters, not 26-char ULIDs.
 * (Typically 4 chars for new IDs, but imports can preserve IDs like "100" from "tbd-100")
 * Returns true if valid short ID format, false otherwise.
 */
export function isValidShortIdFormat(id: string): boolean {
  const shortPart = id.replace(/^[a-z]+-/, '');
  return /^[a-z0-9]+$/.test(shortPart) && shortPart.length >= 1 && shortPart.length <= 16;
}

/**
 * Verify that an ID string is a full internal ULID format.
 * Internal IDs are 26 lowercase alphanumeric characters.
 */
export function isValidInternalIdFormat(id: string): boolean {
  const ulidPart = id.replace(/^is-/, '');
  return /^[a-z0-9]{26}$/.test(ulidPart);
}

/**
 * Verify that the displayed ID is NOT an internal ULID (catches the bug).
 * Display IDs should be short (4-5 chars), not 26-char ULIDs.
 */
export function isDisplayIdNotInternal(displayId: string): boolean {
  const idPart = displayId.replace(/^[a-z]+-/, '');
  return idPart.length <= 6;
}

// ============================================================================
// Serialization Format Helpers (tbd-1839)
// ============================================================================

/**
 * Verify serialization format: no extra newline after YAML frontmatter.
 * The body should start immediately after the closing ---.
 */
export function hasCorrectFrontmatterFormat(content: string): boolean {
  const lines = content.split('\n');
  let closingIndex = -1;
  let inFrontmatter = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line?.trim() === '---') {
      if (!inFrontmatter) {
        inFrontmatter = true;
      } else {
        closingIndex = i;
        break;
      }
    }
  }

  if (closingIndex === -1) return false;

  // Check if there's an extra blank line after closing ---
  if (closingIndex + 1 < lines.length) {
    const nextLine = lines[closingIndex + 1];
    // If next line is empty AND there's non-empty content after, that's the bug
    if (nextLine === '' && closingIndex + 2 < lines.length && lines[closingIndex + 2] !== '') {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Status Mapping Helpers (tbd-1840)
// ============================================================================

/** Expected tbd status for each beads status */
export const BEADS_TO_TBD_STATUS: Record<string, string> = {
  open: 'open',
  in_progress: 'in_progress',
  done: 'closed', // Critical mapping that was missing
  closed: 'closed',
  tombstone: 'closed', // Or skip
  blocked: 'blocked',
  deferred: 'deferred',
};
