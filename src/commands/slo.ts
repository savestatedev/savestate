/**
 * SLO CLI Commands
 *
 * CLI commands for monitoring memory freshness SLOs.
 * Implements Issue #108.
 */

import chalk from 'chalk';
import { loadConfig } from '../config.js';
import {
  loadSLOConfig,
  saveSLOConfig,
  validateSLOConfig,
  formatDuration,
  parseDuration,
  getSLOConfigValue,
  setSLOConfigValue,
  DEFAULT_SLO_CONFIG,
  formatSLOReport,
  generateSLOReport,
  evaluateNamespaceCompliance,
  type SLOConfig,
  type SLOComplianceStatus,
} from '../slo/index.js';
import { KnowledgeLane } from '../checkpoint/memory.js';
import { InMemoryCheckpointStorage } from '../checkpoint/storage/memory.js';
import type { Namespace } from '../checkpoint/types.js';

/**
 * Parse namespace string into Namespace object.
 */
function parseNamespace(ns: string): Namespace {
  const parts = ns.split(':');
  return {
    org_id: parts[0] ?? 'default',
    app_id: parts[1] ?? 'default',
    agent_id: parts[2] ?? 'default',
    user_id: parts[3],
  };
}

/**
 * SLO command handler.
 */
export async function sloCommand(
  subcommand: string,
  options: {
    namespace?: string;
    json?: boolean;
    set?: string;
    period?: string;
  },
): Promise<void> {
  switch (subcommand) {
    case 'status':
      await sloStatus(options);
      break;
    case 'report':
      await sloReport(options);
      break;
    case 'config':
      await sloConfig(options);
      break;
    default:
      console.log(chalk.red(`Unknown SLO subcommand: ${subcommand}`));
      console.log('Available subcommands: status, report, config');
      process.exit(1);
  }
}

/**
 * Show SLO compliance status for a namespace.
 */
async function sloStatus(options: { namespace?: string; json?: boolean }): Promise<void> {
  const sloConfig = await loadSLOConfig();

  if (!sloConfig.enabled) {
    console.log(chalk.yellow('SLO monitoring is disabled.'));
    console.log('Enable with: savestate slo config --set enabled=true');
    return;
  }

  const nsString = options.namespace ?? 'default:default:default';
  const namespace = parseNamespace(nsString);

  // Create storage and service (in production, this would use configured backend)
  const storage = new InMemoryCheckpointStorage();
  const lane = new KnowledgeLane(storage);

  // Get memories and evaluate compliance
  const memories = await lane.listMemories(namespace);
  const results = await storage.searchMemories({
    namespace,
    include_content: false,
    limit: 1000,
  });

  const compliance = evaluateNamespaceCompliance(
    namespace,
    results,
    [], // No failures in demo mode
    0,  // Cross-session attempts
    0,  // Cross-session successes
    sloConfig,
  );

  if (options.json) {
    console.log(JSON.stringify(compliance, null, 2));
    return;
  }

  // Display status
  console.log(chalk.bold('\n📊 SLO Compliance Status\n'));
  console.log(`Namespace: ${chalk.cyan(compliance.namespace_key)}`);
  console.log(`Evaluated: ${new Date(compliance.evaluated_at).toLocaleString()}`);
  console.log('');

  const statusIcon = compliance.is_compliant ? chalk.green('✓') : chalk.red('✗');
  const statusText = compliance.is_compliant
    ? chalk.green('COMPLIANT')
    : chalk.red('NOT COMPLIANT');
  console.log(`Status: ${statusIcon} ${statusText}`);
  console.log('');

  // Metrics
  console.log(chalk.bold('Metrics:'));
  console.log(`  Freshness:      ${formatPercent(compliance.freshness_compliance_percent)}`);
  console.log(`  Relevance:      ${formatPercent(compliance.relevance_compliance_percent)}`);
  console.log(`  Recall:         ${formatPercent(compliance.recall_compliance_percent)}`);
  console.log(`  Cross-Session:  ${formatPercent(compliance.cross_session_success_percent)}`);
  console.log(`  Failures:       ${compliance.failure_count}`);
  console.log('');

  // SLO Thresholds
  console.log(chalk.bold('SLO Thresholds:'));
  console.log(`  Max Age:         ${formatDuration(sloConfig.freshness.max_age_hours)}`);
  console.log(`  Relevance:       ${(sloConfig.freshness.relevance_threshold * 100).toFixed(0)}%`);
  console.log(`  Recall Target:   ${sloConfig.freshness.recall_target_percent}%`);
  console.log('');

  // Violations
  if (compliance.violations.length > 0) {
    console.log(chalk.bold.red('Violations:'));
    for (const violation of compliance.violations) {
      const icon = violation.severity === 'critical' ? '🚨' : '⚠️';
      console.log(`  ${icon} ${violation.description}`);
    }
    console.log('');
  }
}

/**
 * Generate and display SLO report.
 */
async function sloReport(options: { period?: string; json?: boolean }): Promise<void> {
  const sloConfig = await loadSLOConfig();

  // Calculate period
  const periodDays = options.period ? (parseDuration(options.period) ?? 168) / 24 : 7;
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // In production, this would aggregate real metrics
  const report = generateSLOReport(
    periodStart.toISOString(),
    periodEnd.toISOString(),
    [], // Query results
    [], // Failures
    0,  // Cross-session attempts
    0,  // Cross-session successes
    [], // Namespace compliance
    0,  // Avg drift score
  );

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(formatSLOReport(report));
}

/**
 * View or modify SLO configuration.
 */
async function sloConfig(options: { set?: string; json?: boolean }): Promise<void> {
  let config = await loadSLOConfig();

  if (options.set) {
    const [path, value] = options.set.split('=');
    if (!path || value === undefined) {
      console.log(chalk.red('Invalid format. Use: --set key=value'));
      process.exit(1);
    }

    // Parse value
    let parsedValue: unknown = value;
    if (value === 'true') parsedValue = true;
    else if (value === 'false') parsedValue = false;
    else if (!isNaN(Number(value))) parsedValue = Number(value);

    // Handle duration values
    if (path.includes('hours') || path.includes('minutes')) {
      const parsed = parseDuration(value);
      if (parsed !== null) {
        parsedValue = path.includes('minutes') ? parsed * 60 : parsed;
      }
    }

    config = setSLOConfigValue(config, path, parsedValue);

    // Validate
    const validation = validateSLOConfig(config);
    if (!validation.valid) {
      console.log(chalk.red('Invalid configuration:'));
      for (const error of validation.errors) {
        console.log(chalk.red(`  - ${error}`));
      }
      process.exit(1);
    }

    await saveSLOConfig(config);
    console.log(chalk.green(`Set ${path} = ${JSON.stringify(parsedValue)}`));
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  // Display config
  console.log(chalk.bold('\n⚙️  SLO Configuration\n'));
  console.log(`Enabled: ${config.enabled ? chalk.green('yes') : chalk.yellow('no')}`);
  console.log(`Alert Threshold: ${config.alert_threshold_percent}%`);
  console.log(`Evaluation Interval: ${config.evaluation_interval_minutes} minutes`);
  console.log('');

  console.log(chalk.bold('Freshness SLO:'));
  console.log(`  Max Age: ${formatDuration(config.freshness.max_age_hours)}`);
  console.log(`  Relevance Threshold: ${(config.freshness.relevance_threshold * 100).toFixed(0)}%`);
  console.log(`  Recall Target: ${config.freshness.recall_target_percent}%`);
  console.log('');

  console.log(chalk.dim('Modify with: savestate slo config --set <key>=<value>'));
  console.log(chalk.dim('Example: savestate slo config --set freshness.max_age_hours=720'));
}

/**
 * Format percentage with color.
 */
function formatPercent(value: number): string {
  const formatted = `${value.toFixed(1)}%`;
  if (value >= 95) return chalk.green(formatted);
  if (value >= 80) return chalk.yellow(formatted);
  return chalk.red(formatted);
}

/**
 * Register SLO commands with CLI.
 */
export function registerSLOCommands(program: import('commander').Command): void {
  program
    .command('slo <subcommand>')
    .description('Memory freshness SLO monitoring (status, report, config)')
    .option('-n, --namespace <ns>', 'Namespace (org:app:agent:user)')
    .option('--json', 'Output as JSON')
    .option('--set <key=value>', 'Set a config value')
    .option('-p, --period <duration>', 'Report period (e.g., 7d, 30d)')
    .action(sloCommand);
}
