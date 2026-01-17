/**
 * Golden tests for tbd CLI.
 *
 * These tests run actual CLI commands and compare output against golden files.
 * Use UPDATE_GOLDEN=1 to regenerate golden files after intentional changes.
 *
 * Note: These tests spawn processes and are slower than unit tests.
 * They're designed to verify end-to-end CLI behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  runCommand,
  createTestDir,
  createUninitializedTestDir,
  cleanupTestDir,
  getCliPath,
  readGoldenFile,
  writeGoldenFile,
  compareScenarios,
  shouldUpdateGolden,
  listTestIssueFiles,
  type GoldenScenario,
  type CommandResult,
} from './runner.js';

// Timeout for tests that run multiple CLI commands
const GOLDEN_TEST_TIMEOUT = 60000; // 60 seconds

describe('golden tests', () => {
  let testDir: string;
  let cliPath: string;

  beforeEach(async () => {
    testDir = await createTestDir();
    cliPath = getCliPath();
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  /**
   * Helper to run CLI and collect results.
   */
  async function runCli(...args: string[]): Promise<CommandResult> {
    return runCommand(testDir, cliPath, args);
  }

  /**
   * Helper to verify or update golden file.
   */
  async function verifyGolden(name: string, scenario: GoldenScenario): Promise<void> {
    if (shouldUpdateGolden()) {
      await writeGoldenFile(name, scenario);
      return;
    }

    const expected = await readGoldenFile(name);
    if (!expected) {
      throw new Error(
        `Golden file not found: ${name}.yaml\nRun with UPDATE_GOLDEN=1 to create it.`,
      );
    }

    const diff = compareScenarios(scenario, expected);
    if (diff) {
      throw new Error(`Golden test failed: ${name}\n${diff}`);
    }
  }

  describe('core workflow', () => {
    it(
      'create, list, and show issue',
      async () => {
        const results: CommandResult[] = [];

        // Create an issue
        results.push(await runCli('create', 'Test task', '-t', 'task', '-p', '2', '-l', 'test'));

        // List issues
        results.push(await runCli('list', '--json'));

        // Get issue ID and show it
        const issueFiles = await listTestIssueFiles(testDir);
        if (issueFiles.length > 0) {
          const issueId = issueFiles[0]!.replace('.md', '');
          results.push(await runCli('show', issueId, '--json'));
        }

        const scenario: GoldenScenario = {
          name: 'core-workflow',
          description: 'Create, list, and show an issue',
          results,
        };

        await verifyGolden('core-workflow', scenario);
      },
      GOLDEN_TEST_TIMEOUT,
    );

    it(
      'update and close issue',
      async () => {
        const results: CommandResult[] = [];

        // Create an issue
        results.push(await runCli('create', 'Issue to modify', '-t', 'bug'));

        // Get the issue ID
        const issueFiles = await listTestIssueFiles(testDir);
        const issueId = issueFiles[0]!.replace('.md', '');

        // Update the issue
        results.push(await runCli('update', issueId, '--priority', '0', '--title', 'Updated bug'));

        // Close the issue
        results.push(await runCli('close', issueId, '--reason', 'fixed'));

        // Show final state
        results.push(await runCli('show', issueId, '--json'));

        const scenario: GoldenScenario = {
          name: 'update-close',
          description: 'Update and close an issue',
          results,
        };

        await verifyGolden('update-close', scenario);
      },
      GOLDEN_TEST_TIMEOUT,
    );
  });

  describe('error handling', () => {
    it(
      'handles uninitialized tbd list',
      async () => {
        // Create uninitialized directory (no .tbd folder)
        const uninitDir = await createUninitializedTestDir();

        try {
          const results: CommandResult[] = [];

          // Try to list issues in uninitialized directory
          results.push(await runCommand(uninitDir, cliPath, ['list']));

          const scenario: GoldenScenario = {
            name: 'uninitialized-list',
            description: 'Error handling for list command in uninitialized directory',
            results,
          };

          await verifyGolden('uninitialized-list', scenario);
        } finally {
          await cleanupTestDir(uninitDir);
        }
      },
      GOLDEN_TEST_TIMEOUT,
    );

    it(
      'handles missing issue',
      async () => {
        const results: CommandResult[] = [];

        // Try to show non-existent issue
        results.push(await runCli('show', 'is-00000000000000000000000000'));

        const scenario: GoldenScenario = {
          name: 'missing-issue',
          description: 'Error handling for non-existent issue',
          results,
        };

        await verifyGolden('missing-issue', scenario);
      },
      GOLDEN_TEST_TIMEOUT,
    );

    it(
      'validates input',
      async () => {
        const results: CommandResult[] = [];

        // Invalid priority
        results.push(await runCli('create', 'Test', '-p', '999'));

        // Missing title
        results.push(await runCli('create'));

        const scenario: GoldenScenario = {
          name: 'input-validation',
          description: 'Error handling for invalid input',
          results,
        };

        await verifyGolden('input-validation', scenario);
      },
      GOLDEN_TEST_TIMEOUT,
    );
  });

  describe('dry-run mode', () => {
    it(
      'shows action without executing',
      async () => {
        const results: CommandResult[] = [];

        // Dry-run create
        results.push(await runCli('create', 'Test issue', '-t', 'task', '--dry-run'));

        // Verify no issue was created
        const issueFiles = await listTestIssueFiles(testDir);
        expect(issueFiles).toHaveLength(0);

        const scenario: GoldenScenario = {
          name: 'dry-run',
          description: 'Dry-run mode shows actions without executing',
          results,
        };

        await verifyGolden('dry-run', scenario);
      },
      GOLDEN_TEST_TIMEOUT,
    );
  });

  describe('status command', () => {
    it(
      'shows repository status',
      async () => {
        const results: CommandResult[] = [];

        // Create an issue first
        results.push(await runCli('create', 'Test issue', '-t', 'task'));

        // Get status
        results.push(await runCli('status', '--json'));

        const scenario: GoldenScenario = {
          name: 'status-command',
          description: 'Show repository status and orientation',
          results,
        };

        await verifyGolden('status-command', scenario);
      },
      GOLDEN_TEST_TIMEOUT,
    );
  });
});
