/**
 * Migration Summary Display
 *
 * Formats and displays migration results and compatibility reports.
 */

import chalk from 'chalk';
import type {
  LoadResult,
  CompatibilityReport,
  CompatibilityItem,
  MigrationState,
  Platform,
} from '../migrate/types.js';
import { PLATFORM_CAPABILITIES } from '../migrate/capabilities.js';

// ─── Types ───────────────────────────────────────────────────

export interface SummaryOptions {
  /** Disable colors */
  noColor?: boolean;
  /** Show detailed breakdown */
  detailed?: boolean;
}

// ─── Platform Names ──────────────────────────────────────────

const PLATFORM_NAMES: Record<Platform, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  copilot: 'Microsoft Copilot',
};

// ─── Summary Functions ───────────────────────────────────────

/**
 * Display migration success summary
 */
export function showMigrationSummary(
  state: MigrationState,
  result: LoadResult,
  options: SummaryOptions = {},
): void {
  const sourceName = PLATFORM_NAMES[state.source] || state.source;
  const targetName = PLATFORM_NAMES[state.target] || state.target;

  console.log();
  console.log(chalk.green.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.green.bold('  ✓ Migration Complete'));
  console.log(chalk.green.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log();

  // Migration path
  console.log(`  ${chalk.white('From:')} ${chalk.cyan(sourceName)}`);
  console.log(`  ${chalk.white('To:')}   ${chalk.cyan(targetName)}`);
  console.log();

  // What was created
  console.log(chalk.white.bold('  Created:'));

  if (result.loaded.instructions) {
    console.log(`    ${chalk.green('✓')} Custom Instructions`);
  }

  if (result.loaded.memories > 0) {
    console.log(`    ${chalk.green('✓')} ${result.loaded.memories} memories`);
  }

  if (result.loaded.files > 0) {
    console.log(`    ${chalk.green('✓')} ${result.loaded.files} files`);
  }

  if (result.loaded.customBots > 0) {
    console.log(`    ${chalk.green('✓')} ${result.loaded.customBots} custom bots`);
  }

  console.log();

  // Created resources
  if (result.created?.projectId) {
    console.log(chalk.white.bold('  Resources:'));
    console.log(`    Project ID: ${chalk.cyan(result.created.projectId)}`);
    if (result.created.projectUrl) {
      console.log(`    URL: ${chalk.cyan(result.created.projectUrl)}`);
    }
    console.log();
  }

  // Warnings
  if (result.warnings.length > 0) {
    console.log(chalk.yellow.bold('  Warnings:'));
    result.warnings.forEach((w) => {
      console.log(`    ${chalk.yellow('⚠')} ${w}`);
    });
    console.log();
  }

  // Manual steps
  if (result.manualSteps && result.manualSteps.length > 0) {
    console.log(chalk.blue.bold('  Manual Steps Required:'));
    result.manualSteps.forEach((step, i) => {
      console.log(`    ${i + 1}. ${step}`);
    });
    console.log();
  }

  // Migration ID for reference
  console.log(chalk.dim(`  Migration ID: ${state.id}`));
  console.log(chalk.dim(`  You can restore again with: savestate restore --to <platform>`));
  console.log();
}

/**
 * Display dry-run compatibility report
 */
export function showCompatibilityReport(
  report: CompatibilityReport,
  options: SummaryOptions = {},
): void {
  const sourceName = PLATFORM_NAMES[report.source] || report.source;
  const targetName = PLATFORM_NAMES[report.target] || report.target;

  console.log();
  console.log(chalk.cyan.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan.bold('  📋 Compatibility Report (Dry Run)'));
  console.log(chalk.cyan.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log();

  // Migration path
  console.log(`  ${chalk.white('From:')} ${chalk.cyan(sourceName)}`);
  console.log(`  ${chalk.white('To:')}   ${chalk.cyan(targetName)}`);
  console.log();

  // Summary box
  console.log(chalk.white.bold('  Summary:'));
  console.log(`    ${chalk.green('✓')} ${report.summary.perfect} items will transfer perfectly`);
  console.log(`    ${chalk.yellow('⚠')} ${report.summary.adapted} items require adaptation`);
  console.log(`    ${chalk.red('✗')} ${report.summary.incompatible} items cannot be migrated`);
  console.log();

  // Group items by type
  if (options.detailed !== false) {
    const grouped = groupItemsByType(report.items);

    for (const [type, items] of Object.entries(grouped)) {
      const typeName = formatTypeName(type);
      console.log(chalk.white.bold(`  ${typeName}:`));

      items.forEach((item) => {
        const symbol = getStatusSymbol(item.status);
        const color = getStatusColor(item.status);
        console.log(`    ${color(symbol)} ${item.name}`);
        console.log(chalk.dim(`        ${item.reason}`));
        if (item.action) {
          console.log(chalk.dim(`        → ${item.action}`));
        }
      });
      console.log();
    }
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    console.log(chalk.white.bold('  Recommendations:'));
    report.recommendations.forEach((rec, i) => {
      console.log(`    ${i + 1}. ${rec}`);
    });
    console.log();
  }

  // Feasibility
  console.log(`  ${chalk.white('Feasibility:')} ${formatFeasibility(report.feasibility)}`);
  console.log();

  // Dry run notice
  console.log(chalk.cyan.bold('  ─────────────────────────────────────────────────────'));
  console.log(chalk.cyan('  This was a dry run. No changes were made.'));
  console.log(chalk.cyan('  Remove --dry-run to perform the actual migration.'));
  console.log(chalk.cyan.bold('  ─────────────────────────────────────────────────────'));
  console.log();
}

/**
 * Display review mode - items needing attention
 */
export function showReviewItems(
  report: CompatibilityReport,
  options: SummaryOptions = {},
): void {
  const needsAttention = report.items.filter(
    (item) => item.status === 'adapted' || item.status === 'incompatible',
  );

  if (needsAttention.length === 0) {
    console.log();
    console.log(chalk.green.bold('  ✓ All items transfer perfectly!'));
    console.log(chalk.green('  No manual review needed.'));
    console.log();
    return;
  }

  console.log();
  console.log(chalk.yellow.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.yellow.bold('  ⚠ Items Requiring Review'));
  console.log(chalk.yellow.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log();

  // Show adapted items
  const adapted = needsAttention.filter((i) => i.status === 'adapted');
  if (adapted.length > 0) {
    console.log(chalk.yellow.bold('  Adapted Items:'));
    console.log(chalk.dim('  These items will be transformed to fit the target platform.'));
    console.log();

    adapted.forEach((item, i) => {
      console.log(`    ${chalk.yellow(`${i + 1}.`)} ${chalk.white.bold(item.name)}`);
      console.log(`       Type: ${formatTypeName(item.type)}`);
      console.log(`       Issue: ${item.reason}`);
      if (item.action) {
        console.log(`       Action: ${chalk.cyan(item.action)}`);
      }
      console.log();
    });
  }

  // Show incompatible items
  const incompatible = needsAttention.filter((i) => i.status === 'incompatible');
  if (incompatible.length > 0) {
    console.log(chalk.red.bold('  Incompatible Items:'));
    console.log(chalk.dim('  These items cannot be migrated.'));
    console.log();

    incompatible.forEach((item, i) => {
      console.log(`    ${chalk.red(`${i + 1}.`)} ${chalk.white.bold(item.name)}`);
      console.log(`       Type: ${formatTypeName(item.type)}`);
      console.log(`       Reason: ${item.reason}`);
      if (item.action) {
        console.log(`       Alternative: ${chalk.cyan(item.action)}`);
      }
      console.log();
    });
  }
}

/**
 * Display migration resume information
 */
export function showResumableMigrations(migrations: MigrationState[]): void {
  const resumable = migrations.filter(
    (m) => m.phase !== 'complete' && m.phase !== 'failed',
  );

  if (resumable.length === 0) {
    console.log();
    console.log(chalk.dim('  No interrupted migrations found.'));
    console.log();
    return;
  }

  console.log();
  console.log(chalk.yellow.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.yellow.bold('  ⟳ Interrupted Migrations'));
  console.log(chalk.yellow.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log();

  resumable.forEach((m, i) => {
    const sourceName = PLATFORM_NAMES[m.source] || m.source;
    const targetName = PLATFORM_NAMES[m.target] || m.target;
    const started = new Date(m.startedAt).toLocaleString();

    console.log(`  ${i + 1}. ${chalk.cyan(m.id)}`);
    console.log(`     ${sourceName} → ${targetName}`);
    console.log(`     Phase: ${formatPhase(m.phase)} (${Math.round(m.progress)}%)`);
    console.log(`     Started: ${started}`);
    console.log();
  });

  console.log(chalk.dim('  Resume with: savestate migrate --resume'));
  console.log();
}

/**
 * Display failed migration details
 */
export function showFailedMigration(
  state: MigrationState,
  options: SummaryOptions = {},
): void {
  console.log();
  console.log(chalk.red.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.red.bold('  ✗ Migration Failed'));
  console.log(chalk.red.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log();

  console.log(`  ${chalk.white('Phase:')} ${formatPhase(state.phase)}`);
  console.log(`  ${chalk.white('Error:')} ${chalk.red(state.error || 'Unknown error')}`);
  console.log();

  console.log(chalk.white.bold('  Options:'));
  console.log(`    1. ${chalk.cyan('savestate migrate --resume')} - Retry from last checkpoint`);
  console.log(`    2. Check authentication and permissions`);
  console.log(`    3. Try with ${chalk.cyan('--dry-run')} to see compatibility issues`);
  console.log();

  console.log(chalk.dim(`  Migration ID: ${state.id}`));
  console.log();
}

// ─── Helper Functions ────────────────────────────────────────

function groupItemsByType(items: CompatibilityItem[]): Record<string, CompatibilityItem[]> {
  return items.reduce(
    (groups, item) => {
      const type = item.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(item);
      return groups;
    },
    {} as Record<string, CompatibilityItem[]>,
  );
}

function formatTypeName(type: string): string {
  const names: Record<string, string> = {
    instructions: 'Custom Instructions',
    memory: 'Memories',
    conversation: 'Conversations',
    file: 'Files',
    customBot: 'Custom Bots/GPTs',
    feature: 'Features/Capabilities',
  };
  return names[type] || type;
}

function getStatusSymbol(status: CompatibilityItem['status']): string {
  switch (status) {
    case 'perfect':
      return '✓';
    case 'adapted':
      return '⚠';
    case 'incompatible':
      return '✗';
  }
}

function getStatusColor(status: CompatibilityItem['status']): (s: string) => string {
  switch (status) {
    case 'perfect':
      return chalk.green;
    case 'adapted':
      return chalk.yellow;
    case 'incompatible':
      return chalk.red;
  }
}

function formatFeasibility(feasibility: CompatibilityReport['feasibility']): string {
  switch (feasibility) {
    case 'easy':
      return chalk.green('Easy - Most items transfer cleanly');
    case 'moderate':
      return chalk.yellow('Moderate - Some items need adaptation');
    case 'complex':
      return chalk.yellow('Complex - Significant adaptation required');
    case 'partial':
      return chalk.red('Partial - Some items cannot be migrated');
  }
}

function formatPhase(phase: MigrationState['phase']): string {
  const phases: Record<string, string> = {
    pending: chalk.dim('Pending'),
    extracting: chalk.blue('Extracting'),
    transforming: chalk.yellow('Transforming'),
    loading: chalk.magenta('Loading'),
    complete: chalk.green('Complete'),
    failed: chalk.red('Failed'),
  };
  return phases[phase] || phase;
}
