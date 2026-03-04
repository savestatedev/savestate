
import { Command } from 'commander';
import { MigrationOrchestrator } from '../migrate/orchestrator.js';
import { logger } from '../utils/logger.js';
import chalk from 'chalk';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MigrationBundle } from '../migrate/types.js';

export const importCommand = async (options: {
  input: string;
}) => {
  const inputPath = join(process.cwd(), options.input);

  if (!existsSync(inputPath)) {
    logger.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const bundleJson = await readFile(inputPath, 'utf-8');
  const bundle = JSON.parse(bundleJson) as MigrationBundle;

  if (!bundle.source || !bundle.target) {
    logger.error('Invalid bundle file: missing source or target platform.');
    process.exit(1);
  }

  const orchestrator = new MigrationOrchestrator(bundle.source.platform, bundle.target.platform);

  orchestrator.on((event) => {
    if (event.type === 'progress') {
      logger.info(`[${event.phase}] ${event.message}`);
    }
  });

  try {
    orchestrator.setBundle(bundle);
    const result = await orchestrator.runLoadPhase();

    if (result.success) {
      logger.info(chalk.green('Successfully imported state container.'));
    } else {
      logger.error('Import failed.');
      if (result.errors.length > 0) {
        logger.error('Errors:');
        for (const error of result.errors) {
          logger.error(`- ${error}`);
        }
      }
    }  } catch (error) {
    logger.error(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const importCommandDefinition = (program: Command) => {
  program
    .command('import')
    .description('Import the state container from a portable file')
    .option('-i, --input <file>', 'Input file path', 'savestate-bundle.json')
    .action(importCommand);
};
