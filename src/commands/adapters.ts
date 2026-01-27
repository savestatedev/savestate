/**
 * savestate adapters — List available platform adapters
 */

import chalk from 'chalk';
import ora from 'ora';
import { getAdapterInfo } from '../adapters/registry.js';

export async function adaptersCommand(): Promise<void> {
  console.log();
  console.log(chalk.bold('🔌 Available Adapters'));
  console.log();

  const spinner = ora('Scanning for adapters...').start();

  try {
    const adapterInfos = await getAdapterInfo();
    spinner.stop();

    if (adapterInfos.length === 0) {
      console.log(chalk.dim('  No adapters found.'));
    } else {
      for (const info of adapterInfos) {
        const detected = info.detected
          ? chalk.green('● detected')
          : chalk.dim('○ not detected');

        console.log(`  ${chalk.cyan(info.name)} ${chalk.dim(`v${info.version}`)}`);
        console.log(`    ID: ${info.id}  |  Platform: ${info.platform}  |  ${detected}`);
        console.log();
      }
    }

    console.log(chalk.dim('  Built-in adapters:'));
    console.log(chalk.dim('    • clawdbot     — Clawdbot/Moltbot workspaces (SOUL.md, memory/, etc.)'));
    console.log();
    console.log(chalk.dim('  Coming soon:'));
    console.log(chalk.dim('    • chatgpt      — ChatGPT conversations & memories'));
    console.log(chalk.dim('    • claude        — Claude memory & projects'));
    console.log(chalk.dim('    • openai-asst   — OpenAI Assistants API'));
    console.log(chalk.dim('    • gemini        — Google Gemini & Gems'));
    console.log(chalk.dim('    • custom-files  — Configurable file-based agents'));
    console.log();
    console.log(chalk.dim('  Install community adapters:'));
    console.log(chalk.dim(`    ${chalk.white('npm install @savestate/adapter-chatgpt')}`));
    console.log();

  } catch (err) {
    spinner.fail('Failed to list adapters');
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}
