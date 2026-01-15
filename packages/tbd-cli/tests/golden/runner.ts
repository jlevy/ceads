/**
 * Golden test runner infrastructure.
 *
 * Captures CLI output and compares against golden files.
 * Normalizes unstable fields (ULIDs, timestamps) for deterministic comparison.
 */

import { execSync } from 'node:child_process';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Package directory (where pnpm commands run from)
const PACKAGE_DIR = join(__dirname, '..', '..');

// Pattern to match ISO8601 timestamps
const TIMESTAMP_PATTERN = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z/g;

/**
 * Result of running a CLI command.
 */
export interface CommandResult {
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Golden test scenario - a sequence of commands and their outputs.
 */
export interface GoldenScenario {
  name: string;
  description: string;
  results: CommandResult[];
  files?: Record<string, string>;
}

/**
 * Normalize unstable fields in output.
 * Replaces ULIDs, timestamps, and temp paths with placeholders.
 */
export function normalizeOutput(output: string): string {
  let normalized = output;

  // Replace ULIDs with placeholder
  // Match both is-[ulid] and bd-[ulid] patterns
  normalized = normalized.replace(/\b(is-)[0-9a-z]{26}\b/g, '$1[ULID]');
  normalized = normalized.replace(/\b(bd-)[0-9a-z]{26}\b/g, '$1[ULID]');

  // Replace standalone ULIDs (in JSON output)
  normalized = normalized.replace(/"[0-9a-z]{26}"/g, '"[ULID]"');

  // Replace timestamps with placeholder
  normalized = normalized.replace(TIMESTAMP_PATTERN, '[TIMESTAMP]');

  // Replace temp directory paths (cross-platform)
  // Linux: /tmp/tbd-golden-XXXXXXXX
  // macOS: /private/var/folders/.../tbd-golden-XXXXXXXX or /var/folders/.../tbd-golden-XXXXXXXX
  // Windows: C:\Users\...\tbd-golden-XXXXXXXX
  normalized = normalized.replace(/\/tmp\/tbd-golden-[0-9a-f]+/g, '/tmp/tbd-golden-[TEMP]');
  normalized = normalized.replace(
    /\/(?:private\/)?var\/folders\/[^/]+\/[^/]+\/T\/tbd-golden-[0-9a-f]+/g,
    '/tmp/tbd-golden-[TEMP]',
  );
  normalized = normalized.replace(
    /[A-Z]:\\[^"]+\\tbd-golden-[0-9a-f]+/gi,
    '/tmp/tbd-golden-[TEMP]',
  );

  return normalized;
}

/**
 * Normalize file content for comparison.
 */
export function normalizeFileContent(content: string): string {
  let normalized = content;

  // Replace ULIDs in YAML
  normalized = normalized.replace(/\bid: is-[0-9a-z]{26}\b/g, 'id: is-[ULID]');
  normalized = normalized.replace(/\btarget: is-[0-9a-z]{26}\b/g, 'target: is-[ULID]');
  normalized = normalized.replace(/\bparent_id: is-[0-9a-z]{26}\b/g, 'parent_id: is-[ULID]');

  // Replace timestamps
  normalized = normalized.replace(TIMESTAMP_PATTERN, '[TIMESTAMP]');

  return normalized;
}

/**
 * Run a CLI command using npx tsx from the package directory.
 * Uses the TBD_DATA_DIR env var to point to the test directory (if implemented),
 * or changes into the test directory.
 */
export function runCommand(
  workDir: string,
  _command: string,
  args: string[],
): Promise<CommandResult> {
  const cliPath = join(PACKAGE_DIR, 'src', 'cli', 'bin.ts');

  // Escape arguments for shell
  const escapedArgs = args.map((arg) => {
    if (arg.includes(' ') || arg.includes('"')) {
      return `"${arg.replace(/"/g, '\\"')}"`;
    }
    return arg;
  });

  const cmd = `npx tsx "${cliPath}" ${escapedArgs.join(' ')}`;

  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    stdout = execSync(cmd, {
      cwd: workDir,
      encoding: 'utf-8',
      env: {
        ...process.env,
        NO_COLOR: '1',
        FORCE_COLOR: '0',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      'stdout' in error &&
      'stderr' in error
    ) {
      const execError = error as { status: number; stdout: string; stderr: string };
      exitCode = execError.status ?? 1;
      stdout = execError.stdout ?? '';
      stderr = execError.stderr ?? '';
    } else {
      exitCode = 1;
      stderr = error instanceof Error ? error.message : String(error);
    }
  }

  // Normalize args (replace ULIDs in issue IDs passed as arguments)
  const normalizedArgs = args.map((arg) => normalizeOutput(arg));

  return Promise.resolve({
    command: 'tbd',
    args: normalizedArgs,
    exitCode,
    stdout: normalizeOutput(stdout),
    stderr: normalizeOutput(stderr),
  });
}

/**
 * Create a temporary test directory with tbd initialized.
 */
export async function createTestDir(): Promise<string> {
  const testDir = join(tmpdir(), `tbd-golden-${randomBytes(4).toString('hex')}`);
  await mkdir(join(testDir, '.tbd-sync', 'issues'), { recursive: true });
  await mkdir(join(testDir, '.tbd'), { recursive: true });
  return testDir;
}

/**
 * Clean up test directory.
 */
export async function cleanupTestDir(testDir: string): Promise<void> {
  await rm(testDir, { recursive: true, force: true });
}

/**
 * Get path to the CLI entry point.
 */
export function getCliPath(): string {
  return join(__dirname, '..', '..', 'src', 'cli', 'bin.ts');
}

/**
 * Read a golden file.
 */
export async function readGoldenFile(name: string): Promise<GoldenScenario | null> {
  const goldenPath = join(__dirname, 'scenarios', `${name}.yaml`);
  try {
    const content = await readFile(goldenPath, 'utf-8');
    return parseYaml(content) as GoldenScenario;
  } catch {
    return null;
  }
}

/**
 * Write a golden file.
 */
export async function writeGoldenFile(name: string, scenario: GoldenScenario): Promise<void> {
  const goldenPath = join(__dirname, 'scenarios', `${name}.yaml`);
  await mkdir(dirname(goldenPath), { recursive: true });
  const content = stringifyYaml(scenario, {
    lineWidth: 120,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
  });
  await writeFile(goldenPath, content);
}

/**
 * Compare actual vs expected scenario.
 * Returns null if they match, or a diff description if they differ.
 */
export function compareScenarios(actual: GoldenScenario, expected: GoldenScenario): string | null {
  const diffs: string[] = [];

  if (actual.results.length !== expected.results.length) {
    diffs.push(
      `Result count mismatch: actual=${actual.results.length}, expected=${expected.results.length}`,
    );
  }

  const minLen = Math.min(actual.results.length, expected.results.length);
  for (let i = 0; i < minLen; i++) {
    const a = actual.results[i]!;
    const e = expected.results[i]!;

    if (a.exitCode !== e.exitCode) {
      diffs.push(`[${i}] Exit code: actual=${a.exitCode}, expected=${e.exitCode}`);
    }

    if (a.stdout !== e.stdout) {
      diffs.push(`[${i}] stdout differs:\n--- expected\n${e.stdout}\n+++ actual\n${a.stdout}`);
    }

    if (a.stderr !== e.stderr) {
      diffs.push(`[${i}] stderr differs:\n--- expected\n${e.stderr}\n+++ actual\n${a.stderr}`);
    }
  }

  return diffs.length > 0 ? diffs.join('\n\n') : null;
}

/**
 * Check if we should update golden files.
 */
export function shouldUpdateGolden(): boolean {
  return process.env.UPDATE_GOLDEN === '1' || process.env.UPDATE_GOLDEN === 'true';
}

/**
 * Read file from test directory with normalized content.
 */
export async function readTestFile(testDir: string, relativePath: string): Promise<string> {
  const content = await readFile(join(testDir, relativePath), 'utf-8');
  return normalizeFileContent(content);
}

/**
 * List issue files in test directory.
 */
export async function listTestIssueFiles(testDir: string): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  const issuesDir = join(testDir, '.tbd-sync', 'issues');
  try {
    const files = await readdir(issuesDir);
    return files.filter((f) => f.endsWith('.md')).sort();
  } catch {
    return [];
  }
}
