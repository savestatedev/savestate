/**
 * savestate config — View/edit configuration
 */

import chalk from 'chalk';
import { isInitialized, loadConfig, saveConfig, localConfigPath } from '../config.js';
import type { SaveStateConfig } from '../types.js';

interface ConfigOptions {
  set?: string;
  json?: boolean;
}

export function formatConfigJson(config: SaveStateConfig): string {
  return JSON.stringify(
    {
      version: config.version,
      storage: config.storage,
      adapters: config.adapters,
      ...(config.encryption !== undefined ? { encryption: config.encryption } : {}),
      ...(config.defaultAdapter !== undefined ? { defaultAdapter: config.defaultAdapter } : {}),
      ...(config.schedule !== undefined ? { schedule: config.schedule } : {}),
      ...(config.retention !== undefined ? { retention: config.retention } : {}),
      ...(config.memory !== undefined ? { memory: config.memory } : {}),
      ...(config.mcp !== undefined ? { mcp: config.mcp } : {}),
      ...(config.integrity !== undefined ? { integrity: config.integrity } : {}),
    },
    null,
    2,
  );
}

/**
 * Set a deeply nested property on an object using dot-notation path.
 * Auto-creates intermediate objects as needed.
 * Coerces 'true'/'false' to boolean and numeric strings to numbers.
 */
function setNestedValue(obj: Record<string, unknown>, path: string, rawValue: string): void {
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  const finalKey = keys[keys.length - 1];

  // Coerce value types
  let value: unknown = rawValue;
  if (rawValue === 'true') value = true;
  else if (rawValue === 'false') value = false;
  else if (/^\d+$/.test(rawValue)) value = parseInt(rawValue, 10);

  current[finalKey] = value;
}

export async function configCommand(options: ConfigOptions): Promise<void> {
  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const configPath = localConfigPath();

  if (options.set) {
    const eqIndex = options.set.indexOf('=');
    if (eqIndex === -1) {
      console.log(chalk.red('  ✗ Invalid format. Use: --set key=value'));
      console.log(chalk.dim('    Example: savestate config --set storage.type=s3'));
      console.log();
      process.exit(1);
    }

    const key = options.set.slice(0, eqIndex);
    const value = options.set.slice(eqIndex + 1);

    setNestedValue(config as unknown as Record<string, unknown>, key, value);
    await saveConfig(config);

    console.log(chalk.green(`  ✓ Set ${chalk.bold(key)} = ${chalk.bold(value)}`));
    console.log(chalk.dim(`    ${configPath}`));
    console.log();
    return;
  }

  if (options.json) {
    console.log(formatConfigJson(config));
    return;
  }

  console.log(chalk.bold('⚙️  SaveState Configuration'));
  console.log(chalk.dim(`   ${configPath}`));
  console.log();

  console.log(`  ${chalk.dim('Version:')}         ${config.version}`);
  console.log(`  ${chalk.dim('Storage:')}         ${config.storage.type}`);

  if (config.storage.options && Object.keys(config.storage.options).length > 0) {
    for (const [key, value] of Object.entries(config.storage.options)) {
      console.log(`  ${chalk.dim(`  ${key}:`)}       ${value}`);
    }
  }

  console.log(`  ${chalk.dim('Default Adapter:')} ${config.defaultAdapter ?? chalk.dim('(auto-detect)')}`);
  console.log(`  ${chalk.dim('Schedule:')}        ${config.schedule ?? chalk.dim('(manual)')}`);

  if (config.retention) {
    console.log(`  ${chalk.dim('Retention:')}`);
    if (config.retention.maxSnapshots) {
      console.log(`  ${chalk.dim('  Max snapshots:')} ${config.retention.maxSnapshots}`);
    }
    if (config.retention.maxAge) {
      console.log(`  ${chalk.dim('  Max age:')}       ${config.retention.maxAge}`);
    }
  }

  if (config.adapters.length > 0) {
    console.log(`  ${chalk.dim('Adapters:')}`);
    for (const adapter of config.adapters) {
      const status = adapter.enabled ? chalk.green('enabled') : chalk.red('disabled');
      console.log(`    • ${adapter.id} (${status})`);
    }
  }

  console.log();
}
