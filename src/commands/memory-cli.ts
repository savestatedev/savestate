/**
 * SaveState Memory CLI Commands
 *
 * Registers the memory tier management commands and lifecycle controls.
 * Issue #110: Memory Lifecycle Controls - mutation, correction, expiry, audit
 */

import type { Command } from 'commander';
import {
  listMemories,
  promoteMemoryCommand,
  demoteMemoryCommand,
  pinMemoryCommand,
  unpinMemoryCommand,
  applyPoliciesCommand,
  showTierConfig,
  explainMemoryCommand,
  parseMemoryConfigLimit,
  parseMemoryConfigOffset,
  parseMemoryListOffset,
  parseMemoryMinImportance,
  parseMemoryMaxImportance,
  type MemoryFreshnessState,
} from './memory.js';
import {
  editMemoryCommand,
  deleteMemoryCommand,
  rollbackMemoryCommand,
  expireMemoriesCommand,
  memoryLogCommand,
} from './memory-lifecycle.js';
import { loadConfig } from '../config.js';
import { resolveStorage } from '../storage/index.js';
import type { MemoryTier } from '../types.js';

const MAX_MEMORY_LIMIT = 1000;
const MAX_MEMORY_VERSION = 1000;
const MEMORY_TIERS = ['L1', 'L2', 'L3'] as const;
const MEMORY_FRESHNESS_STATES = ['active', 'stale', 'needs_confirmation'] as const;

/** Parse memory --freshness with the same state names returned by JSON output. */
export function parseMemoryFreshness(value: string | undefined): MemoryFreshnessState | undefined {
  if (value === undefined) return undefined;

  const freshness = value.trim().toLowerCase();
  if ((MEMORY_FRESHNESS_STATES as readonly string[]).includes(freshness)) {
    return freshness as MemoryFreshnessState;
  }

  throw new Error(
    `Invalid --freshness value "${value}". Expected one of active, stale, or needs_confirmation.`,
  );
}

/** Parse a memory tier with a clear CLI error instead of a downstream lookup failure. */
export function parseMemoryTier(value: string | undefined): MemoryTier | undefined {
  if (value === undefined) return undefined;

  const tier = value.trim().toUpperCase();
  if (!MEMORY_TIERS.includes(tier as (typeof MEMORY_TIERS)[number])) {
    throw new Error(`Invalid memory tier "${value}". Expected one of L1, L2, or L3.`);
  }
  return tier as MemoryTier;
}

const MEMORY_PROMOTE_TIERS = ['L1', 'L2'] as const;
type MemoryPromoteTier = (typeof MEMORY_PROMOTE_TIERS)[number];
const MEMORY_PROMOTE_TIER_LIST = MEMORY_PROMOTE_TIERS.join(', ');

/** Parse promote --to so archival L3 cannot be passed as a promotion target. */
export function parseMemoryPromoteTo(value: string | undefined): MemoryPromoteTier {
  if (value === undefined) {
    throw new Error(
      `Invalid --to value. Expected one of: ${MEMORY_PROMOTE_TIER_LIST}.`,
    );
  }

  const tier = value.trim().toUpperCase();
  if ((MEMORY_PROMOTE_TIERS as readonly string[]).includes(tier)) {
    return tier as MemoryPromoteTier;
  }

  throw new Error(
    `Invalid --to value "${value}". Expected one of: ${MEMORY_PROMOTE_TIER_LIST}.`,
  );
}

const MEMORY_DEMOTE_TIERS = ['L2', 'L3'] as const;
type MemoryDemoteTier = (typeof MEMORY_DEMOTE_TIERS)[number];
const MEMORY_DEMOTE_TIER_LIST = MEMORY_DEMOTE_TIERS.join(', ');

/** Parse demote --to so hot L1 cannot be passed as a demotion target. */
export function parseMemoryDemoteTo(value: string | undefined): MemoryDemoteTier {
  if (value === undefined) {
    throw new Error(
      `Invalid --to value. Expected one of: ${MEMORY_DEMOTE_TIER_LIST}.`,
    );
  }

  const tier = value.trim().toUpperCase();
  if ((MEMORY_DEMOTE_TIERS as readonly string[]).includes(tier)) {
    return tier as MemoryDemoteTier;
  }

  throw new Error(
    `Invalid --to value "${value}". Expected one of: ${MEMORY_DEMOTE_TIER_LIST}.`,
  );
}

/** Parse a memory command limit without silently turning bad input into NaN. */
export function parseMemoryLimit(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_MEMORY_LIMIT}.`,
    );
  }

  const limit = Number(normalized);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MEMORY_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_MEMORY_LIMIT}.`,
    );
  }
  return limit;
}

/** Parse a memory rollback version without silently turning bad input into NaN. */
export function parseMemoryVersion(value: string | undefined): number {
  const normalized = value?.trim();
  if (normalized === undefined || !/^\d+$/.test(normalized)) {
    throw new Error(
      `Invalid --version value "${value}". Expected a positive integer up to ${MAX_MEMORY_VERSION}.`,
    );
  }

  const version = Number(normalized);
  if (!Number.isInteger(version) || version < 1 || version > MAX_MEMORY_VERSION) {
    throw new Error(
      `Invalid --version value "${value}". Expected a positive integer up to ${MAX_MEMORY_VERSION}.`,
    );
  }
  return version;
}

/** Parse a memory importance score without silently turning bad input into NaN. */
export function parseMemoryImportance(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  if (!/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(normalized)) {
    throw new Error(
      `Invalid --importance value "${value}". Expected a number between 0 and 1.`,
    );
  }

  const importance = Number(normalized);
  if (!Number.isFinite(importance) || importance < 0 || importance > 1) {
    throw new Error(
      `Invalid --importance value "${value}". Expected a number between 0 and 1.`,
    );
  }
  return importance;
}

/** Parse memory list --min-importance without silently accepting malformed scores. */
export function parseMemoryMinImportance(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  if (!/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(normalized)) {
    throw new Error(
      `Invalid --min-importance value "${value}". Expected a number between 0 and 1.`,
    );
  }

  const importance = Number(normalized);
  if (!Number.isFinite(importance) || importance < 0 || importance > 1) {
    throw new Error(
      `Invalid --min-importance value "${value}". Expected a number between 0 and 1.`,
    );
  }
  return importance;
}

/** Parse memory list --max-importance without silently accepting malformed scores. */
export function parseMemoryMaxImportance(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  if (!/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(normalized)) {
    throw new Error(
      `Invalid --max-importance value "${value}". Expected a number between 0 and 1.`,
    );
  }

  const importance = Number(normalized);
  if (!Number.isFinite(importance) || importance < 0 || importance > 1) {
    throw new Error(
      `Invalid --max-importance value "${value}". Expected a number between 0 and 1.`,
    );
  }
  return importance;
}

/** Reject an inverted importance range before loading encrypted storage. */
export function validateMemoryImportanceRange(
  minImportance: number | undefined,
  maxImportance: number | undefined,
): void {
  if (minImportance === undefined || maxImportance === undefined) return;
  if (minImportance > maxImportance) {
    throw new Error(
      `Invalid memory importance range: --min-importance (${minImportance}) must be at or below --max-importance (${maxImportance}).`,
    );
  }
}

/** Parse memory --snapshot without treating blank ids as the latest snapshot. */
export function parseMemorySnapshot(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const snapshot = value.trim();
  if (snapshot.length === 0 || snapshot.includes(',') || /\s/.test(snapshot)) {
    throw new Error(
      `Invalid --snapshot value "${value}". Expected a single non-empty snapshot id.`,
    );
  }

  return snapshot;
}

/** Parse memory --tags without treating blank or empty comma-separated tags as filters. */
export function parseMemoryTags(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const token of value.split(',').map((part) => part.trim())) {
    const normalized = token.toLocaleLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      tags.push(token);
    }
  }
  if (tags.length === 0 || tags.some((token) => token.length === 0)) {
    throw new Error(
      `Invalid --tags value "${value}". Expected one or more non-empty memory tags (comma-separated).`,
    );
  }

  return tags;
}

/** Parse memory --source without treating blank or comma-separated values as filters. */
export function parseMemorySource(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const source = value.trim();
  if (source.length === 0 || source.includes(',') || /\s/.test(source)) {
    throw new Error(
      `Invalid --source value "${value}". Expected a single non-empty source id.`,
    );
  }

  return source;
}

/** Parse memory --until as an ISO-8601 creation cutoff. */
export function parseMemoryListUntil(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const until = value.trim();
  if (!isIsoMemoryDateOrTimestamp(until)) {
    throw new Error(
      `Invalid --until value "${value}". Expected an ISO-8601 date or timestamp.`,
    );
  }

  return until;
}

/** Parse memory --since as an ISO-8601 creation cutoff. */
export function parseMemoryListSince(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const since = value.trim();
  if (!isIsoMemoryDateOrTimestamp(since)) {
    throw new Error(
      `Invalid --since value "${value}". Expected an ISO-8601 date or timestamp.`,
    );
  }

  return since;
}

/** Keep date filters portable across runtimes by accepting only ISO-8601 forms. */
function isIsoMemoryDateOrTimestamp(value: string): boolean {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  if (!dateOnly && !timestamp) {
    return false;
  }

  // Date.parse normalizes impossible calendar dates such as February 30.
  // Validate the calendar portion before relying on it for filtering.
  return isValidIsoCalendarDate(value.slice(0, 10)) && !Number.isNaN(Date.parse(value));
}

function isValidIsoCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;

  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30,
    31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Reject an impossible memory creation range before loading encrypted storage. */
export function validateMemoryListDateRange(
  since: string | undefined,
  until: string | undefined,
): void {
  if (since === undefined || until === undefined) return;

  // Keep validation consistent with filtering: a date-only --until includes
  // the entire UTC calendar day, while a date-only --since starts at midnight.
  const sinceBoundary = Date.parse(
    /^\d{4}-\d{2}-\d{2}$/.test(since)
      ? `${since}T00:00:00.000Z`
      : since,
  );
  const untilBoundary = Date.parse(
    /^\d{4}-\d{2}-\d{2}$/.test(until)
      ? `${until}T23:59:59.999Z`
      : until,
  );

  if (sinceBoundary > untilBoundary) {
    throw new Error(
      `Invalid memory date range: --since (${since}) must be on or before --until (${until}).`,
    );
  }
}

/** Parse memory --actor without treating blank or comma-separated ids as an audit actor. */
export function parseMemoryActor(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const actor = value.trim();
  if (actor.length === 0 || actor.includes(',') || /\s/.test(actor)) {
    throw new Error(
      `Invalid --actor value "${value}". Expected a single non-empty actor id.`,
    );
  }

  return actor;
}

/** Parse memory --namespace without treating blank or comma-separated values as a namespace. */
export function parseMemoryNamespace(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const namespace = value.trim();
  const parts = namespace.split(':');
  if (
    namespace.length === 0 ||
    namespace.includes(',') ||
    /\s/.test(namespace) ||
    (parts.length !== 3 && parts.length !== 4) ||
    parts.some((part) => part.length === 0)
  ) {
    throw new Error(
      `Invalid --namespace value "${value}". Expected a single non-empty namespace (org:app:agent[:user]).`,
    );
  }

  return namespace;
}

/** Resolve the mutually exclusive memory list pin filters. */
export function parseMemoryPinnedFilter(
  pinned: boolean | undefined,
  unpinned: boolean | undefined,
): boolean | undefined {
  if (pinned && unpinned) {
    throw new Error('The --pinned and --unpinned options cannot be used together.');
  }
  if (pinned) return true;
  if (unpinned) return false;
  return undefined;
}

/** Parse memory --reason without writing a blank audit reason. */
export function parseMemoryReason(value: string | undefined): string {
  if (value === undefined) {
    throw new Error(
      'Invalid --reason value. Expected a non-empty reason.',
    );
  }

  const reason = value.trim();
  if (reason.length === 0) {
    throw new Error(
      `Invalid --reason value "${value}". Expected a non-empty reason.`,
    );
  }

  return reason;
}

/** Parse memory --content without writing blank memory text. */
export function parseMemoryContent(value: string | undefined): string {
  if (value === undefined) {
    throw new Error(
      'Invalid --content value. Expected non-empty memory content.',
    );
  }

  const content = value.trim();
  if (content.length === 0) {
    throw new Error(
      `Invalid --content value "${value}". Expected non-empty memory content.`,
    );
  }

  return content;
}

/** Parse memory-id without decrypting archives for blank or comma-separated ids. */
export function parseMemoryId(value: string | undefined): string {
  if (value === undefined) {
    throw new Error(
      'Invalid memory id. Expected a single non-empty memory id.',
    );
  }

  const id = value.trim();
  if (id.length === 0 || id.includes(',') || /\s/.test(id)) {
    throw new Error(
      `Invalid memory id "${value}". Expected a single non-empty memory id.`,
    );
  }

  return id;
}

/** Parse memory explain query without decrypting archives for blank input. */
export function parseMemoryQuery(value: string | undefined): string {
  if (value === undefined) {
    throw new Error(
      'Invalid memory query. Expected a non-empty query.',
    );
  }

  const query = value.trim();
  if (query.length === 0) {
    throw new Error(
      `Invalid memory query "${value}". Expected a non-empty query.`,
    );
  }

  return query;
}

/** Parse the optional memory list content filter without rejecting its omission. */
export function parseMemoryContentFilter(value: string | undefined): string | undefined {
  return value === undefined ? undefined : parseMemoryContent(value);
}

/**
 * Register memory-related commands on the CLI program.
 */
export function registerMemoryCommands(program: Command): void {
  const memory = program
    .command('memory')
    .description('Manage multi-tier memory (L1/L2/L3) for long-running agents')
    .addHelpText(
      'after',
      '\nExamples:\n' +
        '  $ savestate memory list --tier L1\n' +
        '  $ savestate memory explain "preferred editor" --json\n' +
        '  $ savestate memory log <memory-id>\n',
    );

  // ─── savestate memory list ───────────────────────────────────

  memory
    .command('list')
    .alias('ls')
    .description('List memories with tier information')
    .option('-t, --tier <tier>', 'Filter by tier (L1, L2, L3)')
    .option('-p, --pinned', 'Show only pinned memories')
    .option('--unpinned', 'Show only unpinned memories')
    .option('--source <id>', 'Filter by source id')
    .option('--until <date>', 'Show memories created on or before an ISO-8601 date or timestamp (date-only values include the full UTC day)')
    .option('-n, --namespace <ns>', 'Filter by namespace (org:app:agent[:user])')
    .option('--content <text>', 'Filter by case-insensitive content substring')
    .option('--tags <tags>', 'Filter by tags (comma-separated; all must match)')
    .option('--since <date>', 'Show memories created on or after an ISO-8601 date or timestamp (date-only values start at 00:00 UTC)')
    .option('--freshness <state>', 'Filter by freshness (active, stale, needs_confirmation)')
    .option('--min-importance <n>', 'Show memories with importance at least this score (0-1)')
    .option('--max-importance <n>', 'Show memories with importance at most this score (0-1)')
    .option('--oldest-first', 'Show oldest memories first (default: newest first)')
    .option('--reverse', 'Alias for --oldest-first')
    .option('-l, --limit <n>', 'Maximum number of entries to show', '20')
    .option('--offset <n>', 'Skip the first N memories (non-negative integer up to 1000)')
    .option('-s, --snapshot <id>', 'Snapshot to inspect (default: latest)')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const until = parseMemoryListUntil(options.until);
        const since = parseMemoryListSince(options.since);
        validateMemoryListDateRange(since, until);
        const minImportance = parseMemoryMinImportance(options.minImportance);
        const maxImportance = parseMemoryMaxImportance(options.maxImportance);
        validateMemoryImportanceRange(minImportance, maxImportance);
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await listMemories(storage, passphrase, {
          tier: parseMemoryTier(options.tier),
          pinned: parseMemoryPinnedFilter(options.pinned, options.unpinned),
          source: parseMemorySource(options.source),
          until,
          namespace: parseMemoryNamespace(options.namespace),
          content: parseMemoryContentFilter(options.content),
          tags: parseMemoryTags(options.tags),
          since,
          freshness: parseMemoryFreshness(options.freshness),
          minImportance,
          maxImportance,
          oldestFirst: options.oldestFirst || options.reverse,
          limit: parseMemoryLimit(options.limit, 20),
          offset: parseMemoryListOffset(options.offset),
          snapshotId: parseMemorySnapshot(options.snapshot),
          format: options.json ? 'json' : 'table',
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory promote ────────────────────────────────

  memory
    .command('promote <memory-id>')
    .description('Promote a memory to a higher tier (faster access; single non-empty memory id)')
    .option('-t, --to <tier>', 'Target tier (L1 or L2)', 'L1')
    .option('-s, --snapshot <id>', 'Snapshot to modify (default: latest)')
    .option('--limit <n>', 'Maximum number of status field rows to show')
    .option('--offset <n>', 'Skip the first N status field rows (non-negative integer up to 1000)')
    .option('--json', 'Output as JSON')
    .action(async (memoryId, options) => {
      try {
        const id = parseMemoryId(memoryId);
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await promoteMemoryCommand(storage, passphrase, id, {
          to: parseMemoryPromoteTo(options.to),
          snapshotId: parseMemorySnapshot(options.snapshot),
          format: options.json ? 'json' : 'pretty',
          limit: options.limit,
          offset: options.offset,
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory demote ─────────────────────────────────

  memory
    .command('demote <memory-id>')
    .description('Demote a memory to a lower tier (archival; single non-empty memory id)')
    .option('-t, --to <tier>', 'Target tier (L2 or L3)', 'L3')
    .option('-s, --snapshot <id>', 'Snapshot to modify (default: latest)')
    .option('--limit <n>', 'Maximum number of status field rows to show')
    .option('--offset <n>', 'Skip the first N status field rows (non-negative integer up to 1000)')
    .option('--json', 'Output as JSON')
    .action(async (memoryId, options) => {
      try {
        const id = parseMemoryId(memoryId);
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await demoteMemoryCommand(storage, passphrase, id, {
          to: parseMemoryDemoteTo(options.to),
          snapshotId: parseMemorySnapshot(options.snapshot),
          format: options.json ? 'json' : 'pretty',
          limit: options.limit,
          offset: options.offset,
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory pin ────────────────────────────────────

  memory
    .command('pin <memory-id>')
    .description('Pin a memory (prevents automatic demotion; single non-empty memory id)')
    .option('-s, --snapshot <id>', 'Snapshot to modify (default: latest)')
    .option('--limit <n>', 'Maximum number of status field rows to show')
    .option('--offset <n>', 'Skip the first N status field rows (non-negative integer up to 1000)')
    .option('--json', 'Output as JSON')
    .action(async (memoryId, options) => {
      try {
        const id = parseMemoryId(memoryId);
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await pinMemoryCommand(storage, passphrase, id, {
          snapshotId: parseMemorySnapshot(options.snapshot),
          format: options.json ? 'json' : 'pretty',
          limit: options.limit,
          offset: options.offset,
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory unpin ──────────────────────────────────

  memory
    .command('unpin <memory-id>')
    .description('Unpin a memory (allows automatic demotion; single non-empty memory id)')
    .option('-s, --snapshot <id>', 'Snapshot to modify (default: latest)')
    .option('--limit <n>', 'Maximum number of status field rows to show')
    .option('--offset <n>', 'Skip the first N status field rows (non-negative integer up to 1000)')
    .option('--json', 'Output as JSON')
    .action(async (memoryId, options) => {
      try {
        const id = parseMemoryId(memoryId);
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await unpinMemoryCommand(storage, passphrase, id, {
          snapshotId: parseMemorySnapshot(options.snapshot),
          format: options.json ? 'json' : 'pretty',
          limit: options.limit,
          offset: options.offset,
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory apply-policies ─────────────────────────

  memory
    .command('apply-policies')
    .description('Apply automatic tier policies (age-based demotion, etc.)')
    .option('-s, --snapshot <id>', 'Snapshot to modify (default: latest)')
    .option('--dry-run', 'Show what would change without applying')
    .option('--limit <n>', 'Maximum number of tier changes to show')
    .option('--offset <n>', 'Skip the first N tier changes (non-negative integer up to 1000)')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await applyPoliciesCommand(storage, passphrase, {
          snapshotId: parseMemorySnapshot(options.snapshot),
          dryRun: options.dryRun,
          format: options.json ? 'json' : 'pretty',
          limit: options.limit,
          offset: options.offset,
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory config ─────────────────────────────────

  memory
    .command('config')
    .description('Show tier configuration')
    .option('-s, --snapshot <id>', 'Snapshot to inspect (default: latest)')
    .option('--limit <n>', 'Maximum number of configuration setting rows to show')
    .option('--offset <n>', 'Skip the first N configuration setting rows (non-negative integer up to 1000)')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await showTierConfig(storage, passphrase, {
          snapshotId: parseMemorySnapshot(options.snapshot),
          format: options.json ? 'json' : 'pretty',
          limit: parseMemoryConfigLimit(options.limit),
          offset: parseMemoryConfigOffset(options.offset),
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory explain ───────────────────────────────

  memory
    .command('explain <query>')
    .description('Explain why memories were retrieved for a query (non-empty query)')
    .option('-t, --tier <tier>', 'Filter by tier (L1, L2, L3)')
    .option('-n, --namespace <ns>', 'Namespace to search (single non-empty org:app:agent[:user])')
    .option('--source <id>', 'Source id to search (matching is case-insensitive)')
    .option('--content <text>', 'Filter by case-insensitive content substring')
    .option('-p, --pinned', 'Filter to pinned memories')
    .option('--unpinned', 'Filter to unpinned memories')
    .option('--until <date>', 'Search memories created on or before an ISO-8601 date or timestamp (date-only values include the full UTC day)')
    .option('--since <date>', 'Search memories created on or after an ISO-8601 date or timestamp (date-only values start at 00:00 UTC)')
    .option('-l, --limit <n>', 'Maximum number of retrieval results to show')
    .option('--offset <n>', 'Skip the first N retrieval results (non-negative integer up to 1000)')
    .option('--tags <tags>', 'Filter by tags (comma-separated non-empty tags)')
    .option('--freshness <state>', 'Filter by freshness (active, stale, needs_confirmation)')
    .option('--min-importance <n>', 'Show memories with importance at least this score (0-1)')
    .option('--max-importance <n>', 'Show memories with importance at most this score (0-1)')
    .option('--json', 'Output as JSON')
    .action(async (query, options) => {
      try {
        const parsedQuery = parseMemoryQuery(query);
        const until = parseMemoryListUntil(options.until);
        const since = parseMemoryListSince(options.since);
        validateMemoryListDateRange(since, until);
        const minImportance = parseMemoryMinImportance(options.minImportance);
        const maxImportance = parseMemoryMaxImportance(options.maxImportance);
        validateMemoryImportanceRange(minImportance, maxImportance);
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await explainMemoryCommand(storage, passphrase, parsedQuery, {
          tier: parseMemoryTier(options.tier),
          namespace: parseMemoryNamespace(options.namespace),
          source: parseMemorySource(options.source),
          content: parseMemoryContentFilter(options.content),
          pinned: parseMemoryPinnedFilter(options.pinned, options.unpinned),
          until,
          since,
          limit: options.limit,
          offset: options.offset,
          tags: parseMemoryTags(options.tags),
          freshness: parseMemoryFreshness(options.freshness),
          minImportance,
          maxImportance,
          format: options.json ? 'json' : 'pretty',
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── Lifecycle Controls (Issue #110) ───────────────────────

  // ─── savestate memory edit ──────────────────────────────────

  memory
    .command('edit <memory-id>')
    .description('Edit a memory\'s content or metadata (single non-empty memory id)')
    .option('-c, --content <content>', 'New content for the memory (non-empty)')
    .option('-t, --tags <tags>', 'New tags (comma-separated non-empty tags)')
    .option('-i, --importance <n>', 'New importance score (0-1, inclusive)')
    .option('--actor <id>', 'Actor ID for audit trail (single non-empty id)', 'cli-user')
    .option('-r, --reason <reason>', 'Reason for the edit (non-empty)')
    .option('--limit <n>', 'Maximum number of status field rows to show')
    .option('--offset <n>', 'Skip the first N status field rows (non-negative integer up to 1000)')
    .option('--json', 'Output as JSON')
    .action(async (memoryId, options) => {
      try {
        const id = parseMemoryId(memoryId);
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await editMemoryCommand(storage, passphrase, id, {
          content: options.content === undefined ? undefined : parseMemoryContent(options.content),
          tags: parseMemoryTags(options.tags),
          importance: parseMemoryImportance(options.importance),
          actorId: parseMemoryActor(options.actor) ?? 'cli-user',
          reason: options.reason === undefined ? undefined : parseMemoryReason(options.reason),
          format: options.json ? 'json' : 'pretty',
          limit: options.limit,
          offset: options.offset,
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory delete ────────────────────────────────

  memory
    .command('delete <memory-id>')
    .alias('rm')
    .description('Delete a memory (soft delete with audit trail; single non-empty memory id)')
    .option('--actor <id>', 'Actor ID for audit trail (single non-empty id)', 'cli-user')
    .requiredOption('-r, --reason <reason>', 'Reason for deletion (non-empty)')
    .option('--limit <n>', 'Maximum number of status field rows to show')
    .option('--offset <n>', 'Skip the first N status field rows (non-negative integer up to 1000)')
    .option('--json', 'Output as JSON')
    .action(async (memoryId, options) => {
      try {
        const id = parseMemoryId(memoryId);
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await deleteMemoryCommand(storage, passphrase, id, {
          actorId: parseMemoryActor(options.actor) ?? 'cli-user',
          reason: parseMemoryReason(options.reason),
          format: options.json ? 'json' : 'pretty',
          limit: options.limit,
          offset: options.offset,
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory rollback ──────────────────────────────

  memory
    .command('rollback <memory-id>')
    .description('Rollback a memory to a previous version (single non-empty memory id)')
    .requiredOption('-v, --version <n>', 'Version number to rollback to')
    .option('--actor <id>', 'Actor ID for audit trail (single non-empty id)', 'cli-user')
    .option('--limit <n>', 'Maximum number of status field rows to show')
    .option('--offset <n>', 'Skip the first N status field rows (non-negative integer up to 1000)')
    .option('--json', 'Output as JSON')
    .action(async (memoryId, options) => {
      try {
        const id = parseMemoryId(memoryId);
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await rollbackMemoryCommand(storage, passphrase, id, {
          version: parseMemoryVersion(options.version),
          actorId: parseMemoryActor(options.actor) ?? 'cli-user',
          format: options.json ? 'json' : 'pretty',
          limit: options.limit,
          offset: options.offset,
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory expire ────────────────────────────────

  memory
    .command('expire')
    .description('Expire memories based on TTL policy')
    .requiredOption('-n, --namespace <ns>', 'Namespace (single non-empty org:app:agent[:user])')
    .option('--dry-run', 'Show what would be expired without applying')
    .option('--limit <n>', 'Maximum number of expirable memories to show')
    .option('--offset <n>', 'Skip the first N expirable memories (non-negative integer up to 1000)')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await expireMemoriesCommand(storage, passphrase, {
          namespace: parseMemoryNamespace(options.namespace) ?? options.namespace,
          dryRun: options.dryRun,
          format: options.json ? 'json' : 'pretty',
          limit: options.limit,
          offset: options.offset,
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory log ───────────────────────────────────

  memory
    .command('log <memory-id>')
    .alias('history')
    .description('Show audit history for a memory (single non-empty memory id)')
    .option('--limit <n>', 'Maximum number of audit events to show')
    .option('--offset <n>', 'Skip the first N audit events (non-negative integer up to 1000)')
    .option('--json', 'Output as JSON')
    .action(async (memoryId, options) => {
      try {
        const id = parseMemoryId(memoryId);
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await memoryLogCommand(storage, passphrase, id, {
          format: options.json ? 'json' : 'table',
          limit: options.limit,
          offset: options.offset,
        });
      } catch (err) {
        handleError(err);
      }
    });
}

// ─── Helpers ─────────────────────────────────────────────────

import { createInterface } from 'node:readline';

async function promptPassphrase(): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    // Check for env var first
    const envPass = process.env.SAVESTATE_PASSPHRASE;
    if (envPass) {
      rl.close();
      resolve(envPass);
      return;
    }

    rl.question('Passphrase: ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function handleError(err: unknown): void {
  if (err instanceof Error) {
    console.error(`Error: ${err.message}`);
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
  } else {
    console.error('An unexpected error occurred');
  }
  process.exit(1);
}
