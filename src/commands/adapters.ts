/**
 * savestate adapters — List available platform adapters
 */

import chalk from 'chalk';
import ora from 'ora';
import { getAdapterInfo } from '../adapters/registry.js';
import { isInitialized } from '../config.js';

export interface AdapterListEntry {
  id: string;
  name: string;
  platform: string;
  version: string;
  detected: boolean;
}

interface AdaptersOptions {
  json?: boolean;
  limit?: string;
  offset?: string;
}

const MAX_ADAPTERS_LIMIT = 1000;
const MAX_ADAPTERS_OFFSET = 1000;

/** Parse adapters --limit without turning user input errors into an empty adapter list. */
export function parseAdaptersLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_ADAPTERS_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_ADAPTERS_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N adapters when --limit is set. */
export function selectAdapters(
  adapters: AdapterListEntry[],
  limit?: number,
): AdapterListEntry[] {
  if (limit === undefined) return adapters;
  return adapters.slice(0, limit);
}

/** Parse adapters --offset without turning user input errors into an empty adapter list. */
export function parseAdaptersOffset(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const offset = Number(value);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_ADAPTERS_OFFSET) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_ADAPTERS_OFFSET}.`,
    );
  }
  return offset;
}

/** Skip the first N adapters when --offset is set. */
export function selectAdaptersOffset<T>(adapters: T[], offset?: number): T[] {
  if (offset === undefined) return adapters;
  return adapters.slice(offset);
}

/** Apply adapters --offset then --limit. */
export function applyAdaptersFilters(
  adapters: AdapterListEntry[],
  options: { offset?: string; limit?: string },
): AdapterListEntry[] {
  return selectAdapters(
    selectAdaptersOffset(adapters, parseAdaptersOffset(options.offset)),
    parseAdaptersLimit(options.limit),
  );
}

export function formatAdaptersJson(adapters: AdapterListEntry[]): string {
  return JSON.stringify(adapters, null, 2);
}

export interface AdaptersMissingJson {
  found: false;
  total: 0;
}

export function formatAdaptersMissingJson(): string {
  return JSON.stringify(
    {
      found: false,
      total: 0,
    },
    null,
    2,
  );
}

export async function adaptersCommand(options: AdaptersOptions = {}): Promise<void> {
  if (!isInitialized()) {
    if (options.json) {
      console.log(formatAdaptersMissingJson());
      return;
    }
    console.log();
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  if (!options.json) {
    console.log();
    console.log(chalk.bold('🔌 Available Adapters'));
    console.log();
  }

  const spinner = options.json ? null : ora('Scanning for adapters...').start();

  try {
    const adapterInfos = applyAdaptersFilters(await getAdapterInfo(), options);
    spinner?.stop();

    if (options.json) {
      console.log(formatAdaptersJson(adapterInfos));
      return;
    }

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
    console.log(chalk.dim('    • gemini            — Google Gemini & Gems (Takeout export + optional API)'));
    console.log();
    console.log(chalk.dim('  Coming soon:'));
    console.log(chalk.dim('    • custom-files  — Configurable file-based agents'));
    console.log();
    console.log(chalk.dim('  Install community adapters:'));
    console.log(chalk.dim(`    ${chalk.white('npm install @savestate/adapter-<name>')}`));
    console.log();

  } catch (err) {
    if (spinner) {
      spinner.fail('Failed to list adapters');
    }
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}
