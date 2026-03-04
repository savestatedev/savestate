
import { Command } from 'commander';
import { MigrationOrchestrator } from '../migrate/orchestrator.js';
import { logger } from '../utils/logger.js';
import chalk from 'chalk';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const exportCommand = async (options: {
  from: string;
  to: string;
  output: string;
}) => {
  if (!options.from || !options.to) {
    logger.error('Please specify both source and target platforms.');
    process.exit(1);
  }

  const orchestrator = new MigrationOrchestrator(options.from as any, options.to as any);

  orchestrator.on((event) => {
    if (event.type === 'progress') {
      logger.info(`[${event.phase}] ${event.message}`);
    }
  });

  try {
    await orchestrator.runExtractPhase();
    await orchestrator.runTransformPhase();

    const bundle = orchestrator.getBundle();
    if (bundle) {
      const outputPath = join(process.cwd(), options.output);
      await writeFile(outputPath, JSON.stringify(bundle, null, 2));
      logger.info(chalk.green(`Exported state container to ${outputPath}`));
    }
  } catch (error) {
    logger.error(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const exportCommandDefinition = (program: Command) => {
  program
    .command('export')
    .description('Export the state container to a portable file')
    .option('-f, --from <platform>', 'Source platform')
    .option('-t, --to <platform>', 'Target platform')
    .option('-o, --output <file>', 'Output file path', 'savestate-bundle.json')
    .action(exportCommand);
};
