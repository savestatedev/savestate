/**
 * savestate config — View/edit configuration
 */

import chalk from 'chalk';
import { isInitialized, loadConfig, saveConfig, localConfigPath } from '../config.js';
import type { SaveStateConfig } from '../types.js';

interface ConfigOptions {
  set?: string;
  limit?: string;
  offset?: string;
  json?: boolean;
}

const MAX_CONFIG_LIMIT = 1000;
const MAX_CONFIG_OFFSET = 1000;

/** Parse config --limit without turning user input errors into an empty adapter list. */
export function parseConfigLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!/^\d+$/.test(value)) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_CONFIG_LIMIT}.`,
    );
  }

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CONFIG_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_CONFIG_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N configured adapters when --limit is set. */
export function selectConfigAdapters<T>(adapters: T[], limit?: number): T[] {
  if (limit === undefined) return adapters;
  return adapters.slice(0, limit);
}

/** Parse config --offset without turning user input errors into an empty adapter list. */
export function parseConfigOffset(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const trimmed = value.trim();
  const offset = Number(trimmed);
  if (
    trimmed.length === 0 ||
    !/^\d+$/.test(trimmed) ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > MAX_CONFIG_OFFSET
  ) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_CONFIG_OFFSET}.`,
    );
  }
  return offset;
}

/** Skip the first N configured adapters when --offset is set. */
export function selectConfigOffsetEntries<T>(adapters: T[], offset?: number): T[] {
  if (offset === undefined) return adapters;
  return adapters.slice(offset);
}

/** Apply config --offset then --limit. */
export function applyConfigFilters<T>(
  adapters: T[],
  options: { offset?: string; limit?: string },
): T[] {
  return selectConfigAdapters(
    selectConfigOffsetEntries(adapters, parseConfigOffset(options.offset)),
    parseConfigLimit(options.limit),
  );
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

export interface ConfigMissingJson {
  found: false;
  version: null;
  storage: null;
  defaultAdapter: null;
}

export function formatConfigMissingJson(): string {
  return JSON.stringify(
    {
      found: false,
      version: null,
      storage: null,
      defaultAdapter: null,
    },
    null,
    2,
  );
}

export interface ConfigSetAssignment {
  path: string;
  value: string;
}

/** Parse config --set without treating blank or malformed pairs as updates. */
export function parseConfigSet(value: string | undefined): ConfigSetAssignment | undefined {
  if (value === undefined) return undefined;

  const trimmed = value.trim();
  const eq = trimmed.indexOf('=');
  if (eq <= 0 || eq === trimmed.length - 1) {
    throw new Error(
      `Invalid --set value "${value}". Expected a non-empty key=value pair.`,
    );
  }

  const path = trimmed.slice(0, eq).trim();
  const parsedValue = trimmed.slice(eq + 1).trim();
  if (path.length === 0 || parsedValue.length === 0) {
    throw new Error(
      `Invalid --set value "${value}". Expected a non-empty key=value pair.`,
    );
  }

  return { path, value: parsedValue };
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
  parseConfigLimit(options.limit);
  parseConfigOffset(options.offset);

  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    if (options.json) {
      console.log(formatConfigMissingJson());
      return;
    }
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const configPath = localConfigPath();

  const assignment = parseConfigSet(options.set);
  if (assignment) {
    setNestedValue(config as unknown as Record<string, unknown>, assignment.path, assignment.value);
    await saveConfig(config);

    console.log(chalk.green(`  ✓ Set ${chalk.bold(assignment.path)} = ${chalk.bold(assignment.value)}`));
    console.log(chalk.dim(`    ${configPath}`));
    console.log();
    return;
  }

  const adapters = applyConfigFilters(config.adapters, options);

  if (options.json) {
    console.log(formatConfigJson({ ...config, adapters }));
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

  if (adapters.length > 0) {
    console.log(`  ${chalk.dim('Adapters:')}`);
    for (const adapter of adapters) {
      const status = adapter.enabled ? chalk.green('enabled') : chalk.red('disabled');
      console.log(`    • ${adapter.id} (${status})`);
    }
  }

  console.log();
}
