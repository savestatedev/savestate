/**
 * savestate search <query> — Search across snapshots
 */

import chalk from 'chalk';
import ora from 'ora';
import { isInitialized, loadConfig } from '../config.js';

interface SearchOptions {
  type?: string;
  limit?: string;
  snapshot?: string;
}

export async function searchCommand(query: string, options: SearchOptions): Promise<void> {
  console.log();

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const _config = await loadConfig();
  const limit = options.limit ? parseInt(options.limit, 10) : 20;

  console.log(chalk.bold(`🔍 Searching: "${chalk.cyan(query)}"`));
  if (options.type) console.log(chalk.dim(`   Filter: ${options.type}`));
  if (options.snapshot) console.log(chalk.dim(`   Snapshot: ${options.snapshot}`));
  console.log();

  const spinner = ora('Searching across snapshots...').start();

  try {
    // TODO: Actually search
    // const results = await searchSnapshots(query, config, {
    //   types: options.type?.split(',') as any,
    //   limit,
    //   snapshots: options.snapshot ? [options.snapshot] : undefined,
    // });

    await new Promise((resolve) => setTimeout(resolve, 500));
    spinner.stop();

    console.log(chalk.dim('  No snapshots to search. Create one with:'));
    console.log();
    console.log(`    ${chalk.cyan('savestate snapshot')}`);
    console.log();
    console.log(chalk.dim('  Once you have snapshots, search will find matches across:'));
    console.log(chalk.dim('    • Memory entries'));
    console.log(chalk.dim('    • Conversation messages'));
    console.log(chalk.dim('    • Identity/personality documents'));
    console.log(chalk.dim('    • Knowledge base files'));
    console.log();
    console.log(chalk.dim(`  Showing up to ${limit} results, sorted by relevance.`));
    console.log();

  } catch (err) {
    spinner.fail('Search failed');
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}
