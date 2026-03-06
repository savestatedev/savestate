/**
 * savestate identity — Agent identity management commands (Issue #92)
 *
 * Commands:
 *   savestate identity show           Display current identity
 *   savestate identity init <name>    Initialize new identity
 *   savestate identity set <field> <value>  Update identity field
 *   savestate identity schema         Show JSON schema
 */

import chalk from 'chalk';
import ora from 'ora';
import { isInitialized } from '../config.js';
import {
  loadLocalIdentity,
  initializeIdentity,
  updateIdentityField,
  getIdentityVersion,
} from '../identity/store.js';
import { getJsonSchema, CORE_IDENTITY_FIELDS } from '../identity/schema.js';
import type { AgentIdentity } from '../identity/schema.js';

interface IdentityOptions {
  json?: boolean;
}

export async function identityCommand(
  subcommand: string,
  args: string[],
  options?: IdentityOptions,
): Promise<void> {
  console.log();

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  switch (subcommand) {
    case 'show':
      await showIdentity(options);
      break;
    case 'init':
      await initIdentity(args[0], options);
      break;
    case 'set':
      await setIdentityField(args[0], args.slice(1).join(' '), options);
      break;
    case 'schema':
      showSchema(options);
      break;
    default:
      console.log(chalk.red(`Unknown subcommand: ${subcommand}`));
      console.log();
      console.log('Usage:');
      console.log('  savestate identity show           Display current identity');
      console.log('  savestate identity init <name>    Initialize new identity');
      console.log('  savestate identity set <field> <value>  Update identity field');
      console.log('  savestate identity schema         Show JSON schema');
      process.exit(1);
  }
}

/**
 * Display the current identity.
 */
async function showIdentity(options?: IdentityOptions): Promise<void> {
  const spinner = ora('Loading identity...').start();

  try {
    const result = await loadLocalIdentity();

    if (!result) {
      spinner.warn('No identity found');
      console.log();
      console.log(chalk.dim('  Initialize with: savestate identity init <name>'));
      console.log();
      return;
    }

    spinner.succeed('Identity loaded');
    console.log();

    const { identity } = result;

    if (options?.json) {
      console.log(JSON.stringify(identity, null, 2));
      return;
    }

    // Human-readable display
    const version = getIdentityVersion(identity);

    console.log(chalk.bold.cyan('Agent Identity'));
    console.log();
    console.log(`  ${chalk.dim('Name:')}         ${identity.name}`);
    console.log(`  ${chalk.dim('Version:')}      ${identity.version}`);
    console.log(`  ${chalk.dim('Schema:')}       ${identity.schemaVersion}`);

    if (identity.tone) {
      console.log(`  ${chalk.dim('Tone:')}         ${identity.tone}`);
    }

    if (identity.persona) {
      console.log(`  ${chalk.dim('Persona:')}      ${truncate(identity.persona, 50)}`);
    }

    if (identity.goals && identity.goals.length > 0) {
      console.log();
      console.log(chalk.bold('  Goals:'));
      for (const goal of identity.goals) {
        console.log(`    • ${truncate(goal, 60)}`);
      }
    }

    if (identity.constraints && identity.constraints.length > 0) {
      console.log();
      console.log(chalk.bold('  Constraints:'));
      for (const constraint of identity.constraints) {
        console.log(`    • ${truncate(constraint, 60)}`);
      }
    }

    if (identity.tools && identity.tools.length > 0) {
      console.log();
      console.log(chalk.bold('  Tools:'));
      for (const tool of identity.tools) {
        const status = tool.enabled ? chalk.green('enabled') : chalk.red('disabled');
        console.log(`    • ${tool.name} (${status})`);
      }
    }

    if (identity.instructions) {
      console.log();
      console.log(chalk.bold('  Instructions:'));
      const lines = identity.instructions.split('\n').slice(0, 5);
      for (const line of lines) {
        console.log(`    ${truncate(line, 60)}`);
      }
      if (identity.instructions.split('\n').length > 5) {
        console.log(chalk.dim('    ...'));
      }
    }

    if (identity.metadata && Object.keys(identity.metadata).length > 0) {
      console.log();
      console.log(chalk.bold('  Metadata:'));
      for (const [key, value] of Object.entries(identity.metadata)) {
        console.log(`    ${key}: ${formatValue(value)}`);
      }
    }

    console.log();
    console.log(chalk.dim(`  Created: ${identity.createdAt || 'unknown'}`));
    console.log(chalk.dim(`  Updated: ${identity.updatedAt || 'unknown'}`));
    console.log(chalk.dim(`  Hash: ${version.contentHash}`));
    console.log();
  } catch (err) {
    spinner.fail('Failed to load identity');
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

/**
 * Initialize a new identity.
 */
async function initIdentity(name: string | undefined, options?: IdentityOptions): Promise<void> {
  if (!name) {
    console.log(chalk.red('✗ Name is required'));
    console.log();
    console.log('Usage: savestate identity init <name>');
    process.exit(1);
  }

  const spinner = ora('Initializing identity...').start();

  try {
    // Check if identity already exists
    const existing = await loadLocalIdentity();
    if (existing) {
      spinner.warn('Identity already exists');
      console.log();
      console.log(chalk.dim('  Current identity:'), existing.identity.name);
      console.log(chalk.dim('  To update, use:'), 'savestate identity set <field> <value>');
      console.log();
      return;
    }

    const { identity, path } = await initializeIdentity(name);

    spinner.succeed('Identity initialized');
    console.log();

    if (options?.json) {
      console.log(JSON.stringify(identity, null, 2));
      return;
    }

    console.log(`  ${chalk.dim('Name:')}     ${identity.name}`);
    console.log(`  ${chalk.dim('Version:')}  ${identity.version}`);
    console.log(`  ${chalk.dim('File:')}     ${path}`);
    console.log();
    console.log(chalk.dim('  Add goals:       savestate identity set goals \'["Goal 1", "Goal 2"]\''));
    console.log(chalk.dim('  Set tone:        savestate identity set tone professional'));
    console.log(chalk.dim('  Add constraint:  savestate identity set constraints \'["Constraint 1"]\''));
    console.log();
  } catch (err) {
    spinner.fail('Failed to initialize identity');
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

/**
 * Set an identity field.
 */
async function setIdentityField(
  field: string | undefined,
  value: string | undefined,
  options?: IdentityOptions,
): Promise<void> {
  if (!field) {
    console.log(chalk.red('✗ Field name is required'));
    console.log();
    console.log('Usage: savestate identity set <field> <value>');
    console.log();
    console.log('Core fields:', CORE_IDENTITY_FIELDS.join(', '));
    console.log('Nested fields: metadata.<key>');
    process.exit(1);
  }

  if (value === undefined || value === '') {
    console.log(chalk.red('✗ Value is required'));
    console.log();
    console.log('Usage: savestate identity set <field> <value>');
    console.log();
    console.log('Examples:');
    console.log('  savestate identity set tone professional');
    console.log('  savestate identity set goals \'["Help users", "Be helpful"]\'');
    console.log('  savestate identity set metadata.customKey "custom value"');
    process.exit(1);
  }

  const spinner = ora(`Setting ${field}...`).start();

  try {
    const updated = await updateIdentityField(field, value);

    spinner.succeed(`Updated ${field}`);
    console.log();

    if (options?.json) {
      console.log(JSON.stringify(updated, null, 2));
      return;
    }

    // Show what changed
    const displayValue = (updated as Record<string, unknown>)[field];
    console.log(`  ${chalk.dim('Field:')}    ${field}`);
    console.log(`  ${chalk.dim('Value:')}    ${formatValue(displayValue)}`);
    console.log(`  ${chalk.dim('Version:')}  ${updated.version}`);
    console.log();
  } catch (err) {
    spinner.fail(`Failed to set ${field}`);
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

/**
 * Show the JSON schema.
 */
function showSchema(options?: IdentityOptions): void {
  const schema = getJsonSchema();

  if (options?.json) {
    console.log(JSON.stringify(schema, null, 2));
    return;
  }

  console.log(chalk.bold.cyan('Agent Identity JSON Schema'));
  console.log();
  console.log(JSON.stringify(schema, null, 2));
  console.log();
}

/**
 * Truncate a string for display.
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Format a value for display.
 */
function formatValue(val: unknown): string {
  if (val === undefined) return chalk.dim('undefined');
  if (val === null) return chalk.dim('null');
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return `[${val.length} items]`;
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}
