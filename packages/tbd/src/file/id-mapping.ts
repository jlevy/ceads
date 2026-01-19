/**
 * ID mapping management for short public IDs.
 *
 * Maps 4-char base36 short IDs to 26-char ULIDs.
 * Stored in .tbd/data-sync/mappings/ids.yml
 *
 * See: tbd-design.md §2.5 ID Generation
 */

import { readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { writeFile } from 'atomically';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import {
  generateShortId,
  extractUlidFromInternalId,
  makeInternalId,
  isInternalId,
  extractShortId,
} from '../lib/ids.js';
import { naturalSort } from '../lib/sort.js';

/**
 * ID mapping from short ID to ULID.
 * Format in ids.yml:
 *   a7k2: 01hx5zzkbkactav9wevgemmvrz
 *   b3m9: 01hx5zzkbkbctav9wevgemmvrz
 */
export interface IdMapping {
  shortToUlid: Map<string, string>;
  ulidToShort: Map<string, string>;
}

/**
 * Get the path to the ids.yml mapping file.
 */
function getMappingPath(baseDir: string): string {
  return join(baseDir, 'mappings', 'ids.yml');
}

/**
 * Load the ID mapping from disk.
 * Returns empty mapping if file doesn't exist.
 */
export async function loadIdMapping(baseDir: string): Promise<IdMapping> {
  const filePath = getMappingPath(baseDir);

  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    // File doesn't exist - return empty mapping
    return {
      shortToUlid: new Map(),
      ulidToShort: new Map(),
    };
  }

  const data = (parseYaml(content) as Record<string, string>) || {};

  const shortToUlid = new Map<string, string>();
  const ulidToShort = new Map<string, string>();

  for (const [shortId, ulid] of Object.entries(data)) {
    shortToUlid.set(shortId, ulid);
    ulidToShort.set(ulid, shortId);
  }

  return { shortToUlid, ulidToShort };
}

/**
 * Save the ID mapping to disk.
 */
export async function saveIdMapping(baseDir: string, mapping: IdMapping): Promise<void> {
  const filePath = getMappingPath(baseDir);

  // Ensure directory exists
  await mkdir(dirname(filePath), { recursive: true });

  // Convert Map to sorted object for deterministic output
  // Use natural sort so "1", "2", "10" sorts correctly (not "1", "10", "2")
  const data: Record<string, string> = {};
  const sortedKeys = naturalSort(Array.from(mapping.shortToUlid.keys()));
  for (const key of sortedKeys) {
    data[key] = mapping.shortToUlid.get(key)!;
  }

  const content = stringifyYaml(data);
  await writeFile(filePath, content);
}

/**
 * Calculate the optimal short ID length based on existing ID count.
 *
 * At 50K issues, switches from 4-char to 5-char IDs to keep
 * collision probability low (~3% per attempt with 4 chars at 50K).
 *
 * With 10 retries per length, actual failure probability is astronomically low.
 */
export function calculateOptimalLength(existingCount: number): number {
  return existingCount < 50_000 ? 4 : 5;
}

/**
 * Generate a unique short ID that doesn't collide with existing ones.
 *
 * Calculates optimal length (4 or 5 chars) based on existing ID count,
 * then retries with the next length if collisions occur.
 *
 * @returns The new short ID
 * @throws If unable to generate a unique ID after max attempts
 */
export function generateUniqueShortId(mapping: IdMapping): string {
  const ATTEMPTS_PER_LENGTH = 10;
  const existingCount = mapping.shortToUlid.size;
  const optimalLength = calculateOptimalLength(existingCount);

  // Try optimal length first, then fall back to longer if needed
  for (const length of [optimalLength, optimalLength + 1]) {
    for (let attempt = 0; attempt < ATTEMPTS_PER_LENGTH; attempt++) {
      const shortId = generateShortId(length);
      if (!mapping.shortToUlid.has(shortId)) {
        return shortId;
      }
    }
  }

  throw new Error(
    `Failed to generate unique short ID after 20 attempts with ${existingCount} existing IDs. ` +
      `This should be extremely rare - please report if you see this error.`,
  );
}

/**
 * Register a new ID mapping.
 * @param ulid - The ULID (without is- prefix)
 * @param shortId - The short ID (4 chars)
 */
export function addIdMapping(mapping: IdMapping, ulid: string, shortId: string): void {
  mapping.shortToUlid.set(shortId, ulid);
  mapping.ulidToShort.set(ulid, shortId);
}

/**
 * Get the short ID for a ULID.
 * @param ulid - The ULID (without is- prefix)
 * @returns The short ID, or undefined if not found
 */
export function getShortId(mapping: IdMapping, ulid: string): string | undefined {
  return mapping.ulidToShort.get(ulid);
}

/**
 * Get the ULID for a short ID.
 * @param shortId - The short ID
 * @returns The ULID (without is- prefix), or undefined if not found
 */
export function getUlid(mapping: IdMapping, shortId: string): string | undefined {
  return mapping.shortToUlid.get(shortId);
}

/**
 * Check if a short ID exists in the mapping.
 */
export function hasShortId(mapping: IdMapping, shortId: string): boolean {
  return mapping.shortToUlid.has(shortId);
}

/**
 * Create a short ID mapping for a new internal ID.
 * Generates a unique short ID and registers it in the mapping.
 *
 * @param internalId - The internal ID (is-{ulid})
 * @param mapping - The ID mapping to update
 * @returns The generated short ID
 */
export function createShortIdMapping(internalId: string, mapping: IdMapping): string {
  // Extract ULID from internal ID (remove prefix)
  const ulid = extractUlidFromInternalId(internalId);

  // Check if already mapped
  const existing = mapping.ulidToShort.get(ulid);
  if (existing) {
    return existing;
  }

  // Generate unique short ID
  const shortId = generateUniqueShortId(mapping);

  // Register mapping
  addIdMapping(mapping, ulid, shortId);

  return shortId;
}

/**
 * Resolve any ID input to an internal ID ({prefix}-{ulid}).
 *
 * Handles:
 * - Internal IDs: {prefix}-{ulid} -> {prefix}-{ulid}
 * - Short IDs: a7k2 -> {prefix}-{ulid from mapping}
 * - Prefixed short IDs: bd-a7k2 -> {prefix}-{ulid from mapping}
 *
 * @param input - The ID input (short ID, prefixed short ID, or internal ID)
 * @param mapping - The ID mapping for short ID resolution
 * @returns The internal ID ({prefix}-{ulid})
 * @throws If the short ID is not found in the mapping
 */
export function resolveToInternalId(input: string, mapping: IdMapping): string {
  const lower = input.toLowerCase();

  // If it's already an internal ID, return it
  if (isInternalId(lower)) {
    return lower;
  }

  // Extract the short ID portion (strips any prefix like "bd-" or "is-")
  const shortId = extractShortId(lower);

  // If it's a full ULID (26 chars), it might be a bare internal ID
  if (shortId.length === 26 && /^[0-9a-z]{26}$/.test(shortId)) {
    return makeInternalId(shortId);
  }

  // Must be a short ID - look it up in the mapping
  const ulid = mapping.shortToUlid.get(shortId);
  if (!ulid) {
    throw new Error(`Unknown issue ID: ${input}. ` + `Short ID "${shortId}" not found in mapping.`);
  }

  return makeInternalId(ulid);
}
