/**
 * savestate antibodies — Failure antibody commands
 */

import chalk from 'chalk';
import { isInitialized } from '../config.js';
import { AntibodyEngine, AntibodyStore, deriveRuleId } from '../antibodies/index.js';
import type {
  AntibodyRule,
  Intervention,
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

export type AntibodiesPreflightReasonJson = 'tool' | 'error_code' | 'path_prefix' | 'tag' | 'semantic';

export interface AntibodiesPreflightWarningJson {
  ruleId: string;
  risk: RiskLevel;
  intervention: Intervention;
  confidence: number;
  safeAction: SafeActionType;
  reasons: AntibodiesPreflightReasonJson[];
}

export interface AntibodiesPreflightJson {
  blocked: boolean;
  elapsedMs: number;
  semanticUsed: boolean;
  warnings: AntibodiesPreflightWarningJson[];
}

export function formatAntibodiesPreflightJson(result: AntibodiesPreflightJson): string {
  return JSON.stringify(
    {
      blocked: result.blocked,
      elapsedMs: result.elapsedMs,
      semanticUsed: result.semanticUsed,
      warnings: result.warnings.map((warning) => ({
        ruleId: warning.ruleId,
        risk: warning.risk,
        intervention: warning.intervention,
        confidence: warning.confidence,
        safeAction: warning.safeAction,
        reasons: [...warning.reasons],
      })),
    },
    null,
    2,
  );
}

export interface AntibodiesListRuleJson {
  id: string;
  risk: RiskLevel;
  intervention: Intervention;
  active: boolean;
  confidence: number;
  hits: number;
  overrides: number;
  safeAction: SafeActionType;
}

export interface AntibodiesListJson {
  rules: AntibodiesListRuleJson[];
}

export function formatAntibodiesListJson(result: AntibodiesListJson): string {
  return JSON.stringify(
    {
      rules: result.rules.map((rule) => ({
        id: rule.id,
        risk: rule.risk,
        intervention: rule.intervention,
        active: rule.active,
        confidence: rule.confidence,
        hits: rule.hits,
        overrides: rule.overrides,
        safeAction: rule.safeAction,
      })),
    },
    null,
    2,
  );
}

export interface AntibodiesStatsRuleJson {
  id: string;
  risk: RiskLevel;
  intervention: Intervention;
  active: boolean;
  confidence: number;
  hits: number;
  overrides: number;
}

export interface AntibodiesStatsJson {
  totalRules: number;
  activeRules: number;
  retiredRules: number;
  totalHits: number;
  totalOverrides: number;
  rules: AntibodiesStatsRuleJson[];
}

export function formatAntibodiesStatsJson(stats: AntibodiesStatsJson): string {
  return JSON.stringify(
    {
      totalRules: stats.totalRules,
      activeRules: stats.activeRules,
      retiredRules: stats.retiredRules,
      totalHits: stats.totalHits,
      totalOverrides: stats.totalOverrides,
      rules: stats.rules.map((rule) => ({
        id: rule.id,
        risk: rule.risk,
        intervention: rule.intervention,
        active: rule.active,
        confidence: rule.confidence,
        hits: rule.hits,
        overrides: rule.overrides,
      })),
    },
    null,
    2,
  );
}

export interface AntibodiesAddJson {
  id: string;
  risk: RiskLevel;
  safeAction: SafeActionType;
  confidence: number;
}

export function formatAntibodiesAddJson(result: AntibodiesAddJson): string {
  return JSON.stringify(
    {
      id: result.id,
      risk: result.risk,
      safeAction: result.safeAction,
      confidence: result.confidence,
    },
    null,
    2,
  );
}

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
    console.log(
      formatAntibodiesListJson({
        rules: rules.map((rule) => ({
          id: rule.id,
          risk: rule.risk,
          intervention: rule.intervention,
          active: !rule.retired_at,
          confidence: rule.confidence,
          hits: rule.hits,
          overrides: rule.overrides,
          safeAction: rule.safe_action.type,
        })),
      }),
    );
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

  if (options.json) {
    console.log(
      formatAntibodiesAddJson({
        id: created.id,
        risk: created.risk,
        safeAction: created.safe_action.type,
        confidence: created.confidence,
      }),
    );
    return;
  }

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
    console.log(
      formatAntibodiesPreflightJson({
        blocked: result.blocked,
        elapsedMs: result.elapsed_ms,
        semanticUsed: result.semantic_used,
        warnings: result.warnings.map((warning) => ({
          ruleId: warning.rule_id,
          risk: warning.risk,
          intervention: warning.intervention,
          confidence: warning.confidence,
          safeAction: warning.safe_action.type,
          reasons: [...warning.reason_codes],
        })),
      }),
    );
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
    console.log(
      formatAntibodiesStatsJson({
        totalRules: stats.total_rules,
        activeRules: stats.active_rules,
        retiredRules: stats.retired_rules,
        totalHits: stats.total_hits,
        totalOverrides: stats.total_overrides,
        rules: stats.rules.map((rule) => ({
          id: rule.id,
          risk: rule.risk,
          intervention: rule.intervention,
          active: rule.active,
          confidence: rule.confidence,
          hits: rule.hits,
          overrides: rule.overrides,
        })),
      }),
    );
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
