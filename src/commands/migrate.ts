/**
 * savestate migrate — Cross-platform AI identity migration wizard
 *
 * Helps users move their AI identity from one platform to another:
 * - ChatGPT → Claude
 * - Claude → Gemini
 * - OpenAI Assistants → Clawdbot
 * - etc.
 *
 * Features:
 * - Interactive prompts for source/destination selection
 * - Progress bars for each phase
 * - --dry-run mode (compatibility report only)
 * - --review mode (inspect items needing attention)
 * - --resume for interrupted migrations
 * - Confirmation prompts before destructive actions
 * - Post-migration summary
 * - Graceful Ctrl+C handling
 * - Colorized output with --no-color fallback
 */

import chalk from 'chalk';
import { isInitialized } from '../config.js';
import type { Platform, MigrationOptions, LoadResult, CompatibilityReport } from '../migrate/types.js';
import { MigrationOrchestrator, PLATFORM_CAPABILITIES, getPlatformCapabilities } from '../migrate/index.js';
import {
  select,
  selectSourcePlatform,
  selectTargetPlatform,
  selectContentTypes,
  confirm,
  setColorsEnabled,
} from '../cli/prompts.js';
import { ProgressDisplay, success, warning, error, info } from '../cli/progress.js';
import {
  showMigrationSummary,
  showCompatibilityReport,
  showReviewItems,
  showResumableMigrations,
  showFailedMigration,
} from '../cli/summary.js';
import { setupSignalHandler, cleanupSignalHandler } from '../cli/signal-handler.js';

// ─── Types ───────────────────────────────────────────────────

export interface MigrateCommandOptions {
  from?: string;
  to?: string;
  snapshot?: string;
  dryRun?: boolean;
  list?: boolean;
  resume?: boolean;
  review?: boolean;
  include?: string;
  noColor?: boolean;
  force?: boolean;
  verbose?: boolean;
}

// ─── Main Command ────────────────────────────────────────────

export async function migrateCommand(options: MigrateCommandOptions): Promise<void> {
  // Handle --no-color flag
  if (options.noColor) {
    setColorsEnabled(false);
    chalk.level = 0;
  }

  // Show header
  showHeader();

  // Handle --list: show available platforms
  if (options.list) {
    showPlatforms();
    return;
  }

  // Handle --resume: resume interrupted migrations
  if (options.resume) {
    await handleResume(options);
    return;
  }

  // Check initialization
  if (!isInitialized()) {
    error('SaveState not initialized. Run `savestate init` first.');
    process.exit(1);
  }

  // Determine source and target platforms
  const { source, target } = await determinePlatforms(options);

  // Handle --review: show what needs attention without migrating
  if (options.review) {
    await handleReview(source, target, options);
    return;
  }

  // Handle --dry-run: show compatibility report without migrating
  if (options.dryRun) {
    await handleDryRun(source, target, options);
    return;
  }

  // Run full migration
  await runMigration(source, target, options);
}

// ─── Platform Selection ──────────────────────────────────────

async function determinePlatforms(
  options: MigrateCommandOptions,
): Promise<{ source: Platform; target: Platform }> {
  let source: Platform;
  let target: Platform;

  // Interactive mode if platforms not provided
  if (!options.from) {
    console.log(chalk.white('This wizard helps you migrate your AI identity between platforms.'));
    console.log(chalk.dim('Your data will be encrypted throughout the process.'));
    console.log();

    source = await selectSourcePlatform();
  } else {
    source = validatePlatform(options.from, 'source');
  }

  if (!options.to) {
    target = await selectTargetPlatform(source);
  } else {
    target = validatePlatform(options.to, 'target');
  }

  // Validate source != target
  if (source === target) {
    error('Source and target platforms cannot be the same.');
    process.exit(1);
  }

  return { source, target };
}

function validatePlatform(id: string, type: 'source' | 'target'): Platform {
  const platforms = Object.keys(PLATFORM_CAPABILITIES) as Platform[];

  if (!platforms.includes(id as Platform)) {
    error(`Unknown ${type} platform: ${id}`);
    console.log(chalk.dim(`Available: ${platforms.join(', ')}`));
    process.exit(1);
  }

  return id as Platform;
}

// ─── Dry Run Mode ────────────────────────────────────────────

async function handleDryRun(
  source: Platform,
  target: Platform,
  options: MigrateCommandOptions,
): Promise<void> {
  const progress = new ProgressDisplay({ noColor: options.noColor, verbose: options.verbose });

  try {
    // Create orchestrator
    const orchestrator = new MigrationOrchestrator(source, target, {
      dryRun: true,
      include: parseInclude(options.include),
    });

    // Setup signal handler
    const handler = setupSignalHandler({ orchestrator, showResumeHint: false });
    handler.setOrchestrator(orchestrator);

    // Subscribe to events
    orchestrator.on(progress.handleEvent);

    // Run analysis
    progress.startPhase('extracting', 'Analyzing source platform...');
    const report = await orchestrator.analyze();
    progress.completePhase('extracting', 'Analysis complete');

    // Show compatibility report
    showCompatibilityReport(report, { noColor: options.noColor });

    // Cleanup
    await orchestrator.cleanup();
    cleanupSignalHandler();
  } catch (err) {
    progress.stop();
    error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

// ─── Review Mode ─────────────────────────────────────────────

async function handleReview(
  source: Platform,
  target: Platform,
  options: MigrateCommandOptions,
): Promise<void> {
  const progress = new ProgressDisplay({ noColor: options.noColor, verbose: options.verbose });

  try {
    // Create orchestrator
    const orchestrator = new MigrationOrchestrator(source, target, {
      dryRun: true,
      include: parseInclude(options.include),
    });

    // Setup signal handler
    const handler = setupSignalHandler({ orchestrator, showResumeHint: false });
    handler.setOrchestrator(orchestrator);

    // Subscribe to events
    orchestrator.on(progress.handleEvent);

    // Run analysis
    progress.startPhase('extracting', 'Analyzing migration...');
    const report = await orchestrator.analyze();
    progress.completePhase('extracting', 'Analysis complete');

    // Show review items
    showReviewItems(report, { noColor: options.noColor });

    // Cleanup
    await orchestrator.cleanup();
    cleanupSignalHandler();
  } catch (err) {
    progress.stop();
    error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

// ─── Resume Mode ─────────────────────────────────────────────

async function handleResume(options: MigrateCommandOptions): Promise<void> {
  try {
    // List available migrations
    const migrations = await MigrationOrchestrator.listMigrations();
    const resumable = migrations.filter(
      (m) => m.phase !== 'complete' && m.phase !== 'failed',
    );

    if (resumable.length === 0) {
      info('No interrupted migrations found.');
      console.log(chalk.dim('Start a new migration with: savestate migrate --from <platform> --to <platform>'));
      return;
    }

    // Show resumable migrations
    showResumableMigrations(migrations);

    // If only one, ask to resume it
    let migrationId: string;
    if (resumable.length === 1) {
      const shouldResume = await confirm(
        `Resume migration ${resumable[0].id}?`,
        true,
      );
      if (!shouldResume) {
        console.log(chalk.dim('Migration cancelled.'));
        return;
      }
      migrationId = resumable[0].id;
    } else {
      // Let user select
      const selectOptions = resumable.map((m) => ({
        value: m.id,
        label: m.id,
        description: `${m.source} → ${m.target} (${Math.round(m.progress)}%)`,
      }));
      migrationId = await select('Select migration to resume:', selectOptions);
    }

    // Resume the migration
    const orchestrator = await MigrationOrchestrator.resume(migrationId);
    const progress = new ProgressDisplay({ noColor: options.noColor, verbose: options.verbose });

    // Setup signal handler
    const handler = setupSignalHandler({ orchestrator });
    handler.setOrchestrator(orchestrator);

    // Subscribe to events
    orchestrator.on(progress.handleEvent);

    info(`Resuming migration ${migrationId}...`);
    console.log();

    const result = await orchestrator.continue();
    const state = orchestrator.getState();

    // Show summary
    showMigrationSummary(state, result, { noColor: options.noColor });

    cleanupSignalHandler();
  } catch (err) {
    error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

// ─── Full Migration ──────────────────────────────────────────

async function runMigration(
  source: Platform,
  target: Platform,
  options: MigrateCommandOptions,
): Promise<void> {
  const progress = new ProgressDisplay({ noColor: options.noColor, verbose: options.verbose });

  try {
    // Show migration plan
    await showMigrationPlan(source, target, options);

    // Confirm before proceeding (unless --force)
    if (!options.force) {
      console.log();
      const proceed = await confirm('Proceed with migration?', true);
      if (!proceed) {
        console.log(chalk.yellow('\nMigration cancelled.'));
        return;
      }
    }

    console.log();

    // Create orchestrator
    const migrationOptions: MigrationOptions = {
      include: parseInclude(options.include),
      dryRun: false,
    };

    const orchestrator = new MigrationOrchestrator(source, target, migrationOptions);

    // Setup signal handler
    const handler = setupSignalHandler({ orchestrator });
    handler.setOrchestrator(orchestrator);

    // Subscribe to events
    orchestrator.on(progress.handleEvent);

    // Run the migration
    const result = await orchestrator.run();
    const state = orchestrator.getState();

    // Show summary based on result
    if (result.success) {
      showMigrationSummary(state, result, { noColor: options.noColor });
    } else {
      showFailedMigration(state, { noColor: options.noColor });
    }

    cleanupSignalHandler();

    if (!result.success) {
      process.exit(1);
    }
  } catch (err) {
    progress.stop();
    cleanupSignalHandler();
    error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

// ─── Migration Plan Display ──────────────────────────────────

async function showMigrationPlan(
  source: Platform,
  target: Platform,
  options: MigrateCommandOptions,
): Promise<void> {
  const sourceCap = getPlatformCapabilities(source);
  const targetCap = getPlatformCapabilities(target);

  console.log();
  console.log(chalk.white.bold('Migration Plan:'));
  console.log();
  console.log(`  ${chalk.cyan('From:')} ${sourceCap.name}`);
  console.log(`  ${chalk.cyan('To:')}   ${targetCap.name}`);
  console.log();

  // Show what will be migrated
  console.log(chalk.white.bold('What will be migrated:'));
  console.log();

  const include = parseInclude(options.include);

  // Instructions
  if (!include || include.includes('instructions')) {
    console.log(`  ${chalk.green('✓')} Identity (personality, instructions, system prompts)`);
  }

  // Memories
  if (!include || include.includes('memories')) {
    if (sourceCap.hasMemory && targetCap.hasMemory) {
      console.log(`  ${chalk.green('✓')} Memory (learned facts, preferences)`);
    } else if (sourceCap.hasMemory) {
      console.log(`  ${chalk.yellow('⚠')} Memory ${chalk.dim('(adapted for ' + targetCap.name + ')')}`);
    }
  }

  // Files
  if (!include || include.includes('files')) {
    if (sourceCap.hasFiles && targetCap.hasFiles) {
      console.log(`  ${chalk.green('✓')} Files (uploaded documents)`);
    } else if (sourceCap.hasFiles) {
      console.log(`  ${chalk.yellow('⚠')} Files ${chalk.dim('(limited support in ' + targetCap.name + ')')}`);
    }
  }

  // Conversations
  if (!include || include.includes('conversations')) {
    if (sourceCap.hasConversations) {
      console.log(`  ${chalk.yellow('⚠')} Conversations ${chalk.dim('(preserved but may not import)')}`);
    }
  }

  // Custom bots
  if (!include || include.includes('customBots')) {
    if (sourceCap.hasCustomBots && targetCap.hasProjects) {
      console.log(`  ${chalk.green('✓')} Custom Bots / GPTs → Projects`);
    } else if (sourceCap.hasCustomBots) {
      console.log(`  ${chalk.yellow('⚠')} Custom Bots ${chalk.dim('(converted to instructions)')}`);
    }
  }

  console.log();

  // Platform-specific notes
  if (source === 'chatgpt') {
    console.log(chalk.yellow.bold('Note for ChatGPT migration:'));
    console.log(chalk.yellow('  Your ChatGPT memories and custom instructions will be exported.'));
    console.log(chalk.yellow('  Conversation history is preserved but may not import elsewhere.'));
    console.log();
  }

  if (target === 'claude') {
    console.log(chalk.blue.bold('Note for Claude target:'));
    console.log(chalk.blue('  Memories will be converted to project knowledge files.'));
    console.log(chalk.blue('  Custom GPTs will become Claude Projects with artifacts.'));
    console.log();
  }
}

// ─── Platform List ───────────────────────────────────────────

function showPlatforms(): void {
  console.log(chalk.white.bold('Available Platforms:'));
  console.log();

  Object.entries(PLATFORM_CAPABILITIES).forEach(([id, cap]) => {
    const features: string[] = [];
    if (cap.hasMemory) features.push('memories');
    if (cap.hasFiles) features.push('files');
    if (cap.hasProjects) features.push('projects');
    if (cap.hasConversations) features.push('conversations');
    if (cap.hasCustomBots) features.push('custom bots');

    console.log(`  ${chalk.cyan(id.padEnd(12))} ${cap.name}`);
    console.log(`  ${' '.repeat(12)} ${chalk.dim(features.join(', '))}`);
    console.log();
  });

  console.log(chalk.dim('Use: savestate migrate --from <platform> --to <platform>'));
  console.log();
}

// ─── Header ──────────────────────────────────────────────────

function showHeader(): void {
  console.log();
  console.log(chalk.cyan.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan.bold('  ⏸ SaveState Migration Wizard'));
  console.log(chalk.cyan.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log();
}

// ─── Helpers ─────────────────────────────────────────────────

function parseInclude(
  include?: string,
): MigrationOptions['include'] | undefined {
  if (!include) return undefined;

  const valid = ['instructions', 'memories', 'conversations', 'files', 'customBots'] as const;
  const items = include.split(',').map((s) => s.trim());

  const result: MigrationOptions['include'] = [];
  for (const item of items) {
    if (valid.includes(item as (typeof valid)[number])) {
      result.push(item as (typeof valid)[number]);
    } else {
      warning(`Unknown content type: ${item}`);
    }
  }

  return result.length > 0 ? result : undefined;
}
