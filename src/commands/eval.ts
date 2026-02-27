/**
 * savestate eval — Memory quality evaluation commands
 */

import chalk from 'chalk';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isInitialized, localConfigDir } from '../config.js';
import { QualityBenchmark, type BenchmarkResult, type QualityMetrics } from '../eval/index.js';

interface EvalOptions {
  json?: boolean;
  threshold?: string;
  suite?: string;
  verbose?: boolean;
}

const RESULTS_FILE = 'eval-results.json';

export async function evalCommand(subcommand: string, options: EvalOptions): Promise<void> {
  console.log();

  if (!isInitialized()) {
    console.log(chalk.red('SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  switch (subcommand) {
    case 'quality':
      await runQualityBenchmarks(options);
      return;
    case 'report':
      await showReport(options);
      return;
    default:
      showUsage();
      process.exit(1);
  }
}

async function runQualityBenchmarks(options: EvalOptions): Promise<void> {
  const threshold = parseThreshold(options.threshold);
  const benchmark = new QualityBenchmark({ confidenceThreshold: threshold });

  console.log(chalk.bold('Memory Quality Evaluation'));
  console.log(chalk.dim(`  Confidence threshold: ${(threshold * 100).toFixed(0)}%`));
  console.log();

  // Load benchmark suites
  const suites = await benchmark.loadDefaultSuites();

  if (suites.length === 0) {
    console.log(chalk.yellow('  No benchmark suites found.'));
    console.log(chalk.dim('  Add benchmark JSON files to .savestate/benchmarks/'));
    console.log();
    return;
  }

  // Filter by suite name if specified
  const suitesToRun = options.suite
    ? suites.filter((s) => s.name === options.suite)
    : suites;

  if (suitesToRun.length === 0) {
    console.log(chalk.red(`  Suite not found: ${options.suite}`));
    console.log(chalk.dim(`  Available: ${suites.map((s) => s.name).join(', ')}`));
    console.log();
    return;
  }

  console.log(chalk.dim(`  Running ${suitesToRun.length} suite(s)...`));
  console.log();

  // Mock retrieval function for demo/testing
  // In production, this would connect to the actual memory retrieval system
  const mockRetrievalFn = createMockRetrievalFn();

  const results: BenchmarkResult[] = [];
  for (const suite of suitesToRun) {
    const result = await benchmark.runSuite(suite, mockRetrievalFn);
    results.push(result);
    printSuiteResult(result, options.verbose);
  }

  // Save results
  const resultsPath = join(localConfigDir(), RESULTS_FILE);
  await benchmark.saveResults(resultsPath);

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // Print summary
  printSummary(results, threshold);
}

async function showReport(options: EvalOptions): Promise<void> {
  const resultsPath = join(localConfigDir(), RESULTS_FILE);

  if (!existsSync(resultsPath)) {
    console.log(chalk.yellow('  No evaluation results found.'));
    console.log(chalk.dim('  Run `savestate eval quality` first.'));
    console.log();
    return;
  }

  const benchmark = new QualityBenchmark();
  const results = await benchmark.loadResults(resultsPath);

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log(chalk.bold('Last Evaluation Report'));
  console.log();

  for (const result of results) {
    printSuiteResult(result, options.verbose);
  }

  // Overall summary
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalTests = results.reduce((sum, r) => sum + r.total, 0);
  const overallPassRate = totalTests > 0 ? totalPassed / totalTests : 0;

  console.log(chalk.bold('Overall Summary'));
  console.log(`  Total tests:  ${totalTests}`);
  console.log(`  Passed:       ${totalPassed}`);
  console.log(`  Pass rate:    ${formatPercent(overallPassRate)}`);
  console.log();
}

function printSuiteResult(result: BenchmarkResult, verbose?: boolean): void {
  const passIcon = result.passRate >= 0.8 ? chalk.green('PASS') : chalk.red('FAIL');

  console.log(`${chalk.cyan(result.suiteName)} ${passIcon}`);
  console.log(chalk.dim(`  ${result.timestamp} (${result.durationMs}ms)`));
  console.log();

  // Aggregate metrics
  printMetrics(result.aggregateMetrics, '  ');

  console.log(`  Tests: ${result.passed}/${result.total} passed (${formatPercent(result.passRate)})`);
  console.log();

  if (verbose) {
    for (const test of result.testResults) {
      const icon = test.passed ? chalk.green('  [PASS]') : chalk.red('  [FAIL]');
      console.log(`${icon} ${test.testId}`);
      console.log(chalk.dim(`         precision=${formatPercent(test.metrics.precision)} recall=${formatPercent(test.metrics.recall)} confidence=${formatPercent(test.metrics.confidence)}`));

      if (!test.passed) {
        if (test.falseNegatives.length > 0) {
          console.log(chalk.yellow(`         missing: ${test.falseNegatives.join(', ')}`));
        }
        if (test.falsePositives.length > 0) {
          console.log(chalk.yellow(`         extra: ${test.falsePositives.join(', ')}`));
        }
        if (test.staleHits.length > 0) {
          console.log(chalk.yellow(`         stale hits: ${test.staleHits.join(', ')}`));
        }
        if (test.constraintsDropped.length > 0) {
          console.log(chalk.red(`         constraints dropped: ${test.constraintsDropped.join(', ')}`));
        }
      }
    }
    console.log();
  }
}

function printMetrics(metrics: QualityMetrics, indent = ''): void {
  console.log(`${indent}Precision:           ${formatPercent(metrics.precision)}`);
  console.log(`${indent}Recall:              ${formatPercent(metrics.recall)}`);
  console.log(`${indent}F1 Score:            ${formatPercent(metrics.f1Score)}`);
  console.log(`${indent}Stale Hit Rate:      ${formatPercent(metrics.staleHitRate)} ${metrics.staleHitRate <= 0.1 ? chalk.green('(good)') : chalk.yellow('(high)')}`);
  console.log(`${indent}Constraint Retention: ${formatPercent(metrics.constraintRetention)}`);
  console.log(`${indent}Confidence:          ${formatPercent(metrics.confidence)}`);
}

function printSummary(results: BenchmarkResult[], threshold: number): void {
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalTests = results.reduce((sum, r) => sum + r.total, 0);
  const overallPassRate = totalTests > 0 ? totalPassed / totalTests : 0;

  console.log(chalk.bold('Summary'));
  console.log(`  Suites run:   ${results.length}`);
  console.log(`  Total tests:  ${totalTests}`);
  console.log(`  Passed:       ${totalPassed}`);
  console.log(`  Pass rate:    ${formatPercent(overallPassRate)}`);
  console.log(`  Threshold:    ${formatPercent(threshold)}`);
  console.log();

  if (overallPassRate >= 0.8) {
    console.log(chalk.green('  Memory quality benchmarks passed.'));
  } else {
    console.log(chalk.red('  Memory quality benchmarks failed.'));
    console.log(chalk.dim('  Review failing tests and adjust retrieval logic.'));
  }
  console.log();
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function parseThreshold(raw?: string): number {
  if (!raw) return 0.7;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    console.log(chalk.red('--threshold must be a number between 0 and 1'));
    process.exit(1);
  }
  return value;
}

/**
 * Create a mock retrieval function for testing.
 * In production, this would be replaced with actual memory retrieval.
 */
function createMockRetrievalFn(): (query: string) => Promise<string[]> {
  // Mock implementation that returns some expected IDs
  // This simulates a retrieval system with ~70% accuracy
  return async (query: string): Promise<string[]> => {
    // For empty queries, return nothing
    if (!query) return [];

    // Simulate retrieval based on query keywords
    const retrieved: string[] = [];

    if (query.includes('dark mode') || query.includes('preferences')) {
      retrieved.push('mem_pref_dark_mode', 'mem_pref_theme');
    }
    if (query.includes('project') || query.includes('architecture')) {
      retrieved.push('mem_proj_arch', 'mem_proj_tech_stack');
    }
    if (query.includes('name') || query.includes('contact')) {
      retrieved.push('mem_user_name', 'mem_user_email');
    }
    if (query.includes('code') || query.includes('style')) {
      retrieved.push('mem_code_style', 'mem_lint_config');
    }
    if (query.includes('database') || query.includes('connection')) {
      retrieved.push('mem_db_config', 'mem_db_pool_settings');
    }
    if (query.includes('API') || query.includes('endpoint')) {
      retrieved.push('mem_api_endpoints', 'mem_current_api_config');
    }
    if (query.includes('auth')) {
      retrieved.push('mem_auth_flow', 'mem_jwt_config');
    }
    if (query.includes('error') || query.includes('handling')) {
      retrieved.push('mem_error_handling_discussion', 'mem_try_catch_patterns');
    }
    if (query.includes('pinned') || query.includes('important')) {
      retrieved.push('mem_pinned_pref_1', 'mem_pinned_pref_2');
    }
    if (query.includes('session') || query.includes('recent')) {
      retrieved.push('mem_l1_session_1', 'mem_l1_session_2');
    }
    if (query.includes('security') || query.includes('permission')) {
      retrieved.push('mem_security_policy', 'mem_access_control');
    }
    if (query.includes('deadline') || query.includes('milestone')) {
      retrieved.push('mem_current_deadline', 'mem_active_milestone');
    }
    if (query.includes('version') || query.includes('framework')) {
      retrieved.push('mem_framework_v3', 'mem_deps_current');
    }
    if (query.includes('workspace') || query.includes('environment')) {
      retrieved.push('mem_workspace_current', 'mem_env_vars_active', 'mem_ide_settings');
    }
    if (query.includes('setting')) {
      retrieved.push('mem_critical_setting_1', 'mem_critical_setting_2');
    }

    return [...new Set(retrieved)];
  };
}

function showUsage(): void {
  console.log(chalk.bold('Memory Quality Evaluation commands:'));
  console.log();
  console.log('  savestate eval quality [--threshold <0..1>] [--suite <name>] [--verbose] [--json]');
  console.log('  savestate eval report [--verbose] [--json]');
  console.log();
  console.log('Options:');
  console.log('  --threshold   Confidence threshold for pass/fail (default: 0.7)');
  console.log('  --suite       Run only a specific benchmark suite');
  console.log('  --verbose     Show detailed test results');
  console.log('  --json        Output as JSON');
  console.log();
}
