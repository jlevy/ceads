#!/usr/bin/env npx tsx
/**
 * Performance benchmark for tbd.
 *
 * Measures:
 * 1. Startup time (--version, --help) - pure CLI initialization cost
 * 2. Command performance with 5K issues - tests scaling behavior
 *
 * For detailed profiling analysis, see:
 * docs/project/research/current/research-cli-startup-performance.md
 *
 * Usage: pnpm bench
 */

import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Configuration
const ISSUE_COUNT = 5000;
const STARTUP_TARGET_MS = 100; // Target for --version, --help
const COMMAND_TARGET_MS = 500; // Target for commands with 5K issues

interface BenchResult {
  name: string;
  duration: number;
  target: number;
  passed: boolean;
}

async function setupRepo(dir: string): Promise<void> {
  // Initialize git repo
  await execFileAsync('git', ['init', '--initial-branch=main'], { cwd: dir });
  await execFileAsync('git', ['config', 'user.email', 'bench@test.com'], { cwd: dir });
  await execFileAsync('git', ['config', 'user.name', 'Benchmark'], { cwd: dir });
  await execFileAsync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir });

  // Create .tbd structure
  const tbdDir = join(dir, '.tbd');
  const issuesDir = join(tbdDir, 'issues');
  await mkdir(issuesDir, { recursive: true });

  // Write config
  await writeFile(
    join(tbdDir, 'config.yml'),
    `tbd_version: "0.1.0"
sync:
  branch: tbd-sync
  remote: origin
display:
  id_prefix: bd
settings:
  auto_sync: false
  index_enabled: true
`,
  );

  // Generate issues
  console.log(`Generating ${ISSUE_COUNT} issues...`);
  const now = new Date().toISOString();
  const statuses = ['open', 'closed', 'in_progress', 'blocked', 'deferred'];
  const kinds = ['bug', 'feature', 'task', 'epic', 'chore'];
  const labels = ['frontend', 'backend', 'api', 'database', 'security', 'performance', 'ux'];

  for (let i = 0; i < ISSUE_COUNT; i++) {
    const id = `is-${i.toString().padStart(26, '0')}`;
    const status = statuses[i % statuses.length];
    const kind = kinds[i % kinds.length];
    const priority = i % 5;
    const issueLabels = [labels[i % labels.length], labels[(i + 1) % labels.length]];

    const content = `---
type: is
id: ${id}
version: 1
title: "Test issue ${i}: Performance benchmark issue"
description: |
  This is a test issue for benchmarking purposes.
  It contains some description text to simulate real issues.
kind: ${kind}
status: ${status}
priority: ${priority}
assignee: null
labels:
  - ${issueLabels[0]}
  - ${issueLabels[1]}
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_by: benchmark
created_at: "${now}"
updated_at: "${now}"
closed_at: null
close_reason: null
---

## Notes

This is a benchmark issue for performance testing.
`;
    await writeFile(join(issuesDir, `${id}.md`), content);

    if ((i + 1) % 1000 === 0) {
      console.log(`  Created ${i + 1} issues...`);
    }
  }

  // Initial commit
  await execFileAsync('git', ['add', '.'], { cwd: dir });
  await execFileAsync('git', ['commit', '-m', 'Initial benchmark setup'], { cwd: dir });
}

async function runBenchmark(
  name: string,
  dir: string,
  args: string[],
  target: number,
  iterations = 3,
): Promise<BenchResult> {
  const binPath = join(process.cwd(), 'dist', 'bin.mjs');
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    try {
      await execFileAsync('node', [binPath, ...args], {
        cwd: dir,
        env: { ...process.env, NO_COLOR: '1' },
      });
    } catch {
      // Some commands may fail, that's ok for benchmarking
    }
    times.push(performance.now() - start);
  }

  // Use median to exclude outliers
  times.sort((a, b) => a - b);
  const duration = times[Math.floor(times.length / 2)] ?? 0;

  return {
    name,
    duration,
    target,
    passed: duration < target,
  };
}

async function main(): Promise<void> {
  console.log('tbd Performance Benchmark');
  console.log('='.repeat(50));
  console.log();

  // Create temp directory
  const tempDir = await mkdtemp(join(tmpdir(), 'tbd-bench-'));
  console.log(`Working directory: ${tempDir}`);
  console.log();

  try {
    // Setup repo with issues
    await setupRepo(tempDir);
    console.log();

    const results: BenchResult[] = [];

    console.log('Running benchmarks...');
    console.log();

    // Warm up (exclude from results)
    await runBenchmark('warmup', tempDir, ['--version'], STARTUP_TARGET_MS);

    // Startup benchmarks
    console.log(`Startup (target: <${STARTUP_TARGET_MS}ms):`);
    results.push(await runBenchmark('--version', tempDir, ['--version'], STARTUP_TARGET_MS));
    results.push(await runBenchmark('--help', tempDir, ['--help'], STARTUP_TARGET_MS));
    console.log();

    // Command benchmarks
    console.log(`Commands with ${ISSUE_COUNT} issues (target: <${COMMAND_TARGET_MS}ms):`);
    results.push(await runBenchmark('list --all', tempDir, ['list', '--all'], COMMAND_TARGET_MS));
    results.push(
      await runBenchmark(
        'list --status=open',
        tempDir,
        ['list', '--status', 'open'],
        COMMAND_TARGET_MS,
      ),
    );
    results.push(
      await runBenchmark('list --limit=10', tempDir, ['list', '--limit', '10'], COMMAND_TARGET_MS),
    );
    results.push(
      await runBenchmark(
        'show',
        tempDir,
        ['show', 'is-00000000000000000000000001'],
        COMMAND_TARGET_MS,
      ),
    );
    results.push(await runBenchmark('search', tempDir, ['search', 'benchmark'], COMMAND_TARGET_MS));
    results.push(await runBenchmark('stats', tempDir, ['stats'], COMMAND_TARGET_MS));
    results.push(await runBenchmark('status', tempDir, ['status'], COMMAND_TARGET_MS));
    results.push(await runBenchmark('doctor', tempDir, ['doctor'], COMMAND_TARGET_MS));

    // Print results
    console.log();
    console.log('Results:');
    console.log('-'.repeat(50));

    let allPassed = true;
    for (const result of results) {
      const status = result.passed ? '✓' : '✗';
      const color = result.passed ? '\x1b[32m' : '\x1b[31m';
      const reset = '\x1b[0m';
      console.log(
        `${color}${status}${reset} ${result.name.padEnd(20)} ${result.duration.toFixed(0).padStart(6)}ms`,
      );
      if (!result.passed) allPassed = false;
    }

    console.log('-'.repeat(50));

    // Summary statistics
    const startupResults = results.filter((r) => r.target === STARTUP_TARGET_MS);
    const commandResults = results.filter((r) => r.target === COMMAND_TARGET_MS);

    const startupAvg = startupResults.reduce((s, r) => s + r.duration, 0) / startupResults.length;
    const commandAvg = commandResults.reduce((s, r) => s + r.duration, 0) / commandResults.length;

    console.log(`Startup avg:  ${startupAvg.toFixed(0)}ms`);
    console.log(`Command avg:  ${commandAvg.toFixed(0)}ms`);
    console.log();

    if (allPassed) {
      console.log('\x1b[32m✓ All benchmarks passed!\x1b[0m');
    } else {
      console.log('\x1b[33m⚠ Some benchmarks exceeded target\x1b[0m');
    }
  } finally {
    console.log();
    console.log('Cleaning up...');
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch(console.error);
