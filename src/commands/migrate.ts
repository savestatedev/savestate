/**
 * savestate migrate — Cross-platform AI identity migration wizard
 *
 * Helps users move their AI identity from one platform to another:
 * - ChatGPT → Claude
 * - Claude → Gemini
 * - OpenAI Assistants → Clawdbot
 * - etc.
 *
 * This is a guided wizard with clear explanations.
 */

import chalk from 'chalk';
import ora from 'ora';
import * as readline from 'node:readline';
import { isInitialized, loadConfig } from '../config.js';
import { getAdapter, listAdapters } from '../adapters/registry.js';
import { createSnapshot } from '../snapshot.js';
import { restoreSnapshot } from '../restore.js';
import { resolveStorage } from '../storage/resolve.js';
import { getPassphrase } from '../passphrase.js';

interface MigrateOptions {
  from?: string;
  to?: string;
  snapshot?: string;
  dryRun?: boolean;
  list?: boolean;
}

// Platform migration capabilities (what each platform can do)
const PLATFORM_INFO: Record<string, { extract: boolean; restore: boolean; note?: string }> = {
  'clawdbot': { extract: true, restore: true },
  'claude-code': { extract: true, restore: true },
  'openai-assistants': { extract: true, restore: true },
  'chatgpt': { extract: true, restore: false, note: 'Memory/instructions only' },
  'claude-web': { extract: true, restore: false, note: 'Memory/projects only' },
  'gemini': { extract: true, restore: false, note: 'Limited restore' },
};

export async function migrateCommand(options: MigrateOptions): Promise<void> {
  console.log();
  console.log(chalk.cyan.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan.bold('  ⏸ SaveState Migration Wizard'));
  console.log(chalk.cyan.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log();

  if (options.list) {
    showPlatforms();
    return;
  }

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const storage = resolveStorage(config);

  // Interactive mode if not all options provided
  if (!options.from || !options.to) {
    console.log(chalk.white('This wizard helps you migrate your AI identity between platforms.'));
    console.log(chalk.dim('Your data will be encrypted throughout the process.'));
    console.log();
    showPlatforms();
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string): Promise<string> => {
    return new Promise(resolve => {
      rl.question(chalk.cyan(question), answer => resolve(answer.trim()));
    });
  };

  try {
    // Step 1: Select source platform
    let sourceId = options.from;
    if (!sourceId) {
      sourceId = await ask('Source platform (migrate FROM): ');
    }

    const sourceAdapter = getAdapter(sourceId);
    if (!sourceAdapter) {
      console.log(chalk.red(`\n✗ Unknown platform: ${sourceId}`));
      console.log(chalk.dim(`  Available: ${listAdapters().join(', ')}`));
      process.exit(1);
    }

    const sourceInfo = PLATFORM_INFO[sourceId];
    if (!sourceInfo?.extract) {
      console.log(chalk.red(`\n✗ ${sourceAdapter.name} doesn't support extraction`));
      process.exit(1);
    }

    // Step 2: Select target platform
    let targetId = options.to;
    if (!targetId) {
      targetId = await ask('Target platform (migrate TO): ');
    }

    const targetAdapter = getAdapter(targetId);
    if (!targetAdapter) {
      console.log(chalk.red(`\n✗ Unknown platform: ${targetId}`));
      process.exit(1);
    }

    const targetInfo = PLATFORM_INFO[targetId];
    if (!targetInfo?.restore) {
      console.log(chalk.yellow(`\n⚠ ${targetAdapter.name} has limited restore support`));
      if (targetInfo?.note) {
        console.log(chalk.dim(`  ${targetInfo.note}`));
      }
      const proceed = await ask('Continue anyway? (yes/no): ');
      if (proceed.toLowerCase() !== 'yes' && proceed.toLowerCase() !== 'y') {
        console.log(chalk.yellow('\nMigration cancelled.'));
        rl.close();
        return;
      }
    }

    console.log();
    console.log(chalk.white.bold('Migration Plan:'));
    console.log();
    console.log(`  ${chalk.cyan('From:')} ${sourceAdapter.name}`);
    console.log(`  ${chalk.cyan('To:')}   ${targetAdapter.name}`);
    console.log();

    // Show what will be migrated
    console.log(chalk.white.bold('What will be migrated:'));
    console.log();
    console.log(`  ${chalk.green('✓')} Identity (personality, instructions, system prompts)`);
    console.log(`  ${chalk.green('✓')} Memory (learned facts, preferences)`);
    console.log(`  ${chalk.green('✓')} Configuration (settings, tool configs)`);

    if (sourceId === 'chatgpt' || sourceId === 'claude-web') {
      console.log(`  ${chalk.yellow('⚠')} Conversations ${chalk.dim('(preserved in snapshot, may not import to target)')}`);
    } else {
      console.log(`  ${chalk.green('✓')} Conversations (if supported by target)`);
    }

    console.log();

    // Specific migration notes
    if (sourceId === 'chatgpt') {
      console.log(chalk.yellow.bold('Note for ChatGPT migration:'));
      console.log(chalk.yellow('  Your ChatGPT memories and custom instructions will be exported.'));
      console.log(chalk.yellow('  Conversation history is preserved but may not import elsewhere.'));
      console.log();
    }

    if (options.dryRun) {
      console.log(chalk.cyan.bold('DRY RUN — no changes will be made'));
      console.log();
      rl.close();
      return;
    }

    // Confirm
    const confirm = await ask('Proceed with migration? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log(chalk.yellow('\nMigration cancelled.'));
      rl.close();
      return;
    }

    console.log();

    // Step 4: Get passphrase
    const passphrase = await getPassphrase();

    // Step 5: Create snapshot from source
    const spinner1 = ora(`Extracting from ${sourceAdapter.name}...`).start();

    let snapshotId = options.snapshot;
    if (!snapshotId) {
      try {
        const result = await createSnapshot(sourceAdapter, storage, passphrase, {
          label: `migration-from-${sourceId}`,
          tags: ['migration', `from:${sourceId}`, `to:${targetId}`],
        });
        snapshotId = result.snapshot.manifest.id;
        spinner1.succeed(`Snapshot created: ${chalk.cyan(snapshotId)}`);
      } catch (err) {
        spinner1.fail('Failed to create snapshot');
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    } else {
      spinner1.succeed(`Using existing snapshot: ${chalk.cyan(snapshotId)}`);
    }

    // Step 6: Restore to target
    const spinner2 = ora(`Restoring to ${targetAdapter.name}...`).start();

    try {
      await restoreSnapshot(snapshotId, targetAdapter, storage, passphrase);
      spinner2.succeed(`Migration complete!`);
    } catch (err) {
      spinner2.fail('Failed to restore');
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      console.log();
      console.log(chalk.dim(`Your snapshot is preserved: ${snapshotId}`));
      console.log(chalk.dim(`You can retry with: savestate restore ${snapshotId} --to ${targetId}`));
      process.exit(1);
    }

    // Success
    console.log();
    console.log(chalk.green.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.green.bold('  ✓ Migration Successful!'));
    console.log(chalk.green.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log();
    console.log(`  Your AI identity has been migrated from ${chalk.cyan(sourceAdapter.name)}`);
    console.log(`  to ${chalk.cyan(targetAdapter.name)}.`);
    console.log();
    console.log(chalk.dim(`  Snapshot preserved: ${snapshotId}`));
    console.log(chalk.dim(`  You can restore again anytime with:`));
    console.log(chalk.dim(`  savestate restore ${snapshotId} --to <platform>`));
    console.log();

  } finally {
    rl.close();
  }
}

function showPlatforms(): void {
  console.log(chalk.white.bold('Available Platforms:'));
  console.log();

  const adapterIds = listAdapters();

  adapterIds.forEach(id => {
    const adapter = getAdapter(id);
    if (!adapter) return;

    const info = PLATFORM_INFO[id] || { extract: true, restore: true };
    const extract = info.extract ? chalk.green('✓') : chalk.red('✗');
    const restore = info.restore ? chalk.green('✓') : chalk.yellow('⚠');

    let line = `  ${chalk.white(id.padEnd(20))} ${extract} extract  ${restore} restore`;
    if (info.note) {
      line += chalk.dim(` (${info.note})`);
    }
    console.log(line);
  });

  console.log();
  console.log(chalk.dim('Legend: ✓ = full support, ⚠ = partial/limited, ✗ = not supported'));
  console.log();
}
