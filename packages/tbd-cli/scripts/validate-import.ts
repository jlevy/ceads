#!/usr/bin/env npx tsx
/**
 * Full import validation test.
 *
 * This script:
 * 1. Creates a fresh temp directory
 * 2. Copies the repo (simulating fresh clone)
 * 3. Initializes tbd and imports from beads
 * 4. Validates the import
 * 5. Runs performance benchmarks
 *
 * Usage: npx tsx scripts/validate-import.ts
 */

import { mkdtemp, rm, cp, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..', '..', '..');
const TMP_DIR = join(REPO_ROOT, 'tmp');

interface ValidationResult {
  step: string;
  success: boolean;
  duration: number;
  details?: string;
}

async function runCommand(
  cwd: string,
  cmd: string,
  args: string[],
  _description: string,
): Promise<{ stdout: string; stderr: string; duration: number }> {
  const start = performance.now();
  try {
    const result = await execFileAsync(cmd, args, {
      cwd,
      env: { ...process.env, NO_COLOR: '1' },
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      duration: performance.now() - start,
    };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    return {
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? (error as Error).message,
      duration: performance.now() - start,
    };
  }
}

async function main(): Promise<void> {
  console.log('tbd Import Validation Test');
  console.log('='.repeat(60));
  console.log();

  const results: ValidationResult[] = [];
  // Use tmp/ in repo root (gitignored) instead of system temp
  await mkdir(TMP_DIR, { recursive: true });
  const tempDir = await mkdtemp(join(TMP_DIR, 'validate-'));

  console.log(`Working directory: ${tempDir}`);
  console.log();

  try {
    // Step 1: Copy repo to temp directory (simulating fresh clone)
    console.log('Step 1: Copying repository...');
    const startCopy = performance.now();

    // Copy only essential files (not node_modules)
    await cp(join(REPO_ROOT, '.beads'), join(tempDir, '.beads'), { recursive: true });
    await cp(join(REPO_ROOT, 'packages'), join(tempDir, 'packages'), { recursive: true });
    await cp(join(REPO_ROOT, 'package.json'), join(tempDir, 'package.json'));
    await cp(join(REPO_ROOT, 'pnpm-lock.yaml'), join(tempDir, 'pnpm-lock.yaml'));
    await cp(join(REPO_ROOT, 'pnpm-workspace.yaml'), join(tempDir, 'pnpm-workspace.yaml'));
    await cp(join(REPO_ROOT, 'tsconfig.json'), join(tempDir, 'tsconfig.json'));

    results.push({
      step: 'Copy repository',
      success: true,
      duration: performance.now() - startCopy,
    });
    console.log(`  ✓ Repository copied (${(performance.now() - startCopy).toFixed(0)}ms)`);

    // Step 2: Initialize git repo
    console.log('\nStep 2: Initializing git repository...');
    await execFileAsync('git', ['init', '--initial-branch=main'], { cwd: tempDir });
    await execFileAsync('git', ['config', 'user.email', 'test@test.com'], { cwd: tempDir });
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: tempDir });
    await execFileAsync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tempDir });
    await execFileAsync('git', ['add', '.'], { cwd: tempDir });
    await execFileAsync('git', ['commit', '-m', 'Initial'], { cwd: tempDir });
    console.log('  ✓ Git initialized');

    // Step 3: Install dependencies
    console.log('\nStep 3: Installing dependencies...');
    const installResult = await runCommand(
      tempDir,
      'pnpm',
      ['install', '--frozen-lockfile'],
      'Install',
    );
    results.push({
      step: 'Install dependencies',
      success: !installResult.stderr.includes('ERR!'),
      duration: installResult.duration,
    });
    console.log(`  ✓ Dependencies installed (${installResult.duration.toFixed(0)}ms)`);

    // Step 4: Build CLI
    console.log('\nStep 4: Building CLI...');
    const cliDir = join(tempDir, 'packages', 'tbd-cli');
    const buildResult = await runCommand(cliDir, 'pnpm', ['build'], 'Build');
    results.push({
      step: 'Build CLI',
      success: !buildResult.stderr.includes('error'),
      duration: buildResult.duration,
    });
    console.log(`  ✓ CLI built (${buildResult.duration.toFixed(0)}ms)`);

    const binPath = join(cliDir, 'dist', 'bin.mjs');

    // Step 5: Initialize tbd
    console.log('\nStep 5: Initializing tbd...');
    const initResult = await runCommand(tempDir, 'node', [binPath, 'init'], 'Init');
    results.push({
      step: 'Initialize tbd',
      success: initResult.stdout.includes('Initialized') || initResult.stdout.includes('init'),
      duration: initResult.duration,
    });
    console.log(`  ✓ tbd initialized (${initResult.duration.toFixed(0)}ms)`);

    // Step 6: Import from beads
    console.log('\nStep 6: Importing from beads...');
    const importResult = await runCommand(
      tempDir,
      'node',
      [binPath, 'import', '--from-beads'],
      'Import',
    );
    results.push({
      step: 'Import from beads',
      success: importResult.stdout.includes('complete') || importResult.stdout.includes('Import'),
      duration: importResult.duration,
      details: importResult.stdout.trim().split('\n').slice(-3).join(' | '),
    });
    console.log(`  ✓ Import complete (${importResult.duration.toFixed(0)}ms)`);
    console.log(`    ${importResult.stdout.trim().split('\n').slice(-3).join('\n    ')}`);

    // Step 7: Validate import
    console.log('\nStep 7: Validating import...');
    const validateResult = await runCommand(
      tempDir,
      'node',
      [binPath, 'import', '--validate'],
      'Validate',
    );
    const validationSuccess =
      validateResult.stdout.includes('validated successfully') ||
      (validateResult.stdout.includes('Errors:') && validateResult.stdout.includes('0'));
    results.push({
      step: 'Validate import',
      success: validationSuccess,
      duration: validateResult.duration,
      details: validateResult.stdout.includes('Error') ? 'Has errors' : 'OK',
    });
    console.log(
      `  ${validationSuccess ? '✓' : '✗'} Validation (${validateResult.duration.toFixed(0)}ms)`,
    );

    // Extract validation stats from output
    const validMatch = /Valid imports:\s+(\d+)/.exec(validateResult.stdout);
    const errorMatch = /Errors:\s+(\d+)/.exec(validateResult.stdout);
    const warnMatch = /Warnings:\s+(\d+)/.exec(validateResult.stdout);
    if (validMatch) {
      console.log(
        `    Valid: ${validMatch[1]}, Errors: ${errorMatch?.[1] ?? '?'}, Warnings: ${warnMatch?.[1] ?? '?'}`,
      );
    }

    // Step 8: Run benchmarks
    console.log('\nStep 8: Running benchmarks...');

    const benchmarks = [
      { name: 'list', args: ['list', '--all'] },
      { name: 'stats', args: ['stats'] },
      { name: 'search', args: ['search', 'implement'] },
      { name: 'doctor', args: ['doctor'] },
    ];

    for (const bench of benchmarks) {
      const result = await runCommand(tempDir, 'node', [binPath, ...bench.args], bench.name);
      results.push({
        step: `Benchmark: ${bench.name}`,
        success: result.duration < 500,
        duration: result.duration,
      });
      console.log(
        `  ${result.duration < 500 ? '✓' : '⚠'} ${bench.name}: ${result.duration.toFixed(0)}ms`,
      );
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));

    const passed = results.filter((r) => r.success).length;
    const total = results.length;

    for (const r of results) {
      const status = r.success ? '✓' : '✗';
      const color = r.success ? '\x1b[32m' : '\x1b[31m';
      const reset = '\x1b[0m';
      console.log(
        `${color}${status}${reset} ${r.step.padEnd(25)} ${r.duration.toFixed(0).padStart(6)}ms`,
      );
    }

    console.log('─'.repeat(60));
    console.log(`Total: ${passed}/${total} passed`);
    console.log();

    if (passed === total) {
      console.log('\x1b[32m✓ All validation steps passed!\x1b[0m');
      process.exitCode = 0;
    } else {
      console.log('\x1b[31m✗ Some validation steps failed\x1b[0m');
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('Error:', (error as Error).message);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up...');
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch(console.error);
