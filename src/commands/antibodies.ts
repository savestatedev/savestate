/**
 * savestate antibodies — Failure antibody commands
 */

import chalk from 'chalk';
import { isInitialized } from '../config.js';
import { AntibodyEngine, AntibodyStore, deriveRuleId } from '../antibodies/index.js';
import type {
  AntibodyRule,
  PreflightContext,
  RiskLevel,
  SafeActionType,
} from '../antibodies/index.js';

interface AntibodiesOptions {
  id?: string;
  all?: boolean;
  json?: boolean;
  tool?: string;
  errorCode?: string;
  path?: string;
  pathPrefix?: string;
  tags?: string;
  risk?: string;
  safeAction?: string;
  confidence?: string;
  semantic?: boolean;
}

const RISK_LEVELS: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
const SAFE_ACTION_TYPES: SafeActionType[] = [
  'retry_with_backoff',
  'check_permissions',
  'validate_inputs',
  'run_read_only_probe',
  'confirm_with_user',
];

export async function antibodiesCommand(subcommand: string, options: AntibodiesOptions): Promise<void> {
  console.log();

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const store = new AntibodyStore();

  switch (subcommand) {
    case 'list':
      await listRules(store, options);
      return;
    case 'add':
      await addRule(store, options);
      return;
    case 'preflight':
      await runPreflight(store, options);
      return;
    case 'stats':
      await showStats(store, options);
      return;
    default:
      showUsage();
      process.exit(1);
  }
}

async function listRules(store: AntibodyStore, options: AntibodiesOptions): Promise<void> {
  const rules = await store.list({ activeOnly: !options.all });

  if (options.json) {
    console.log(JSON.stringify(rules, null, 2));
    return;
  }

  console.log(chalk.bold('🧬 Failure Antibodies'));
  console.log(chalk.dim(`   ${store.path()}`));
  console.log();

  if (rules.length === 0) {
    console.log(chalk.dim('  No antibody rules found.'));
    console.log(chalk.dim('  Create one: savestate antibodies add --tool <name> --error-code <code>'));
    console.log();
    return;
  }

  for (const rule of rules) {
    const state = rule.retired_at ? chalk.dim('retired') : chalk.green('active');
    const confidence = `${Math.round(rule.confidence * 100)}%`;
    console.log(
      `  ${chalk.cyan(rule.id)}  ${rule.risk.padEnd(8)} ${rule.intervention.padEnd(7)} ${confidence.padEnd(4)} ${state}`,
    );
    console.log(`    trigger: ${formatTrigger(rule)}`);
    console.log(`    safe_action: ${rule.safe_action.type}  hits: ${rule.hits}  overrides: ${rule.overrides}`);
  }

  console.log();
}

async function addRule(store: AntibodyStore, options: AntibodiesOptions): Promise<void> {
  const tags = parseTags(options.tags);
  const risk = parseRisk(options.risk);
  const safeAction = parseSafeAction(options.safeAction);
  const confidence = parseConfidence(options.confidence);
  const pathPrefix = normalizePathPrefix(options.pathPrefix);
  const errorCode = options.errorCode?.toUpperCase();

  if (!options.tool && !errorCode && !pathPrefix && tags.length === 0) {
    console.log(chalk.red('✗ Provide at least one trigger: --tool, --error-code, --path-prefix, or --tags'));
    process.exit(1);
  }

  const partialRule = {
    trigger: {
      tool: options.tool?.trim(),
      error_codes: errorCode ? [errorCode] : undefined,
      path_prefixes: pathPrefix ? [pathPrefix] : undefined,
      tags: tags.length > 0 ? tags : undefined,
    },
    risk,
    safe_action: { type: safeAction },
    scope: {
      project: 'local',
    },
    confidence,
    intervention: 'warn' as const,
  };

  const rule: AntibodyRule = {
    ...partialRule,
    id: options.id ?? deriveRuleId(partialRule),
    created_at: new Date().toISOString(),
    source_event_ids: [],
    hits: 0,
    overrides: 0,
  };

  const created = await store.add(rule);

  console.log(chalk.green(`✓ Antibody rule saved: ${created.id}`));
  console.log(chalk.dim(`  safe_action=${created.safe_action.type} confidence=${created.confidence}`));
  console.log();
}

async function runPreflight(store: AntibodyStore, options: AntibodiesOptions): Promise<void> {
  const context: PreflightContext = {
    tool: options.tool?.trim(),
    error_code: options.errorCode?.toUpperCase(),
    path: options.path,
    tags: parseTags(options.tags),
  };

  const engine = new AntibodyEngine(store, {
    enableSemanticMatching: options.semantic,
  });

  const result = await engine.preflight(context);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(chalk.bold('🔎 Antibody Preflight'));
  console.log(chalk.dim(`   elapsed=${result.elapsed_ms}ms semantic=${result.semantic_used ? 'on' : 'off'}`));
  console.log();

  if (result.warnings.length === 0) {
    console.log(chalk.green('  No warnings.'));
    console.log();
    return;
  }

  for (const warning of result.warnings) {
    console.log(
      `  ${chalk.yellow('warn')} ${chalk.cyan(warning.rule_id)} ${warning.risk} ${warning.safe_action.type} confidence=${warning.confidence.toFixed(2)}`,
    );
    console.log(`    reasons: ${warning.reason_codes.join(', ')}`);
  }

  console.log();
}

async function showStats(store: AntibodyStore, options: AntibodiesOptions): Promise<void> {
  const stats = await store.stats();

  if (options.json) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  console.log(chalk.bold('📈 Antibody Stats'));
  console.log(chalk.dim(`   ${store.path()}`));
  console.log();
  console.log(`  total rules:     ${stats.total_rules}`);
  console.log(`  active rules:    ${stats.active_rules}`);
  console.log(`  retired rules:   ${stats.retired_rules}`);
  console.log(`  total hits:      ${stats.total_hits}`);
  console.log(`  total overrides: ${stats.total_overrides}`);
  console.log();

  if (stats.rules.length > 0) {
    const top = [...stats.rules]
      .sort((a, b) => b.hits - a.hits || a.id.localeCompare(b.id))
      .slice(0, 10);
    console.log(chalk.dim('  Top rules by hits:'));
    for (const rule of top) {
      console.log(`    ${rule.id}  hits=${rule.hits} overrides=${rule.overrides} active=${rule.active}`);
    }
    console.log();
  }
}

function parseTags(raw?: string): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(',').map((token) => token.trim().toLowerCase()).filter(Boolean))];
}

function parseRisk(raw?: string): RiskLevel {
  if (!raw) return 'medium';
  const normalized = raw.trim().toLowerCase();
  if (RISK_LEVELS.includes(normalized as RiskLevel)) {
    return normalized as RiskLevel;
  }

  console.log(chalk.red(`✗ Invalid risk: ${raw}`));
  console.log(chalk.dim(`  Allowed: ${RISK_LEVELS.join(', ')}`));
  process.exit(1);
}

function parseSafeAction(raw?: string): SafeActionType {
  if (!raw) return 'validate_inputs';
  const normalized = raw.trim().toLowerCase() as SafeActionType;
  if (SAFE_ACTION_TYPES.includes(normalized)) {
    return normalized;
  }

  console.log(chalk.red(`✗ Invalid safe action: ${raw}`));
  console.log(chalk.dim(`  Allowed: ${SAFE_ACTION_TYPES.join(', ')}`));
  process.exit(1);
}

function parseConfidence(raw?: string): number {
  if (!raw) return 0.7;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    console.log(chalk.red('✗ --confidence must be a number between 0 and 1'));
    process.exit(1);
  }
  return Number(value.toFixed(3));
}

function normalizePathPrefix(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function formatTrigger(rule: AntibodyRule): string {
  const parts: string[] = [];
  if (rule.trigger.tool) {
    parts.push(`tool=${rule.trigger.tool}`);
  }
  if (rule.trigger.error_codes?.length) {
    parts.push(`error=${rule.trigger.error_codes.join('|')}`);
  }
  if (rule.trigger.path_prefixes?.length) {
    parts.push(`path=${rule.trigger.path_prefixes.join('|')}`);
  }
  if (rule.trigger.tags?.length) {
    parts.push(`tags=${rule.trigger.tags.join('|')}`);
  }
  return parts.join(' ');
}

function showUsage(): void {
  console.log(chalk.bold('Failure Antibody commands:'));
  console.log();
  console.log('  savestate antibodies list [--all] [--json]');
  console.log('  savestate antibodies add --tool <name> [--error-code <code>] [--path-prefix <prefix>]');
  console.log('                             [--tags <a,b>] [--risk <level>] [--safe-action <type>]');
  console.log('                             [--confidence <0..1>] [--id <rule-id>]');
  console.log('  savestate antibodies preflight [--tool <name>] [--error-code <code>] [--path <path>]');
  console.log('                                  [--tags <a,b>] [--semantic] [--json]');
  console.log('  savestate antibodies stats [--json]');
  console.log();
}
