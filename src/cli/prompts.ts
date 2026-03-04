/**
 * Interactive Prompts
 *
 * Lightweight interactive prompts using native readline with nice styling.
 * Supports both interactive and non-interactive modes.
 */

import * as readline from 'node:readline';
import chalk from 'chalk';
import type { Platform } from '../migrate/types.js';
import { PLATFORM_CAPABILITIES } from '../migrate/capabilities.js';

// ─── Types ───────────────────────────────────────────────────

export interface SelectOption<T = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface PromptOptions {
  /** Skip prompts in non-interactive mode */
  nonInteractive?: boolean;
  /** Disable colors */
  noColor?: boolean;
}

// ─── Color Wrapper ───────────────────────────────────────────

let colorsEnabled = true;

export function setColorsEnabled(enabled: boolean): void {
  colorsEnabled = enabled;
}

function c(fn: typeof chalk.cyan, text: string): string {
  return colorsEnabled ? fn(text) : text;
}

// ─── Core Prompt Functions ───────────────────────────────────

/**
 * Create readline interface
 */
function createInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask a simple question
 */
export async function ask(question: string): Promise<string> {
  const rl = createInterface();
  return new Promise((resolve) => {
    rl.question(c(chalk.cyan, question), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Ask for confirmation (yes/no)
 */
export async function confirm(message: string, defaultValue = false): Promise<boolean> {
  const hint = defaultValue ? '(Y/n)' : '(y/N)';
  const answer = await ask(`${message} ${c(chalk.dim, hint)} `);

  if (answer === '') {
    return defaultValue;
  }

  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

/**
 * Select from a list of options with arrow key navigation
 */
export async function select<T>(
  message: string,
  options: SelectOption<T>[],
): Promise<T> {
  return new Promise((resolve) => {
    let selectedIndex = options.findIndex((o) => !o.disabled);
    if (selectedIndex === -1) selectedIndex = 0;

    const render = () => {
      // Clear previous render
      process.stdout.write('\x1B[2K\x1B[1A'.repeat(options.length + 1));
      process.stdout.write('\x1B[2K');

      // Print question
      console.log(c(chalk.cyan, '?') + ' ' + c(chalk.white.bold, message));

      // Print options
      options.forEach((option, index) => {
        const isSelected = index === selectedIndex;
        const prefix = isSelected ? c(chalk.cyan, '❯') : ' ';
        const label = option.disabled
          ? c(chalk.dim, option.label)
          : isSelected
            ? c(chalk.cyan, option.label)
            : option.label;
        const desc = option.description ? ' ' + c(chalk.dim, `- ${option.description}`) : '';

        console.log(`  ${prefix} ${label}${desc}`);
      });
    };

    // Initial render with blank lines
    console.log('');
    options.forEach(() => console.log(''));
    render();

    // Handle keyboard input
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onKeypress = (key: string) => {
      // Handle arrow keys
      if (key === '\x1B[A' || key === 'k') {
        // Up arrow or k
        do {
          selectedIndex = (selectedIndex - 1 + options.length) % options.length;
        } while (options[selectedIndex].disabled);
        render();
      } else if (key === '\x1B[B' || key === 'j') {
        // Down arrow or j
        do {
          selectedIndex = (selectedIndex + 1) % options.length;
        } while (options[selectedIndex].disabled);
        render();
      } else if (key === '\r' || key === '\n') {
        // Enter
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onKeypress);
        process.stdin.pause();

        // Clear and show selected value
        process.stdout.write('\x1B[2K\x1B[1A'.repeat(options.length + 1));
        process.stdout.write('\x1B[2K');
        console.log(
          c(chalk.cyan, '✓') +
            ' ' +
            c(chalk.white.bold, message) +
            ' ' +
            c(chalk.cyan, options[selectedIndex].label),
        );

        resolve(options[selectedIndex].value);
      } else if (key === '\x03') {
        // Ctrl+C
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onKeypress);
        process.stdin.pause();
        process.exit(130);
      }
    };

    process.stdin.on('data', onKeypress);
  });
}

/**
 * Multi-select from a list of options
 */
export async function multiSelect<T>(
  message: string,
  options: SelectOption<T>[],
): Promise<T[]> {
  return new Promise((resolve) => {
    let selectedIndex = 0;
    const selected = new Set<number>();

    const render = () => {
      // Clear previous render
      process.stdout.write('\x1B[2K\x1B[1A'.repeat(options.length + 2));
      process.stdout.write('\x1B[2K');

      // Print question
      console.log(c(chalk.cyan, '?') + ' ' + c(chalk.white.bold, message) + c(chalk.dim, ' (space to toggle, enter to confirm)'));

      // Print options
      options.forEach((option, index) => {
        const isHighlighted = index === selectedIndex;
        const isChecked = selected.has(index);
        const cursor = isHighlighted ? c(chalk.cyan, '❯') : ' ';
        const checkbox = isChecked ? c(chalk.green, '◉') : c(chalk.dim, '○');
        const label = isHighlighted ? c(chalk.cyan, option.label) : option.label;
        const desc = option.description ? ' ' + c(chalk.dim, `- ${option.description}`) : '';

        console.log(`  ${cursor} ${checkbox} ${label}${desc}`);
      });

      console.log(c(chalk.dim, `  ${selected.size} selected`));
    };

    // Initial render
    console.log('');
    options.forEach(() => console.log(''));
    console.log('');
    render();

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onKeypress = (key: string) => {
      if (key === '\x1B[A' || key === 'k') {
        selectedIndex = (selectedIndex - 1 + options.length) % options.length;
        render();
      } else if (key === '\x1B[B' || key === 'j') {
        selectedIndex = (selectedIndex + 1) % options.length;
        render();
      } else if (key === ' ') {
        // Space - toggle selection
        if (selected.has(selectedIndex)) {
          selected.delete(selectedIndex);
        } else {
          selected.add(selectedIndex);
        }
        render();
      } else if (key === '\r' || key === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onKeypress);
        process.stdin.pause();

        // Clear and show selected values
        process.stdout.write('\x1B[2K\x1B[1A'.repeat(options.length + 2));
        process.stdout.write('\x1B[2K');

        const selectedLabels = [...selected].map((i) => options[i].label).join(', ');
        console.log(
          c(chalk.cyan, '✓') +
            ' ' +
            c(chalk.white.bold, message) +
            ' ' +
            c(chalk.cyan, selectedLabels || 'none'),
        );

        resolve([...selected].map((i) => options[i].value));
      } else if (key === '\x03') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onKeypress);
        process.stdin.pause();
        process.exit(130);
      }
    };

    process.stdin.on('data', onKeypress);
  });
}

// ─── Platform-Specific Prompts ───────────────────────────────

/**
 * Select a source platform
 */
export async function selectSourcePlatform(): Promise<Platform> {
  const options: SelectOption<Platform>[] = Object.entries(PLATFORM_CAPABILITIES)
    .map(([id, cap]) => ({
      value: id as Platform,
      label: cap.name,
      description: getSourceDescription(id as Platform),
    }));

  return select('Select source platform (migrate FROM):', options);
}

/**
 * Select a target platform
 */
export async function selectTargetPlatform(source: Platform): Promise<Platform> {
  const options: SelectOption<Platform>[] = Object.entries(PLATFORM_CAPABILITIES)
    .filter(([id]) => id !== source)
    .map(([id, cap]) => ({
      value: id as Platform,
      label: cap.name,
      description: getTargetDescription(id as Platform),
      disabled: id === source,
    }));

  return select('Select target platform (migrate TO):', options);
}

/**
 * Select content types to include
 */
export async function selectContentTypes(): Promise<string[]> {
  const options: SelectOption<string>[] = [
    { value: 'instructions', label: 'Instructions', description: 'System prompts, personality' },
    { value: 'memories', label: 'Memories', description: 'Learned facts, preferences' },
    { value: 'conversations', label: 'Conversations', description: 'Chat history' },
    { value: 'files', label: 'Files', description: 'Uploaded documents' },
    { value: 'customBots', label: 'Custom Bots', description: 'GPTs, projects' },
  ];

  return multiSelect('Select content to migrate:', options);
}

// ─── Helpers ─────────────────────────────────────────────────

function getSourceDescription(platform: Platform): string {
  const descriptions: Record<Platform, string> = {
    chatgpt: 'OpenAI ChatGPT',
    claude: 'Anthropic Claude',
    gemini: 'Google Gemini',
    copilot: 'Microsoft Copilot',
  };
  return descriptions[platform] || '';
}

function getTargetDescription(platform: Platform): string {
  const cap = PLATFORM_CAPABILITIES[platform];
  const features: string[] = [];

  if (cap.hasMemory) features.push('memories');
  if (cap.hasProjects) features.push('projects');
  if (cap.hasFiles) features.push('files');

  return features.length > 0 ? `Supports: ${features.join(', ')}` : '';
}
