/**
 * ID generation and validation utilities.
 *
 * The system uses dual IDs for usability:
 * - Internal ID: is-{ulid} - ULID-based (26 lowercase chars), stored in files
 * - External ID: {prefix}-{short} - 4-5 base36 chars for CLI display/input
 *
 * For Beads compatibility, bd- prefix is accepted on input for external IDs.
 *
 * See: tbd-design.md §2.5 ID Generation
 */

import { ulid } from 'ulid';
import { randomBytes } from 'node:crypto';

// =============================================================================
// Branded Types for Type-Safe ID Handling
// =============================================================================

/**
 * Branded type for internal issue IDs (is-{ulid} format).
 *
 * Internal IDs are stored in files and used as the canonical identifier.
 * Format: is-{26 lowercase alphanumeric chars}
 * Example: is-01hx5zzkbkactav9wevgemmvrz
 *
 * Use this type when:
 * - Reading/writing issue files
 * - Storing parent_id, dependencies, child_order_hints
 * - Passing IDs between internal functions
 */
declare const InternalIssueIdBrand: unique symbol;
export type InternalIssueId = string & { [InternalIssueIdBrand]: never };

/**
 * Branded type for display issue IDs ({prefix}-{short} format).
 *
 * Display IDs are shown to users and accepted as CLI input.
 * Format: {prefix}-{short} where short is typically 4 base36 chars
 * Example: tbd-a7k2, bd-100
 *
 * Use this type when:
 * - Formatting output for users
 * - Accepting user input (before resolution)
 * - Building tree views for display
 */
declare const DisplayIssueIdBrand: unique symbol;
export type DisplayIssueId = string & { [DisplayIssueIdBrand]: never };

/**
 * Cast a string to InternalIssueId after validation.
 * Use this when you've validated that a string is a valid internal ID.
 */
export function asInternalId(id: string): InternalIssueId {
  return id as InternalIssueId;
}

/**
 * Cast a string to DisplayIssueId.
 * Use this when formatting an ID for display.
 */
export function asDisplayId(id: string): DisplayIssueId {
  return id as DisplayIssueId;
}

/**
 * Prefix for internal IDs (ULID-based).
 * All internal IDs are formatted as: {INTERNAL_ID_PREFIX}-{ulid}
 */
export const INTERNAL_ID_PREFIX = 'is';

/**
 * Length of internal ID prefix including the hyphen (e.g., "is-" = 3).
 */
export const INTERNAL_ID_PREFIX_LENGTH = INTERNAL_ID_PREFIX.length + 1;

/**
 * Construct an internal ID from a ULID.
 *
 * @param ulidValue - The ULID (26 chars)
 * @returns Internal ID in format {prefix}-{ulid}
 */
export function makeInternalId(ulidValue: string): InternalIssueId {
  return `${INTERNAL_ID_PREFIX}-${ulidValue.toLowerCase()}` as InternalIssueId;
}

/**
 * Generate a unique internal ID using ULID.
 * Format: is-{ulid} (26 lowercase alphanumeric chars)
 * Example: is-01hx5zzkbkactav9wevgemmvrz
 *
 * ULID provides:
 * - Time-ordered sorting (48-bit timestamp)
 * - 80-bit randomness (no collisions)
 * - Lexicographic sort = chronological order
 */
export function generateInternalId(): InternalIssueId {
  return makeInternalId(ulid());
}

/**
 * Generate a short ID for external display.
 * Format: base36 characters (a-z, 0-9)
 * Example: a7k2
 *
 * @param length - Number of characters (default 4)
 */
export function generateShortId(length = 4): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i]! % 36];
  }
  return result;
}

// Regex pattern for validating internal IDs - built from prefix constant
const INTERNAL_ID_PATTERN = new RegExp(`^${INTERNAL_ID_PREFIX}-[0-9a-z]{26}$`);

// Expected length of a full internal ID (prefix + hyphen + 26-char ULID)
const INTERNAL_ID_LENGTH = INTERNAL_ID_PREFIX_LENGTH + 26;

/**
 * Validate an internal issue ID matches the ULID format.
 * Format: {prefix}-{26 lowercase alphanumeric chars}
 */
export function validateIssueId(id: string): boolean {
  return INTERNAL_ID_PATTERN.test(id);
}

/**
 * Validate a short/external ID format.
 * Format: 1+ base36 characters (typically 4 for new IDs, but imports may preserve longer IDs).
 */
export function validateShortId(id: string): boolean {
  return /^[0-9a-z]+$/.test(id);
}

/**
 * Check if an input looks like an internal ID (ULID-based).
 */
export function isInternalId(input: string): boolean {
  const lower = input.toLowerCase();
  // Check if it starts with the internal prefix and has correct length
  const prefixWithHyphen = `${INTERNAL_ID_PREFIX}-`;
  if (lower.startsWith(prefixWithHyphen) && lower.length === INTERNAL_ID_LENGTH) {
    return INTERNAL_ID_PATTERN.test(lower);
  }
  return false;
}

/**
 * Check if an input looks like a short/external ID.
 * Returns true for IDs like "a7k2", "bd-a7k2", "100", "tbd-100".
 * Short IDs are 16 characters or less (ULIDs are 26 characters).
 */
export function isShortId(input: string): boolean {
  const lower = input.toLowerCase();
  // Strip prefix if present
  const stripped = lower.replace(/^[a-z]+-/, '');
  // Must be 1-16 alphanumeric chars (short IDs, not ULIDs which are 26 chars)
  return /^[0-9a-z]+$/.test(stripped) && stripped.length >= 1 && stripped.length <= 16;
}

/**
 * Extract the short ID portion from an external ID.
 * Examples:
 *   "tbd-100" -> "100"
 *   "bd-a7k2" -> "a7k2"
 *   "a7k2" -> "a7k2"
 *   "100" -> "100"
 */
export function extractShortId(externalId: string): string {
  return externalId.toLowerCase().replace(/^[a-z]+-/, '');
}

/**
 * Extract the prefix portion from an external ID.
 * Returns the prefix (letters before the hyphen) or null if no prefix found.
 * Examples:
 *   "tbd-100" -> "tbd"
 *   "bd-a7k2" -> "bd"
 *   "TBD-100" -> "tbd" (normalized to lowercase)
 *   "a7k2" -> null (no prefix)
 *   "100" -> null (no prefix)
 */
export function extractPrefix(externalId: string): string | null {
  const match = /^([a-zA-Z]+)-/.exec(externalId);
  return match?.[1]?.toLowerCase() ?? null;
}

/**
 * Extract the ULID portion from an internal ID.
 *
 * Internal IDs have the format: {prefix}-{ulid}
 * This function strips any prefix to return just the ULID.
 *
 * Examples:
 *   "is-01hx5zzkbkactav9wevgemmvrz" -> "01hx5zzkbkactav9wevgemmvrz"
 *   "01hx5zzkbkactav9wevgemmvrz" -> "01hx5zzkbkactav9wevgemmvrz" (no prefix)
 *
 * @param internalId - The internal ID (with or without prefix)
 * @returns The ULID portion without any prefix
 */
export function extractUlidFromInternalId(internalId: string): string {
  // Strip any prefix in format {letters}- (e.g., "is-", "bd-")
  return internalId.toLowerCase().replace(/^[a-z]+-/, '');
}

/** Prefix used in Beads for compatibility */
const BEADS_COMPAT_PREFIX = 'bd';

/**
 * Normalize an internal issue ID.
 *
 * This function expects a full internal ID ({prefix}-{ulid}).
 * If given a short ID, it won't be able to resolve it without
 * access to the ID mapping.
 *
 * Handles:
 * - Uppercase (converts to lowercase)
 * - Ensures internal ID prefix
 * - Beads compatibility (bd- prefix)
 */
export function normalizeIssueId(input: string): string {
  const lower = input.toLowerCase();
  const internalPrefixWithHyphen = `${INTERNAL_ID_PREFIX}-`;
  const beadsPrefixWithHyphen = `${BEADS_COMPAT_PREFIX}-`;

  // If already a valid internal ID, return as-is
  if (validateIssueId(lower)) {
    return lower;
  }

  // If it starts with internal prefix but wrong length, might be corrupted
  if (lower.startsWith(internalPrefixWithHyphen)) {
    return lower; // Return as-is, let validation fail later
  }

  // If it starts with bd- (Beads compat), convert prefix
  if (lower.startsWith(beadsPrefixWithHyphen)) {
    const rest = lower.slice(beadsPrefixWithHyphen.length);
    if (rest.length === 26) {
      return makeInternalId(rest);
    }
    // Short ID - can't resolve without mapping
    return lower;
  }

  // Bare ID without prefix
  if (lower.length === 26 && /^[0-9a-z]{26}$/.test(lower)) {
    return makeInternalId(lower);
  }

  // Can't normalize - return as-is
  return lower;
}

import type { IdMapping } from '../file/id-mapping.js';

/**
 * Format an internal ID for display with the configured prefix.
 *
 * Uses the short ID (4 chars) from the mapping.
 * Throws an error if the mapping is missing or doesn't contain the ID.
 *
 * IMPORTANT: All user-facing output MUST use short IDs, never internal ULIDs.
 * If you see a ULID in user output, it's a bug.
 *
 * @param internalId - The internal ID (is-{ulid})
 * @param mapping - ID mapping for short ID lookup (required)
 * @param prefix - Display prefix (should come from config.display.id_prefix; defaults to 'tbd' as fallback)
 * @throws Error if mapping is missing or ID not found in mapping
 */
export function formatDisplayId(
  internalId: InternalIssueId | string,
  mapping: IdMapping,
  prefix = 'tbd',
): DisplayIssueId {
  // Extract the ULID portion
  const ulidPart = extractUlidFromInternalId(internalId);

  // Get short ID from mapping
  const shortId = mapping.ulidToShort.get(ulidPart);
  if (!shortId) {
    throw new Error(
      `No short ID mapping found for internal ID: ${internalId}. ` +
        `This is a bug - all issues must have a short ID mapping.`,
    );
  }

  return `${prefix}-${shortId}` as DisplayIssueId;
}

/**
 * Format an ID for debug output, showing both public and internal IDs.
 *
 * @param internalId - The internal ID (is-{ulid})
 * @param mapping - ID mapping for short ID lookup
 * @param prefix - Display prefix (should come from config.display.id_prefix; defaults to 'tbd' as fallback)
 */
export function formatDebugId(
  internalId: InternalIssueId | string,
  mapping: IdMapping,
  prefix = 'tbd',
): string {
  const displayId = formatDisplayId(internalId, mapping, prefix);
  return `${displayId} (${internalId})`;
}
