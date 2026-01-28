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
    console.log(chalk.dim('    • clawdbot          — Clawdbot/Moltbot workspaces (SOUL.md, memory/, skills/, etc.)'));
    console.log(chalk.dim('    • claude-code       — Claude Code projects (CLAUDE.md, .claude/, settings)'));
    console.log(chalk.dim('    • claude-web        — Claude.ai conversations, memory & projects (data export)'));
    console.log(chalk.dim('    • openai-assistants  — OpenAI Assistants API (config, files, vector stores, threads)'));
    console.log(chalk.dim('    • chatgpt           — ChatGPT data export (conversations, memories, instructions)'));
    console.log();
    console.log(chalk.dim('  Coming soon:'));
    console.log(chalk.dim('    • gemini        — Google Gemini & Gems'));
    console.log(chalk.dim('    • custom-files  — Configurable file-based agents'));
    console.log();
    console.log(chalk.dim('  Install community adapters:'));
    console.log(chalk.dim(`    ${chalk.white('npm install @savestate/adapter-<name>')}`));
    console.log();

  } catch (err) {
    spinner.fail('Failed to list adapters');
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}
