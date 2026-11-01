/**
 * SaveState Memory Commands
 *
 * Manage multi-tier memory (L1/L2/L3) for long-running agents.
 *
 * Tiers:
 * - L1: Short-term buffer (current session, fastest access, included in context)
 * - L2: Working set (recent + pinned, fast retrieval, included in context)
 * - L3: Long-term archive (full history, searchable, not in default context)
 */

import { createInterface } from 'node:readline';
import type {
  Memory,
  MemoryEntry,
  MemoryFreshnessClass,
  MemoryStaleBehavior,
  MemoryTier,
  MemoryTierConfig,
  MemoryTierPolicy,
  StorageBackend,
} from '../types.js';
import { findEntry, getLatestEntry, updateEntry } from '../index-file.js';
import { decrypt, encrypt } from '../encryption.js';
import { unpackFromArchive, unpackSnapshot, packSnapshot, packToArchive, snapshotFilename } from '../format.js';
import { isIncremental, reconstructFromChain } from '../incremental.js';
import { normalizeMemorySource } from '../memory/source.js';

/** Default tier configuration for new setups */
export const DEFAULT_TIER_CONFIG: MemoryTierConfig = {
  version: '1.0.0',
  defaultTier: 'L2',
  tiers: {
    L1: {
      maxItems: 50,
      maxAge: '24h',
      includeInContext: true,
    },
    L2: {
      maxItems: 500,
      maxAge: '30d',
      includeInContext: true,
    },
    L3: {
      maxItems: null,
      maxAge: null,
      includeInContext: false,
    },
  },
  policies: [
    {
      name: 'auto-demote-l1',
      trigger: 'age',
      from: 'L1',
      to: 'L2',
      threshold: '24h',
    },
    {
      name: 'auto-demote-l2',
      trigger: 'age',
      from: 'L2',
      to: 'L3',
      threshold: '30d',
    },
  ],
};

const DAY_SECONDS = 24 * 60 * 60;

export interface MemoryFreshnessProfile {
  freshnessClass: MemoryFreshnessClass;
  softTtlSeconds: number | null;
  hardTtlSeconds: number | null;
  staleBehavior: MemoryStaleBehavior;
}

/** Starter profiles from the freshness-aware knowledge slots design. */
export const DEFAULT_MEMORY_FRESHNESS_PROFILES: Record<MemoryFreshnessClass, MemoryFreshnessProfile> = {
  static: {
    freshnessClass: 'static',
    softTtlSeconds: null,
    hardTtlSeconds: null,
    staleBehavior: 'warn',
  },
  slow: {
    freshnessClass: 'slow',
    softTtlSeconds: 30 * DAY_SECONDS,
    hardTtlSeconds: 180 * DAY_SECONDS,
    staleBehavior: 'warn',
  },
  medium: {
    freshnessClass: 'medium',
    softTtlSeconds: 7 * DAY_SECONDS,
    hardTtlSeconds: 30 * DAY_SECONDS,
    staleBehavior: 'warn',
  },
  fast: {
    freshnessClass: 'fast',
    softTtlSeconds: 6 * 60 * 60,
    hardTtlSeconds: DAY_SECONDS,
    staleBehavior: 'hide',
  },
};

export type MemoryFreshnessState = 'active' | 'stale' | 'needs_confirmation';

export interface MemoryFreshness {
  class: MemoryFreshnessClass;
  state: MemoryFreshnessState;
  softTtlSeconds: number | null;
  hardTtlSeconds: number | null;
  staleBehavior: MemoryStaleBehavior;
  lastVerifiedAt: string;
  verificationSource?: string;
}

/** Ignore malformed archive TTL overrides instead of letting them disable freshness checks. */
function resolveFreshnessTtl(
  override: number | null | undefined,
  fallback: number | null,
): number | null {
  if (override === null) return null;
  return override !== undefined && Number.isFinite(override) && override >= 0
    ? override
    : fallback;
}

/** Ignore unknown archive stale behaviors instead of returning invalid policy data. */
function resolveStaleBehavior(
  override: MemoryStaleBehavior | undefined,
  fallback: MemoryStaleBehavior,
): MemoryStaleBehavior {
  return override === 'warn' || override === 'hide' || override === 'block'
    ? override
    : fallback;
}

/** Resolve freshness from explicit entry metadata while keeping old snapshots usable. */
export function getMemoryFreshness(
  entry: MemoryEntry,
  now = new Date(),
): MemoryFreshness {
  const requestedClass = entry.freshnessClass;
  // Archive metadata is untrusted input; only accept own profile names so
  // prototype properties such as "toString" cannot produce undefined TTLs.
  const freshnessClass = requestedClass && Object.hasOwn(DEFAULT_MEMORY_FRESHNESS_PROFILES, requestedClass)
    ? requestedClass
    : 'slow';
  const defaults = DEFAULT_MEMORY_FRESHNESS_PROFILES[freshnessClass];
  const softTtlSeconds = resolveFreshnessTtl(entry.softTtlSeconds, defaults.softTtlSeconds);
  const hardTtlSeconds = resolveFreshnessTtl(entry.hardTtlSeconds, defaults.hardTtlSeconds);
  const lastVerifiedAt = entry.lastVerifiedAt ?? entry.updatedAt ?? entry.createdAt;
  const verifiedAt = new Date(lastVerifiedAt).getTime();
  const ageSeconds = Number.isFinite(verifiedAt)
    ? Math.max(0, (now.getTime() - verifiedAt) / 1000)
    : Number.POSITIVE_INFINITY;

  const state: MemoryFreshnessState = !Number.isFinite(verifiedAt)
    ? 'needs_confirmation'
    : hardTtlSeconds !== null && ageSeconds >= hardTtlSeconds
      ? 'needs_confirmation'
      : softTtlSeconds !== null && ageSeconds >= softTtlSeconds
        ? 'stale'
        : 'active';

  return {
    class: freshnessClass,
    state,
    softTtlSeconds,
    hardTtlSeconds,
    staleBehavior: resolveStaleBehavior(entry.staleBehavior, defaults.staleBehavior),
    lastVerifiedAt,
    ...(entry.verificationSource ? { verificationSource: entry.verificationSource } : {}),
  };
}

/**
 * Get the effective tier of a memory entry (defaults to L3 for backward compatibility).
 */
export function getEffectiveTier(entry: MemoryEntry): MemoryTier {
  return entry.tier ?? 'L3';
}

/**
 * Normalize a memory entry to ensure it has tier metadata.
 * For backward compatibility, entries without tier default to L3.
 */
export function normalizeMemoryEntry(entry: MemoryEntry): MemoryEntry {
  if (entry.tier) return entry;
  return {
    ...entry,
    tier: 'L3',
    demotedAt: undefined,
    promotedAt: undefined,
    previousTier: undefined,
  };
}

/**
 * Normalize all memory entries in a Memory object.
 */
export function normalizeMemory(memory: Memory): Memory {
  return {
    ...memory,
    core: memory.core.map(normalizeMemoryEntry),
    tierConfig: memory.tierConfig ?? DEFAULT_TIER_CONFIG,
  };
}

/**
 * Filter memories by tier.
 */
export function filterByTier(memories: MemoryEntry[], tier: MemoryTier): MemoryEntry[] {
  return memories.filter((m) => getEffectiveTier(m) === tier);
}

/**
 * Get memories that should be included in agent context (L1 + L2 by default).
 */
export function getContextMemories(
  memories: MemoryEntry[],
  config?: MemoryTierConfig,
): MemoryEntry[] {
  const tierConfig = config ?? DEFAULT_TIER_CONFIG;
  return memories.filter((m) => {
    const tier = getEffectiveTier(m);
    return tierConfig.tiers[tier].includeInContext;
  });
}

/**
 * Count memories by tier.
 */
export function countByTier(memories: MemoryEntry[]): Record<MemoryTier, number> {
  const counts: Record<MemoryTier, number> = { L1: 0, L2: 0, L3: 0 };
  for (const m of memories) {
    counts[getEffectiveTier(m)]++;
  }
  return counts;
}

/** Count memories by freshness state for JSON consumers. */
export function countByFreshness(
  memories: MemoryEntry[],
  now = new Date(),
): Record<MemoryFreshnessState, number> {
  const counts: Record<MemoryFreshnessState, number> = {
    active: 0,
    stale: 0,
    needs_confirmation: 0,
  };
  for (const memory of memories) {
    counts[getMemoryFreshness(memory, now).state]++;
  }
  return counts;
}

/** Summarize the collection currently being listed, including active filters. */
export function getMemoryListSummary(memories: MemoryEntry[]): {
  counts: Record<MemoryTier, number>;
  total: number;
} {
  return {
    counts: countByTier(memories),
    total: memories.length,
  };
}

/** Format freshness totals for the human-facing list summary. */
export function formatMemoryListFreshnessSummary(
  memories: MemoryEntry[],
  now = new Date(),
): string {
  const counts = countByFreshness(memories, now);
  return `${counts.active} active, ${counts.stale} stale, ${counts.needs_confirmation} confirmation needed`;
}

/** Format freshness totals for the rows visible on a paginated table page. */
export function formatMemoryListPageFreshnessSummary(
  memories: MemoryEntry[],
  now = new Date(),
): string {
  return `Page Freshness: ${formatMemoryListFreshnessSummary(memories, now)}`;
}

export interface MemoryListEntryJson {
  id: string;
  tier: MemoryTier;
  pinned: boolean;
  importance: number;
  source: string;
  namespace: string | null;
  createdAt: string;
  updatedAt?: string;
  lastAccessedAt?: string;
  tags?: string[];
  content: string;
  freshness: MemoryFreshness;
}

export interface MemoryListJson {
  found: true;
  snapshot: string;
  empty: boolean;
  emptyReason: 'collection' | 'page' | null;
  total: number;
  shown: number;
  /** Number of matching entries after this page. */
  remaining: number;
  offset: number;
  limit: number | null;
  pageSize: number;
  hasPrevious: boolean;
  previousOffset: number | null;
  hasMore: boolean;
  nextOffset: number | null;
  /** Nearest page containing entries when a stale offset returns an empty page. */
  suggestedOffset: number | null;
  filters: {
    tier: MemoryTier | null;
    freshness: MemoryFreshnessState | null;
    pinned: boolean | null;
    source: string | null;
    namespace: string | null;
    content: string | null;
    tags: string[] | null;
    until: string | null;
    since: string | null;
    oldestFirst: boolean;
    minImportance?: number;
    maxImportance?: number;
  };
  byTier: Record<MemoryTier, number>;
  shownByTier: Record<MemoryTier, number>;
  byFreshness: Record<MemoryFreshnessState, number>;
  shownByFreshness: Record<MemoryFreshnessState, number>;
  pinned: number;
  shownPinned: number;
  entries: MemoryListEntryJson[];
}

export function formatMemoryListJson(
  all: MemoryEntry[],
  shown: MemoryEntry[],
  pagination: {
    snapshot?: string;
    offset?: number;
    limit?: number;
    hasMore?: boolean;
    filters?: Partial<MemoryListJson['filters']>;
    now?: Date;
  } = {},
): string {
  const now = pagination.now ?? new Date();
  const offset = pagination.offset ?? 0;
  const hasPrevious = offset > 0;
  const pageSize = pagination.limit ?? Math.max(1, shown.length);
  const hasMore = pagination.hasMore ?? offset + shown.length < all.length;
  // Advance bounded pages by their requested size, even when a sparse page
  // contains fewer entries, so clients do not revisit entries on continuation.
  // Unbounded pages use the number returned as their natural step.
  const continuationStep = pagination.limit ?? Math.max(1, shown.length);
  const remaining = Math.max(0, all.length - offset - shown.length);
  const emptyPage = shown.length === 0 && all.length > 0;
  const suggestedOffset = emptyPage
    ? pagination.limit === undefined
      ? 0
      : Math.floor((all.length - 1) / pageSize) * pageSize
    : null;
  const previousOffset = hasPrevious
    ? emptyPage && pagination.limit !== undefined
      ? suggestedOffset
      : Math.max(0, offset - pageSize)
    : null;
  const record: MemoryListJson = {
    found: true,
    snapshot: pagination.snapshot ?? 'latest',
    empty: shown.length === 0,
    emptyReason: shown.length > 0 ? null : all.length === 0 ? 'collection' : 'page',
    total: all.length,
    shown: shown.length,
    remaining,
    offset,
    limit: pagination.limit ?? null,
    pageSize,
    hasPrevious,
    previousOffset,
    hasMore,
    nextOffset: hasMore ? offset + continuationStep : null,
    suggestedOffset,
    filters: {
      tier: pagination.filters?.tier ?? null,
      freshness: pagination.filters?.freshness ?? null,
      pinned: pagination.filters?.pinned ?? null,
      source: pagination.filters?.source === undefined
        ? null
        : normalizeMemoryListSource(pagination.filters.source),
      namespace: pagination.filters?.namespace ?? null,
      content: pagination.filters?.content ?? null,
      tags: pagination.filters?.tags ?? null,
      until: pagination.filters?.until ?? null,
      since: pagination.filters?.since ?? null,
      oldestFirst: pagination.filters?.oldestFirst ?? false,
      ...(pagination.filters?.minImportance !== undefined
        ? { minImportance: pagination.filters.minImportance }
        : {}),
      ...(pagination.filters?.maxImportance !== undefined
        ? { maxImportance: pagination.filters.maxImportance }
        : {}),
    },
    byTier: countByTier(all),
    shownByTier: countByTier(shown),
    byFreshness: countByFreshness(all, now),
    shownByFreshness: countByFreshness(shown, now),
    pinned: all.filter((entry) => !!entry.pinned).length,
    shownPinned: shown.filter((entry) => !!entry.pinned).length,
    entries: shown.map((entry) => ({
      id: entry.id,
      tier: getEffectiveTier(entry),
      pinned: !!entry.pinned,
      importance: getMemoryListImportance(entry),
      source: normalizeMemoryListSource(entry.source),
      namespace: (() => {
        const namespace = typeof entry.metadata?.namespace === 'string'
          ? entry.metadata.namespace.trim()
          : '';
        return namespace || null;
      })(),
      createdAt: entry.createdAt,
      ...(entry.updatedAt ? { updatedAt: entry.updatedAt } : {}),
      ...(entry.lastAccessedAt ? { lastAccessedAt: entry.lastAccessedAt } : {}),
      ...(() => {
        const tags = getMemoryListTags(entry);
        return tags.length > 0 ? { tags } : {};
      })(),
      content: entry.content,
      freshness: getMemoryFreshness(entry, now),
    })),
  };
  return JSON.stringify(record, null, 2);
}

export interface MemoryListMissingJson {
  found: false;
  snapshot: string;
  total: 0;
  shown: 0;
}

export function formatMemoryListMissingJson(snapshot: string): string {
  return JSON.stringify(
    {
      found: false,
      snapshot,
      total: 0,
      shown: 0,
    },
    null,
    2,
  );
}

/** Keep only memories assigned to a namespace in their metadata. */
export function filterMemoryListByNamespace(
  entries: MemoryEntry[],
  namespace?: string,
): MemoryEntry[] {
  if (namespace === undefined) return entries;
  const normalizedNamespace = namespace.trim();
  return entries.filter((entry) =>
    typeof entry.metadata?.namespace === 'string' &&
    entry.metadata.namespace.trim() === normalizedNamespace,
  );
}

/** Keep memories captured by the requested source id, ignoring letter case. */
export function filterMemoryListBySource(
  entries: MemoryEntry[],
  source?: string,
): MemoryEntry[] {
  if (source === undefined) return entries;
  const normalizedSource = normalizeMemoryListSource(source).toLocaleLowerCase();
  return entries.filter((entry) => normalizeMemoryListSource(entry.source).toLocaleLowerCase() === normalizedSource);
}

/** Keep legacy padding out of machine-readable and terminal memory output. */
export function normalizeMemoryListSource(source: string | undefined): string {
  return normalizeMemorySource(source);
}

/** Keep memories whose content includes the requested case-insensitive text. */
export function filterMemoryListByContent(
  entries: MemoryEntry[],
  content?: string,
): MemoryEntry[] {
  if (content === undefined) return entries;
  const query = content.toLocaleLowerCase();
  return entries.filter((entry) => entry.content.toLocaleLowerCase().includes(query));
}

/** Keep memories containing every requested metadata tag. */
export function filterMemoryListByTags(
  entries: MemoryEntry[],
  tags?: string[],
): MemoryEntry[] {
  if (tags === undefined) return entries;
  const normalizedTags = tags.map((tag) => tag.trim().toLocaleLowerCase());
  return entries.filter((entry) => {
    const entryTags = getMemoryListTags(entry).map((tag) => tag.toLocaleLowerCase());
    return normalizedTags.every((tag) => entryTags.includes(tag));
  });
}

/** Apply the shared scope filters used by memory explain retrieval. */
export function filterMemoryExplainEntries(
  entries: MemoryEntry[],
  options: {
    tier?: MemoryTier;
    namespace?: string;
    source?: string;
    content?: string;
    tags?: string[];
    freshness?: MemoryFreshnessState;
    pinned?: boolean;
    since?: string;
    until?: string;
    minImportance?: number;
    maxImportance?: number;
    minCriticality?: number;
    maxCriticality?: number;
    now?: Date;
  } = {},
): MemoryEntry[] {
  const scoped = filterMemoryListByFreshness(
    filterMemoryListByCreatedSince(
      filterMemoryListByCreatedUntil(
        filterMemoryListByTags(
          filterMemoryListBySource(
            filterMemoryListByContent(
              filterMemoryListByNamespace(entries, options.namespace),
              options.content,
            ),
            options.source,
          ),
          options.tags,
        ),
        options.until,
      ),
      options.since,
    ),
    options.freshness,
    options.now,
  );
  const tierScoped = options.tier === undefined
    ? scoped
    : filterByTier(scoped, options.tier);
  const importanceScoped = filterMemoryListByImportance(
    tierScoped,
    options.minImportance,
    options.maxImportance,
  );
  const criticalityScoped = filterMemoryExplainByCriticality(
    importanceScoped,
    options.minCriticality,
    options.maxCriticality,
  );
  return options.pinned === undefined
    ? criticalityScoped
    : criticalityScoped.filter((entry) => !!entry.pinned === options.pinned);
}

/** Normalize legacy tag metadata before filtering or serializing it. */
export function getMemoryListTags(entry: MemoryEntry): string[] {
  const tags = entry.metadata?.tags;
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  return tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter((tag) => {
      if (tag.length === 0) return false;
      const normalized = tag.toLocaleLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

/** Keep memories created on or before the requested timestamp. */
export function filterMemoryListByCreatedUntil(
  entries: MemoryEntry[],
  until?: string,
): MemoryEntry[] {
  if (until === undefined) return entries;

  const normalized = until.trim();
  // A date-only value represents the full UTC calendar day for an inclusive cutoff.
  const threshold = Date.parse(
    /^\d{4}-\d{2}-\d{2}$/.test(normalized)
      ? `${normalized}T23:59:59.999Z`
      : normalized,
  );
  if (Number.isNaN(threshold)) return entries;

  return entries.filter((entry) => {
    const createdAt = Date.parse(entry.createdAt);
    return !Number.isNaN(createdAt) && createdAt <= threshold;
  });
}

/** Keep memories created on or after the requested timestamp. */
export function filterMemoryListByCreatedSince(
  entries: MemoryEntry[],
  since?: string,
): MemoryEntry[] {
  if (since === undefined) return entries;

  const normalized = since.trim();
  const threshold = Date.parse(
    /^\d{4}-\d{2}-\d{2}$/.test(normalized)
      ? `${normalized}T00:00:00.000Z`
      : normalized,
  );
  if (Number.isNaN(threshold)) return entries;

  return entries.filter((entry) => {
    const createdAt = Date.parse(entry.createdAt);
    return !Number.isNaN(createdAt) && createdAt >= threshold;
  });
}

/** Keep memories in the requested freshness state. */
export function filterMemoryListByFreshness(
  entries: MemoryEntry[],
  freshness?: MemoryFreshnessState,
  now = new Date(),
): MemoryEntry[] {
  if (freshness === undefined) return entries;
  return entries.filter((entry) => getMemoryFreshness(entry, now).state === freshness);
}

/** Keep memories at or above the requested effective importance score. */
export function filterMemoryListByImportance(
  entries: MemoryEntry[],
  minImportance?: number,
  maxImportance?: number,
): MemoryEntry[] {
  if (minImportance === undefined && maxImportance === undefined) return entries;
  return entries.filter((entry) => {
    const importance = getMemoryListImportance(entry);
    return (minImportance === undefined || importance >= minImportance) &&
      (maxImportance === undefined || importance <= maxImportance);
  });
}

/** Return the effective importance score used by filters and list output. */
export function getMemoryListImportance(entry: MemoryEntry): number {
  const value = entry.metadata?.importance;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : 0.5;
}

/** Return a safe task-criticality score for explain ranking. */
export function getMemoryExplainCriticality(entry: MemoryEntry): number {
  // Checkpoint memories use the canonical task_criticality name, while older
  // snapshot exports used criticality. Prefer the newer spelling but accept
  // both so explain ranking does not silently flatten imported scores.
  const values = [entry.metadata?.task_criticality, entry.metadata?.criticality];
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1) {
      return value;
    }
  }
  return 0.5;
}

/** Keep memories within the requested task-criticality range for explain. */
export function filterMemoryExplainByCriticality(
  entries: MemoryEntry[],
  minCriticality?: number,
  maxCriticality?: number,
): MemoryEntry[] {
  if (minCriticality === undefined && maxCriticality === undefined) return entries;
  return entries.filter((entry) => {
    const criticality = getMemoryExplainCriticality(entry);
    return (minCriticality === undefined || criticality >= minCriticality) &&
      (maxCriticality === undefined || criticality <= maxCriticality);
  });
}

/** Describe active scope filters for the human-facing explain output. */
export function formatMemoryExplainFilterMatches(
  options: {
    tier?: MemoryTier;
    namespace?: string;
    source?: string;
    content?: string;
    tags?: string[];
    freshness?: MemoryFreshnessState;
    pinned?: boolean;
    since?: string;
    until?: string;
    minImportance?: number;
    maxImportance?: number;
    minCriticality?: number;
    maxCriticality?: number;
  } = {},
): string[] {
  const filters: string[] = [];
  if (options.tier !== undefined) filters.push(`tier=${options.tier}`);
  if (options.namespace !== undefined) filters.push(`namespace=${options.namespace.trim()}`);
  if (options.source !== undefined) filters.push(`source=${normalizeMemoryListSource(options.source)}`);
  if (options.content !== undefined) filters.push(`content=${options.content}`);
  if (options.tags !== undefined) filters.push(`tags=[${options.tags.join(', ')}]`);
  if (options.freshness !== undefined) filters.push(`freshness=${options.freshness}`);
  if (options.pinned !== undefined) filters.push(`pinned=${options.pinned}`);
  if (options.since !== undefined) filters.push(`since=${options.since}`);
  if (options.until !== undefined) filters.push(`until=${options.until}`);
  if (options.minImportance !== undefined) filters.push(`minImportance=${options.minImportance}`);
  if (options.maxImportance !== undefined) filters.push(`maxImportance=${options.maxImportance}`);
  if (options.minCriticality !== undefined) filters.push(`minCriticality=${options.minCriticality}`);
  if (options.maxCriticality !== undefined) filters.push(`maxCriticality=${options.maxCriticality}`);
  return filters;
}

export function formatMemoryExplainFilterSummary(
  options: {
    tier?: MemoryTier;
    namespace?: string;
    source?: string;
    content?: string;
    tags?: string[];
    freshness?: MemoryFreshnessState;
    pinned?: boolean;
    since?: string;
    until?: string;
    minImportance?: number;
    maxImportance?: number;
    minCriticality?: number;
    maxCriticality?: number;
  } = {},
): string | undefined {
  const filters = formatMemoryExplainFilterMatches(options);
  return filters.length > 0 ? filters.join(', ') : undefined;
}

/**
 * Promote a memory entry to a higher tier.
 */
export function promoteMemory(
  entry: MemoryEntry,
  targetTier: MemoryTier,
): MemoryEntry {
  const currentTier = getEffectiveTier(entry);
  const tierOrder: MemoryTier[] = ['L3', 'L2', 'L1'];
  const currentIndex = tierOrder.indexOf(currentTier);
  const targetIndex = tierOrder.indexOf(targetTier);

  if (targetIndex <= currentIndex) {
    throw new Error(
      `Cannot promote from ${currentTier} to ${targetTier}. ` +
      `Target must be a higher tier (L1 > L2 > L3).`
    );
  }

  const now = new Date().toISOString();
  return {
    ...entry,
    tier: targetTier,
    previousTier: currentTier,
    promotedAt: now,
    demotedAt: undefined,
    lastAccessedAt: now,
  };
}

/**
 * Demote a memory entry to a lower tier.
 */
export function demoteMemory(
  entry: MemoryEntry,
  targetTier: MemoryTier,
): MemoryEntry {
  const currentTier = getEffectiveTier(entry);
  const tierOrder: MemoryTier[] = ['L3', 'L2', 'L1'];
  const currentIndex = tierOrder.indexOf(currentTier);
  const targetIndex = tierOrder.indexOf(targetTier);

  if (targetIndex >= currentIndex) {
    throw new Error(
      `Cannot demote from ${currentTier} to ${targetTier}. ` +
      `Target must be a lower tier (L3 < L2 < L1).`
    );
  }

  if (entry.pinned) {
    throw new Error(
      `Cannot demote pinned memory ${entry.id}. Unpin it first with 'savestate memory unpin'.`
    );
  }

  const now = new Date().toISOString();
  return {
    ...entry,
    tier: targetTier,
    previousTier: currentTier,
    demotedAt: now,
    promotedAt: undefined,
  };
}

/**
 * Pin a memory entry (prevents automatic demotion).
 */
export function pinMemory(entry: MemoryEntry): MemoryEntry {
  if (entry.pinned) {
    return entry; // Already pinned
  }
  return {
    ...entry,
    pinned: true,
    pinnedAt: new Date().toISOString(),
  };
}

/**
 * Unpin a memory entry.
 */
export function unpinMemory(entry: MemoryEntry): MemoryEntry {
  if (!entry.pinned) {
    return entry; // Already unpinned
  }
  return {
    ...entry,
    pinned: false,
    pinnedAt: undefined,
  };
}

/**
 * Parse a duration string (e.g., '24h', '7d', '30d') to milliseconds.
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(h|d|w|m)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}. Use formats like '24h', '7d', '30d'.`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    m: 30 * 24 * 60 * 60 * 1000,
  };
  return value * multipliers[unit];
}

/**
 * Apply automatic tier policies to memories.
 */
export function applyTierPolicies(
  memories: MemoryEntry[],
  config: MemoryTierConfig,
): { updated: MemoryEntry[]; changes: TierChange[] } {
  const changes: TierChange[] = [];
  const now = Date.now();

  const updated = memories.map((entry) => {
    if (entry.pinned) return entry; // Skip pinned entries

    const currentTier = getEffectiveTier(entry);
    const tierSettings = config.tiers[currentTier];

    // Check age-based demotion
    if (tierSettings.maxAge) {
      const maxAgeMs = parseDuration(tierSettings.maxAge);
      const entryDate = new Date(entry.lastAccessedAt ?? entry.updatedAt ?? entry.createdAt);
      const age = now - entryDate.getTime();

      if (age > maxAgeMs) {
        const targetTier = getNextLowerTier(currentTier);
        if (targetTier) {
          changes.push({
            entryId: entry.id,
            from: currentTier,
            to: targetTier,
            reason: 'age',
          });
          return demoteMemory(entry, targetTier);
        }
      }
    }

    return entry;
  });

  return { updated, changes };
}

export interface TierChange {
  entryId: string;
  from: MemoryTier;
  to: MemoryTier;
  reason: 'age' | 'access' | 'overflow' | 'manual';
}

export interface MemoryApplyPoliciesChangeJson {
  id: string;
  from: MemoryTier;
  to: MemoryTier;
  reason: TierChange['reason'];
}

export interface MemoryApplyPoliciesJson {
  dryRun: boolean;
  applied: boolean;
  changeCount: number;
  changes: MemoryApplyPoliciesChangeJson[];
}

export function formatMemoryApplyPoliciesJson(
  changes: TierChange[],
  options?: { dryRun?: boolean },
): string {
  const dryRun = options?.dryRun ?? false;
  const record: MemoryApplyPoliciesJson = {
    dryRun,
    applied: !dryRun && changes.length > 0,
    changeCount: changes.length,
    changes: changes.map((change) => ({
      id: change.entryId,
      from: change.from,
      to: change.to,
      reason: change.reason,
    })),
  };
  return JSON.stringify(record, null, 2);
}

export interface MemoryApplyPoliciesMissingJson {
  found: false;
  snapshot: string;
  applied: false;
  changeCount: 0;
}

export function formatMemoryApplyPoliciesMissingJson(snapshot: string): string {
  return JSON.stringify(
    {
      found: false,
      snapshot,
      applied: false,
      changeCount: 0,
    },
    null,
    2,
  );
}

function getNextLowerTier(tier: MemoryTier): MemoryTier | null {
  const order: MemoryTier[] = ['L1', 'L2', 'L3'];
  const index = order.indexOf(tier);
  if (index < order.length - 1) {
    return order[index + 1];
  }
  return null; // L3 has no lower tier
}

const MAX_MEMORY_LIST_LIMIT = 1000;
const MAX_MEMORY_LIST_OFFSET = 1000;

/** Parse memory list --limit without turning user input errors into an empty list. */
export function parseMemoryListLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_MEMORY_LIST_LIMIT}.`,
    );
  }

  const limit = Number(normalized);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MEMORY_LIST_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_MEMORY_LIST_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N memories when --limit is set. */
export function selectMemoryListEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

/** Parse memory list --offset without turning user input errors into an empty list. */
export function parseMemoryListOffset(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_MEMORY_LIST_OFFSET}.`,
    );
  }

  const offset = Number(normalized);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_MEMORY_LIST_OFFSET) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_MEMORY_LIST_OFFSET}.`,
    );
  }
  return offset;
}

/** Skip the first N memories when --offset is set. */
export function selectMemoryListOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}

/** Sort memories chronologically, keeping equal timestamps deterministic. */
export function sortMemoryListEntries(
  entries: MemoryEntry[],
  oldestFirst = false,
): MemoryEntry[] {
  return [...entries].sort((a, b) => {
    const createdAt = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    const chronological = Number.isNaN(createdAt) ? a.createdAt.localeCompare(b.createdAt) : createdAt;
    return (oldestFirst ? chronological : -chronological) || a.id.localeCompare(b.id);
  });
}

/** Keep table output readable while still identifying the originating source. */
export function formatMemoryListSource(source: string): string {
  const normalized = normalizeMemoryListSource(source).replace(/\s+/g, ' ');
  return normalized.length > 18 ? `${normalized.slice(0, 15)}...` : normalized;
}

/** Keep importance visible without making the human-facing table noisy. */
export function formatMemoryListImportance(entry: MemoryEntry): string {
  return getMemoryListImportance(entry).toFixed(2);
}

/** Keep namespace labels readable in the human-facing memory table. */
export function formatMemoryListNamespace(namespace: string | undefined): string {
  const normalized = namespace?.trim();
  if (!normalized) return '—';
  return normalized.length > 24 ? `${normalized.slice(0, 21)}...` : normalized;
}

/** Keep access timestamps compact and predictable in the human-facing table. */
export function formatMemoryListLastAccessed(lastAccessedAt: string | undefined): string {
  if (!lastAccessedAt) return '—';
  const timestamp = new Date(lastAccessedAt);
  return Number.isNaN(timestamp.getTime()) ? '—' : timestamp.toISOString().slice(0, 10);
}

/** Keep creation dates compact and predictable in the human-facing table. */
export function formatMemoryListCreatedAt(createdAt: string): string {
  const timestamp = new Date(createdAt);
  return Number.isNaN(timestamp.getTime()) ? '—' : timestamp.toISOString().slice(0, 10);
}

/** Show freshness state compactly in the human-facing memory table. */
export function formatMemoryListFreshness(entry: MemoryEntry, now = new Date()): string {
  const state = getMemoryFreshness(entry, now).state;
  return state === 'needs_confirmation' ? 'confirm' : state;
}

/** Show the full freshness state in a human-facing memory explanation. */
export function formatMemoryExplainFreshness(entry: MemoryEntry, now = new Date()): string {
  const freshness = getMemoryFreshness(entry, now);
  const state = freshness.state === 'needs_confirmation'
    ? 'needs confirmation'
    : freshness.state;
  const verificationSource = freshness.verificationSource
    ? `; source ${normalizeMemorySource(freshness.verificationSource)}`
    : '';
  return `${state} (${freshness.class}; verified ${formatMemoryListCreatedAt(freshness.lastVerifiedAt)}${verificationSource})`;
}

/** Keep source identifiers consistent across human and machine-readable explain output. */
export function formatMemoryExplainSource(source: string | undefined): string {
  return normalizeMemoryListSource(source);
}

/** Keep namespace labels consistent between memory list and explain output. */
export function formatMemoryExplainNamespace(namespace: string | undefined): string {
  return formatMemoryListNamespace(namespace);
}

/** Truncate table previews without adding an ellipsis to already-short content. */
export function formatMemoryListContent(content: string, maxLength = 40): string {
  // Keep imported CRLF, tabs, and repeated whitespace from breaking table rows.
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength
    ? `${Array.from(normalized).slice(0, maxLength).join('')}...`
    : normalized;
}

/** Keep explain previews readable without adding an ellipsis to short content. */
export function formatMemoryExplainContent(content: string, maxLength = 60): string {
  return formatMemoryListContent(content, maxLength) || '—';
}

/** Keep tag labels readable in the human-facing memory table. */
export function formatMemoryListTags(entry: MemoryEntry, maxLength = 24): string {
  const tags = getMemoryListTags(entry).join(', ');
  return tags.length > maxLength
    ? `${Array.from(tags).slice(0, maxLength - 3).join('')}...`
    : tags || '—';
}

/** Keep the table shape stable across paginated memory list results. */
export function shouldShowMemoryListNamespace(entries: MemoryEntry[]): boolean {
  return entries.some(
    (entry) =>
      typeof entry.metadata?.namespace === 'string' &&
      entry.metadata.namespace.trim().length > 0,
  );
}

/** Keep the table compact when no memory has tags to display. */
export function shouldShowMemoryListTags(entries: MemoryEntry[]): boolean {
  return entries.some((entry) => getMemoryListTags(entry).length > 0);
}

/** Apply memory list --offset then --limit. */
export function applyMemoryListFilters<T>(
  entries: T[],
  options: { offset?: string; limit?: string },
): T[] {
  return selectMemoryListEntries(
    selectMemoryListOffsetEntries(entries, parseMemoryListOffset(options.offset)),
    parseMemoryListLimit(options.limit),
  );
}

/** Explain why a human-facing memory list has no rows to show. */
export function formatMemoryListEmptyState(
  matchingCount: number,
  offset: number,
  limit?: number,
  collectionEmpty = false,
  snapshotId?: string,
  filterSummary?: string,
): string {
  if (matchingCount === 0) {
    if (collectionEmpty) {
      const snapshotLabel = snapshotId ? ` in snapshot ${snapshotId}` : ' in this snapshot';
      if (filterSummary) {
        return `No memories found${snapshotLabel} matching these filters: ${filterSummary}. Capture or import memories to populate this list.`;
      }
      return `No memories found${snapshotLabel}. Capture or import memories to populate this list.`;
    }
    const criteria = filterSummary ? ` these filters: ${filterSummary}` : ' the criteria';
    return `No memories found matching${criteria}. Try adjusting the filters.`;
  }

  const suggestedOffset = limit === undefined
    ? 0
    : Math.floor((matchingCount - 1) / limit) * limit;
  const filterContext = filterSummary ? ` for these filters: ${filterSummary}` : '';
  return `No memories shown: offset ${offset} skips past ${matchingCount} matching ${
    matchingCount === 1 ? 'memory' : 'memories'
  }${filterContext}. Try --offset ${suggestedOffset} to open the nearest available page.`;
}

/** Summarize active list filters so an empty human-facing result is actionable. */
export function formatMemoryListFilterSummary(
  options: {
    tier?: MemoryTier;
    pinned?: boolean;
    source?: string;
    namespace?: string;
    content?: string;
    tags?: string[];
    until?: string;
    since?: string;
    freshness?: MemoryFreshnessState;
    minImportance?: number;
    maxImportance?: number;
  } = {},
): string | undefined {
  const normalizeFilterText = (value: string): string => value.replace(/\s+/g, ' ').trim();
  const filters: string[] = [];
  if (options.tier !== undefined) filters.push(`tier=${options.tier}`);
  if (options.pinned !== undefined) filters.push(options.pinned ? 'pinned' : 'unpinned');
  const source = options.source === undefined ? undefined : normalizeFilterText(options.source);
  if (source) filters.push(`source=${source}`);
  const namespace = options.namespace === undefined ? undefined : normalizeFilterText(options.namespace);
  if (namespace) filters.push(`namespace=${namespace}`);
  const content = options.content === undefined ? undefined : normalizeFilterText(options.content);
  if (content) filters.push(`content=${JSON.stringify(content)}`);
  const tags = options.tags?.map(normalizeFilterText).filter(Boolean);
  if (tags && tags.length > 0) filters.push(`tags=[${tags.join(', ')}]`);
  const since = options.since === undefined ? undefined : normalizeFilterText(options.since);
  if (since) filters.push(`since=${since}`);
  const until = options.until === undefined ? undefined : normalizeFilterText(options.until);
  if (until) filters.push(`until=${until}`);
  if (options.freshness !== undefined) filters.push(`freshness=${options.freshness}`);
  if (options.minImportance !== undefined) filters.push(`min-importance=${options.minImportance}`);
  if (options.maxImportance !== undefined) filters.push(`max-importance=${options.maxImportance}`);
  return filters.length > 0 ? filters.join(', ') : undefined;
}

/** Describe the visible memory page when filters or pagination hide entries. */
export function formatMemoryListPageSummary(
  total: number,
  shown: number,
  offset = 0,
  limit?: number,
): string {
  const pageEnd = Math.min(offset + shown, total);
  if (offset === 0 && pageEnd === total) return '';

  const pageDescription = limit === undefined ? `offset ${offset}` : `offset ${offset}, limit ${limit}`;
  const hasNextPage = pageEnd < total;
  const nextOffset = limit === undefined ? pageEnd : offset + limit;
  const hints = [pageDescription];
  if (hasNextPage) {
    hints.push(`next offset ${nextOffset}`);
  }
  if (offset > 0) {
    const previousOffset = shown === 0
      ? limit === undefined || total === 0
        ? 0
        : Math.floor((total - 1) / limit) * limit
      : offset - (limit === undefined ? shown : limit);
    hints.push(`previous offset ${Math.max(0, previousOffset)}`);
  }
  return `(showing ${shown} of ${total} matching memories; ${hints.join('; ')})`;
}

/**
 * List memories with tier information.
 */
export async function listMemories(
  storage: StorageBackend,
  passphrase: string,
  options?: {
    snapshotId?: string;
    tier?: MemoryTier;
    pinned?: boolean;
    source?: string;
    namespace?: string;
    content?: string;
    tags?: string[];
    until?: string;
    since?: string;
    freshness?: MemoryFreshnessState;
    minImportance?: number;
    maxImportance?: number;
    oldestFirst?: boolean;
    limit?: number;
    offset?: number;
    format?: 'table' | 'json';
  },
): Promise<void> {
  if (options?.format === 'json') {
    const snapshotId = options.snapshotId;
    if (snapshotId && snapshotId !== 'latest') {
      const entry = await findEntry(snapshotId);
      if (!entry) {
        console.log(formatMemoryListMissingJson(snapshotId));
        return;
      }
    } else {
      const latest = await getLatestEntry();
      if (!latest) {
        console.log(formatMemoryListMissingJson(snapshotId ?? 'latest'));
        return;
      }
    }
  }

  const { snapshot } = await loadSnapshot(storage, passphrase, options?.snapshotId);
  const normalized = normalizeMemory(snapshot.memory);

  let entries = sortMemoryListEntries(normalized.core, options?.oldestFirst);

  // Filter by tier
  if (options?.tier) {
    entries = filterByTier(entries, options.tier);
  }

  // Filter by pinned status
  if (options?.pinned !== undefined) {
    entries = entries.filter((e) => !!e.pinned === options.pinned);
  }

  entries = filterMemoryListBySource(entries, options?.source);

  entries = filterMemoryListByNamespace(entries, options?.namespace);
  entries = filterMemoryListByContent(entries, options?.content);
  entries = filterMemoryListByTags(entries, options?.tags);
  entries = filterMemoryListByCreatedUntil(entries, options?.until);
  entries = filterMemoryListByCreatedSince(entries, options?.since);
  const freshnessNow = new Date();
  entries = filterMemoryListByFreshness(entries, options?.freshness, freshnessNow);
  entries = filterMemoryListByImportance(entries, options?.minImportance, options?.maxImportance);

  const filteredEntries = entries;
  const offset = options?.offset ?? 0;
  entries = selectMemoryListEntries(
    selectMemoryListOffsetEntries(filteredEntries, offset),
    options?.limit,
  );

  if (options?.format === 'json') {
    console.log(formatMemoryListJson(filteredEntries, entries, {
      snapshot: snapshot.manifest.id,
      offset,
      limit: options?.limit,
      hasMore: offset + entries.length < filteredEntries.length,
      filters: {
        tier: options?.tier,
        freshness: options?.freshness,
        pinned: options?.pinned,
        source: options?.source,
        namespace: options?.namespace,
        content: options?.content,
        tags: options?.tags,
        since: options?.since,
        until: options?.until,
        oldestFirst: options?.oldestFirst,
        minImportance: options?.minImportance,
        maxImportance: options?.maxImportance,
      },
    }));
    return;
  }

  // Table format
  const { counts, total } = getMemoryListSummary(filteredEntries);
  console.log(`\nMemory Tiers Summary:`);
  console.log(`  L1 (short-term):  ${counts.L1} items`);
  console.log(`  L2 (working set): ${counts.L2} items`);
  console.log(`  L3 (archive):     ${counts.L3} items`);
  console.log(`  Total:            ${total} items\n`);
  console.log(`Freshness Summary: ${formatMemoryListFreshnessSummary(filteredEntries, freshnessNow)}\n`);

  const pageSummary = formatMemoryListPageSummary(total, entries.length, offset, options?.limit);
  if (pageSummary) {
    console.log(`${pageSummary}`);
    if (entries.length > 0) {
      console.log(`${formatMemoryListPageFreshnessSummary(entries, freshnessNow)}\n`);
    }
  }

  if (entries.length === 0) {
    console.log(formatMemoryListEmptyState(
      filteredEntries.length,
      offset,
      options?.limit,
      normalized.core.length === 0,
      snapshot.manifest.id,
      formatMemoryListFilterSummary({
        tier: options?.tier,
        pinned: options?.pinned,
        source: options?.source,
        namespace: options?.namespace,
        content: options?.content,
        tags: options?.tags,
        since: options?.since,
        until: options?.until,
        freshness: options?.freshness,
        minImportance: options?.minImportance,
        maxImportance: options?.maxImportance,
      }),
    ));
    return;
  }

  const showNamespace = shouldShowMemoryListNamespace(filteredEntries);
  const showTags = shouldShowMemoryListTags(filteredEntries);
  const tableColumns = [
    'ID                                    ',
    'Tier',
    'Pinned',
    'Importance',
    'Source              ',
    ...(showNamespace ? ['Namespace                    '] : []),
    ...(showTags ? ['Tags                    '] : []),
    'Freshness ',
    'Created   ',
    'Accessed   ',
    'Content (truncated)',
  ];
  console.log(tableColumns.join('  '));
  console.log('─'.repeat(tableColumns.join('  ').length));

  for (const entry of entries) {
    const tier = getEffectiveTier(entry);
    const pinned = entry.pinned ? '📌' : '  ';
    const source = formatMemoryListSource(normalizeMemoryListSource(entry.source)).padEnd(18);
    const namespace = formatMemoryListNamespace(
      typeof entry.metadata?.namespace === 'string' ? entry.metadata.namespace : undefined,
    ).padEnd(24);
    const tags = formatMemoryListTags(entry).padEnd(24);
    const freshness = formatMemoryListFreshness(entry).padEnd(10);
    const createdAt = formatMemoryListCreatedAt(entry.createdAt).padEnd(10);
    const lastAccessed = formatMemoryListLastAccessed(entry.lastAccessedAt).padEnd(10);
    const content = formatMemoryListContent(entry.content);
    console.log([
      entry.id.padEnd(36),
      tier,
      pinned,
      formatMemoryListImportance(entry),
      source,
      ...(showNamespace ? [namespace] : []),
      ...(showTags ? [tags] : []),
      freshness,
      createdAt,
      lastAccessed,
      content,
    ].join('  '));
  }
}

/**
 * Promote a memory to a higher tier.
 */
export interface MemoryPromoteJson {
  id: string;
  from: MemoryTier;
  to: MemoryTier;
}

export function formatMemoryPromoteJson(id: string, from: MemoryTier, to: MemoryTier): string {
  const record: MemoryPromoteJson = { id, from, to };
  return JSON.stringify(record, null, 2);
}

export interface MemoryPromoteMissingJson {
  found: false;
  id: string;
  from: null;
  to: null;
}

export function formatMemoryPromoteMissingJson(id: string): string {
  return JSON.stringify(
    {
      found: false,
      id,
      from: null,
      to: null,
    },
    null,
    2,
  );
}

const MAX_MEMORY_PROMOTE_LIMIT = 1000;
const MAX_MEMORY_PROMOTE_OFFSET = 1000;

/** Parse memory promote --limit without turning user input errors into an empty promote. */
export function parseMemoryPromoteLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_MEMORY_PROMOTE_LIMIT}.`,
    );
  }

  const limit = Number(normalized);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MEMORY_PROMOTE_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_MEMORY_PROMOTE_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N promote status field rows when --limit is set. */
export function selectMemoryPromoteEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

/** Parse memory promote --offset without turning user input errors into an empty promote. */
export function parseMemoryPromoteOffset(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_MEMORY_PROMOTE_OFFSET}.`,
    );
  }

  const offset = Number(normalized);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_MEMORY_PROMOTE_OFFSET) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_MEMORY_PROMOTE_OFFSET}.`,
    );
  }
  return offset;
}

/** Skip the first N promote status field rows when --offset is set. */
export function selectMemoryPromoteOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}

/** Apply memory promote --offset then --limit. */
export function applyMemoryPromoteFilters<T>(
  entries: T[],
  options: { offset?: string; limit?: string },
): T[] {
  return selectMemoryPromoteEntries(
    selectMemoryPromoteOffsetEntries(entries, parseMemoryPromoteOffset(options.offset)),
    parseMemoryPromoteLimit(options.limit),
  );
}

export async function promoteMemoryCommand(
  storage: StorageBackend,
  passphrase: string,
  memoryId: string,
  options: {
    to?: MemoryTier;
    snapshotId?: string;
    format?: 'pretty' | 'json';
    limit?: string;
    offset?: string;
  },
): Promise<void> {
  parseMemoryPromoteLimit(options.limit);
  parseMemoryPromoteOffset(options.offset);
  const targetTier = options.to ?? 'L1';
  const { snapshot, filename } = await loadSnapshot(storage, passphrase, options.snapshotId);

  const entryIndex = snapshot.memory.core.findIndex((e) => e.id === memoryId);
  if (entryIndex === -1) {
    if (options.format === 'json') {
      console.log(formatMemoryPromoteMissingJson(memoryId));
      return;
    }
    throw new Error(`Memory entry not found: ${memoryId}`);
  }

  const entry = snapshot.memory.core[entryIndex];
  const currentTier = getEffectiveTier(entry);

  const promoted = promoteMemory(entry, targetTier);
  snapshot.memory.core[entryIndex] = promoted;

  // Save updated snapshot
  await saveSnapshot(storage, passphrase, snapshot, filename);

  if (options.format === 'json') {
    console.log(formatMemoryPromoteJson(memoryId, currentTier, targetTier));
    return;
  }

  const rows = [
    `✓ Promoted memory ${memoryId} from ${currentTier} to ${targetTier}`,
  ];
  for (const row of applyMemoryPromoteFilters(rows, options)) {
    console.log(row);
  }
}

/**
 * Demote a memory to a lower tier.
 */
export interface MemoryDemoteJson {
  id: string;
  from: MemoryTier;
  to: MemoryTier;
}

export function formatMemoryDemoteJson(id: string, from: MemoryTier, to: MemoryTier): string {
  const record: MemoryDemoteJson = { id, from, to };
  return JSON.stringify(record, null, 2);
}

export interface MemoryDemoteMissingJson {
  found: false;
  id: string;
  from: null;
  to: null;
}

export function formatMemoryDemoteMissingJson(id: string): string {
  return JSON.stringify(
    {
      found: false,
      id,
      from: null,
      to: null,
    },
    null,
    2,
  );
}

const MAX_MEMORY_DEMOTE_LIMIT = 1000;
const MAX_MEMORY_DEMOTE_OFFSET = 1000;

/** Parse memory demote --limit without turning user input errors into an empty demote. */
export function parseMemoryDemoteLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_MEMORY_DEMOTE_LIMIT}.`,
    );
  }

  const limit = Number(normalized);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MEMORY_DEMOTE_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_MEMORY_DEMOTE_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N demote status field rows when --limit is set. */
export function selectMemoryDemoteEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

/** Parse memory demote --offset without turning user input errors into an empty demote. */
export function parseMemoryDemoteOffset(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_MEMORY_DEMOTE_OFFSET}.`,
    );
  }

  const offset = Number(normalized);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_MEMORY_DEMOTE_OFFSET) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_MEMORY_DEMOTE_OFFSET}.`,
    );
  }
  return offset;
}

/** Skip the first N demote status field rows when --offset is set. */
export function selectMemoryDemoteOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}

/** Apply memory demote --offset then --limit. */
export function applyMemoryDemoteFilters<T>(
  entries: T[],
  options: { offset?: string; limit?: string },
): T[] {
  return selectMemoryDemoteEntries(
    selectMemoryDemoteOffsetEntries(entries, parseMemoryDemoteOffset(options.offset)),
    parseMemoryDemoteLimit(options.limit),
  );
}

export async function demoteMemoryCommand(
  storage: StorageBackend,
  passphrase: string,
  memoryId: string,
  options: {
    to?: MemoryTier;
    snapshotId?: string;
    format?: 'pretty' | 'json';
    limit?: string;
    offset?: string;
  },
): Promise<void> {
  parseMemoryDemoteLimit(options.limit);
  parseMemoryDemoteOffset(options.offset);
  const targetTier = options.to ?? 'L3';
  const { snapshot, filename } = await loadSnapshot(storage, passphrase, options.snapshotId);

  const entryIndex = snapshot.memory.core.findIndex((e) => e.id === memoryId);
  if (entryIndex === -1) {
    if (options.format === 'json') {
      console.log(formatMemoryDemoteMissingJson(memoryId));
      return;
    }
    throw new Error(`Memory entry not found: ${memoryId}`);
  }

  const entry = snapshot.memory.core[entryIndex];
  const currentTier = getEffectiveTier(entry);

  const demoted = demoteMemory(entry, targetTier);
  snapshot.memory.core[entryIndex] = demoted;

  // Save updated snapshot
  await saveSnapshot(storage, passphrase, snapshot, filename);

  if (options.format === 'json') {
    console.log(formatMemoryDemoteJson(memoryId, currentTier, targetTier));
    return;
  }

  const rows = [
    `✓ Demoted memory ${memoryId} from ${currentTier} to ${targetTier}`,
  ];
  for (const row of applyMemoryDemoteFilters(rows, options)) {
    console.log(row);
  }
}

/**
 * Pin a memory (prevents automatic demotion).
 */
export interface MemoryPinJson {
  id: string;
  pinned: true;
}

export function formatMemoryPinJson(id: string): string {
  const record: MemoryPinJson = { id, pinned: true };
  return JSON.stringify(record, null, 2);
}

export interface MemoryPinMissingJson {
  found: false;
  id: string;
  pinned: null;
}

export function formatMemoryPinMissingJson(id: string): string {
  return JSON.stringify(
    {
      found: false,
      id,
      pinned: null,
    },
    null,
    2,
  );
}

const MAX_MEMORY_PIN_LIMIT = 1000;
const MAX_MEMORY_PIN_OFFSET = 1000;

/** Parse memory pin --limit without turning user input errors into an empty pin. */
export function parseMemoryPinLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MEMORY_PIN_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_MEMORY_PIN_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N pin status field rows when --limit is set. */
export function selectMemoryPinEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

/** Parse memory pin --offset without turning user input errors into an empty pin. */
export function parseMemoryPinOffset(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const offset = Number(value);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_MEMORY_PIN_OFFSET) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_MEMORY_PIN_OFFSET}.`,
    );
  }
  return offset;
}

/** Skip the first N pin status field rows when --offset is set. */
export function selectMemoryPinOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}

/** Apply memory pin --offset then --limit. */
export function applyMemoryPinFilters<T>(
  entries: T[],
  options: { offset?: string; limit?: string } = {},
): T[] {
  return selectMemoryPinEntries(
    selectMemoryPinOffsetEntries(entries, parseMemoryPinOffset(options.offset)),
    parseMemoryPinLimit(options.limit),
  );
}

export async function pinMemoryCommand(
  storage: StorageBackend,
  passphrase: string,
  memoryId: string,
  options?: {
    snapshotId?: string;
    format?: 'pretty' | 'json';
    limit?: string;
    offset?: string;
  },
): Promise<void> {
  parseMemoryPinLimit(options?.limit);
  parseMemoryPinOffset(options?.offset);
  const { snapshot, filename } = await loadSnapshot(storage, passphrase, options?.snapshotId);

  const entryIndex = snapshot.memory.core.findIndex((e) => e.id === memoryId);
  if (entryIndex === -1) {
    if (options?.format === 'json') {
      console.log(formatMemoryPinMissingJson(memoryId));
      return;
    }
    throw new Error(`Memory entry not found: ${memoryId}`);
  }

  const entry = snapshot.memory.core[entryIndex];
  if (entry.pinned) {
    if (options?.format === 'json') {
      console.log(formatMemoryPinJson(memoryId));
      return;
    }
    const alreadyPinnedRows = [`Memory ${memoryId} is already pinned.`];
    for (const row of applyMemoryPinFilters(alreadyPinnedRows, options ?? {})) {
      console.log(row);
    }
    return;
  }

  snapshot.memory.core[entryIndex] = pinMemory(entry);

  await saveSnapshot(storage, passphrase, snapshot, filename);

  if (options?.format === 'json') {
    console.log(formatMemoryPinJson(memoryId));
    return;
  }

  const rows = [`✓ Pinned memory ${memoryId}`];
  for (const row of applyMemoryPinFilters(rows, options ?? {})) {
    console.log(row);
  }
}

/**
 * Unpin a memory.
 */
export interface MemoryUnpinJson {
  id: string;
  pinned: false;
}

export function formatMemoryUnpinJson(id: string): string {
  const record: MemoryUnpinJson = { id, pinned: false };
  return JSON.stringify(record, null, 2);
}

export interface MemoryUnpinMissingJson {
  found: false;
  id: string;
  pinned: null;
}

export function formatMemoryUnpinMissingJson(id: string): string {
  return JSON.stringify(
    {
      found: false,
      id,
      pinned: null,
    },
    null,
    2,
  );
}

const MAX_MEMORY_UNPIN_LIMIT = 1000;
const MAX_MEMORY_UNPIN_OFFSET = 1000;

/** Parse memory unpin --limit without turning user input errors into an empty unpin. */
export function parseMemoryUnpinLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MEMORY_UNPIN_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_MEMORY_UNPIN_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N unpin status field rows when --limit is set. */
export function selectMemoryUnpinEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

/** Parse memory unpin --offset without turning user input errors into an empty unpin. */
export function parseMemoryUnpinOffset(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const offset = Number(value);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_MEMORY_UNPIN_OFFSET) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_MEMORY_UNPIN_OFFSET}.`,
    );
  }
  return offset;
}

/** Skip the first N unpin status field rows when --offset is set. */
export function selectMemoryUnpinOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}

/** Apply memory unpin --offset then --limit. */
export function applyMemoryUnpinFilters<T>(
  entries: T[],
  options: { offset?: string; limit?: string } = {},
): T[] {
  return selectMemoryUnpinEntries(
    selectMemoryUnpinOffsetEntries(entries, parseMemoryUnpinOffset(options.offset)),
    parseMemoryUnpinLimit(options.limit),
  );
}

export async function unpinMemoryCommand(
  storage: StorageBackend,
  passphrase: string,
  memoryId: string,
  options?: {
    snapshotId?: string;
    format?: 'pretty' | 'json';
    limit?: string;
    offset?: string;
  },
): Promise<void> {
  parseMemoryUnpinLimit(options?.limit);
  parseMemoryUnpinOffset(options?.offset);
  const { snapshot, filename } = await loadSnapshot(storage, passphrase, options?.snapshotId);

  const entryIndex = snapshot.memory.core.findIndex((e) => e.id === memoryId);
  if (entryIndex === -1) {
    if (options?.format === 'json') {
      console.log(formatMemoryUnpinMissingJson(memoryId));
      return;
    }
    throw new Error(`Memory entry not found: ${memoryId}`);
  }

  const entry = snapshot.memory.core[entryIndex];
  if (!entry.pinned) {
    if (options?.format === 'json') {
      console.log(formatMemoryUnpinJson(memoryId));
      return;
    }
    const alreadyUnpinnedRows = [`Memory ${memoryId} is not pinned.`];
    for (const row of applyMemoryUnpinFilters(alreadyUnpinnedRows, options ?? {})) {
      console.log(row);
    }
    return;
  }

  snapshot.memory.core[entryIndex] = unpinMemory(entry);

  await saveSnapshot(storage, passphrase, snapshot, filename);

  if (options?.format === 'json') {
    console.log(formatMemoryUnpinJson(memoryId));
    return;
  }

  const rows = [`✓ Unpinned memory ${memoryId}`];
  for (const row of applyMemoryUnpinFilters(rows, options ?? {})) {
    console.log(row);
  }
}

const MAX_MEMORY_APPLY_POLICIES_LIMIT = 1000;
const MAX_MEMORY_APPLY_POLICIES_OFFSET = 1000;

/** Parse memory apply-policies --limit without turning user input errors into an empty change list. */
export function parseMemoryApplyPoliciesLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MEMORY_APPLY_POLICIES_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_MEMORY_APPLY_POLICIES_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N tier changes when --limit is set. */
export function selectMemoryApplyPoliciesChanges<T>(changes: T[], limit?: number): T[] {
  if (limit === undefined) return changes;
  return changes.slice(0, limit);
}

/** Parse memory apply-policies --offset without turning user input errors into an empty change list. */
export function parseMemoryApplyPoliciesOffset(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const offset = Number(value);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_MEMORY_APPLY_POLICIES_OFFSET) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_MEMORY_APPLY_POLICIES_OFFSET}.`,
    );
  }
  return offset;
}

/** Skip the first N tier changes when --offset is set. */
export function selectMemoryApplyPoliciesOffsetChanges<T>(changes: T[], offset?: number): T[] {
  if (offset === undefined) return changes;
  return changes.slice(offset);
}

/** Apply memory apply-policies --offset then --limit. */
export function applyMemoryApplyPoliciesFilters<T>(
  changes: T[],
  options: { offset?: string; limit?: string } = {},
): T[] {
  return selectMemoryApplyPoliciesChanges(
    selectMemoryApplyPoliciesOffsetChanges(changes, parseMemoryApplyPoliciesOffset(options.offset)),
    parseMemoryApplyPoliciesLimit(options.limit),
  );
}

/**
 * Apply tier policies and show what would change.
 */
export async function applyPoliciesCommand(
  storage: StorageBackend,
  passphrase: string,
  options?: {
    snapshotId?: string;
    dryRun?: boolean;
    format?: 'pretty' | 'json';
    limit?: string;
    offset?: string;
  },
): Promise<void> {
  parseMemoryApplyPoliciesLimit(options?.limit);
  parseMemoryApplyPoliciesOffset(options?.offset);
  if (options?.format === 'json') {
    const snapshotId = options.snapshotId;
    if (snapshotId && snapshotId !== 'latest') {
      const entry = await findEntry(snapshotId);
      if (!entry) {
        console.log(formatMemoryApplyPoliciesMissingJson(snapshotId));
        return;
      }
    } else {
      const latest = await getLatestEntry();
      if (!latest) {
        console.log(formatMemoryApplyPoliciesMissingJson(snapshotId ?? 'latest'));
        return;
      }
    }
  }

  const { snapshot, filename } = await loadSnapshot(storage, passphrase, options?.snapshotId);
  const config = snapshot.memory.tierConfig ?? DEFAULT_TIER_CONFIG;

  const { updated, changes } = applyTierPolicies(snapshot.memory.core, config);
  const shown = applyMemoryApplyPoliciesFilters(changes, options ?? {});
  const dryRun = options?.dryRun ?? false;

  if (options?.format === 'json') {
    if (!dryRun && changes.length > 0) {
      snapshot.memory.core = updated;
      await saveSnapshot(storage, passphrase, snapshot, filename);
    }
    console.log(formatMemoryApplyPoliciesJson(shown, { dryRun }));
    return;
  }

  if (changes.length === 0) {
    console.log('No tier changes needed based on current policies.');
    return;
  }

  console.log(`\nTier changes (${options?.dryRun ? 'dry run' : 'applying'}):\n`);
  for (const change of shown) {
    console.log(`  ${change.entryId}: ${change.from} → ${change.to} (${change.reason})`);
  }

  if (!options?.dryRun) {
    snapshot.memory.core = updated;
    await saveSnapshot(storage, passphrase, snapshot, filename);
    console.log(`\n✓ Applied ${changes.length} tier changes.`);
  } else {
    console.log(`\nRun without --dry-run to apply these changes.`);
  }
}

export interface MemoryConfigJson {
  version: string;
  defaultTier: MemoryTier;
  l1MaxItems: number | null;
  l1MaxAge: string | null;
  l1IncludeInContext: boolean;
  l2MaxItems: number | null;
  l2MaxAge: string | null;
  l2IncludeInContext: boolean;
  l3MaxItems: number | null;
  l3MaxAge: string | null;
  l3IncludeInContext: boolean;
  policies: Array<{
    name: string;
    trigger: MemoryTierPolicy['trigger'];
    from: MemoryTier;
    to: MemoryTier;
    threshold: string | number | null;
  }>;
}

export function formatMemoryConfigJson(config: MemoryTierConfig): string {
  const record: MemoryConfigJson = {
    version: config.version,
    defaultTier: config.defaultTier,
    l1MaxItems: config.tiers.L1.maxItems ?? null,
    l1MaxAge: config.tiers.L1.maxAge ?? null,
    l1IncludeInContext: config.tiers.L1.includeInContext,
    l2MaxItems: config.tiers.L2.maxItems ?? null,
    l2MaxAge: config.tiers.L2.maxAge ?? null,
    l2IncludeInContext: config.tiers.L2.includeInContext,
    l3MaxItems: config.tiers.L3.maxItems ?? null,
    l3MaxAge: config.tiers.L3.maxAge ?? null,
    l3IncludeInContext: config.tiers.L3.includeInContext,
    policies: (config.policies ?? []).map((policy) => ({
      name: policy.name,
      trigger: policy.trigger,
      from: policy.from,
      to: policy.to,
      threshold: policy.threshold ?? null,
    })),
  };
  return JSON.stringify(record, null, 2);
}

export interface MemoryConfigMissingJson {
  found: false;
  snapshot: string;
  version: null;
  defaultTier: null;
}

export function formatMemoryConfigMissingJson(snapshot: string): string {
  return JSON.stringify(
    {
      found: false,
      snapshot,
      version: null,
      defaultTier: null,
    },
    null,
    2,
  );
}

const MAX_MEMORY_CONFIG_LIMIT = 1000;
const MAX_MEMORY_CONFIG_OFFSET = 1000;

/** Parse memory config --limit without turning user input errors into an empty config. */
export function parseMemoryConfigLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_MEMORY_CONFIG_LIMIT}.`,
    );
  }

  const limit = Number(normalized);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MEMORY_CONFIG_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_MEMORY_CONFIG_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N configuration setting rows when --limit is set. */
export function selectMemoryConfigEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

/** Parse memory config --offset without turning user input errors into an empty config. */
export function parseMemoryConfigOffset(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_MEMORY_CONFIG_OFFSET}.`,
    );
  }

  const offset = Number(normalized);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_MEMORY_CONFIG_OFFSET) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_MEMORY_CONFIG_OFFSET}.`,
    );
  }
  return offset;
}

/** Skip the first N configuration setting rows when --offset is set. */
export function selectMemoryConfigOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}

/** Apply memory config --offset then --limit. */
export function applyMemoryConfigFilters<T>(
  entries: T[],
  options: { offset?: string; limit?: string },
): T[] {
  return selectMemoryConfigEntries(
    selectMemoryConfigOffsetEntries(entries, parseMemoryConfigOffset(options.offset)),
    parseMemoryConfigLimit(options.limit),
  );
}

export async function showTierConfig(
  storage: StorageBackend,
  passphrase: string,
  options?: {
    snapshotId?: string;
    format?: 'pretty' | 'json';
    limit?: number;
    offset?: number;
  },
): Promise<void> {
  if (options?.format === 'json') {
    const snapshotId = options.snapshotId;
    if (snapshotId && snapshotId !== 'latest') {
      const entry = await findEntry(snapshotId);
      if (!entry) {
        console.log(formatMemoryConfigMissingJson(snapshotId));
        return;
      }
    } else {
      const latest = await getLatestEntry();
      if (!latest) {
        console.log(formatMemoryConfigMissingJson(snapshotId ?? 'latest'));
        return;
      }
    }
  }

  const { snapshot } = await loadSnapshot(storage, passphrase, options?.snapshotId);
  const config = snapshot.memory.tierConfig ?? DEFAULT_TIER_CONFIG;

  if (options?.format === 'json') {
    console.log(formatMemoryConfigJson(config));
    return;
  }

  console.log('\nMemory Tier Configuration:\n');
  const rows = [
    `version: ${config.version}`,
    `defaultTier: ${config.defaultTier}`,
    `l1.maxItems: ${config.tiers.L1.maxItems ?? 'null'}`,
    `l1.maxAge: ${config.tiers.L1.maxAge ?? 'null'}`,
    `l1.includeInContext: ${config.tiers.L1.includeInContext}`,
    `l2.maxItems: ${config.tiers.L2.maxItems ?? 'null'}`,
    `l2.maxAge: ${config.tiers.L2.maxAge ?? 'null'}`,
    `l2.includeInContext: ${config.tiers.L2.includeInContext}`,
    `l3.maxItems: ${config.tiers.L3.maxItems ?? 'null'}`,
    `l3.maxAge: ${config.tiers.L3.maxAge ?? 'null'}`,
    `l3.includeInContext: ${config.tiers.L3.includeInContext}`,
  ];
  for (const row of selectMemoryConfigEntries(
    selectMemoryConfigOffsetEntries(rows, options?.offset),
    options?.limit,
  )) {
    console.log(row);
  }
}

export interface MemoryExplainResultJson {
  id: string;
  createdAt?: string;
  score: number;
  /** Score components used to produce the final retrieval score. */
  scoreBreakdown?: MemoryExplainScoreBreakdownJson;
  /** Effective importance score used by the retrieval ranking. */
  importance?: number;
  /** Effective task-criticality score used by the retrieval ranking. */
  criticality?: number;
  /** Normalized source id for tracing the memory's origin. */
  source?: string;
  /** Trimmed namespace for tracing the memory's scope, or null when unassigned. */
  namespace: string | null;
  /** Normalized metadata tags, when the memory has any. */
  tags?: string[];
  summary: string;
  pinned: boolean;
  tier: MemoryTier;
  freshness: MemoryFreshnessState;
  freshnessClass?: MemoryFreshnessClass;
  lastVerifiedAt?: string;
  verificationSource?: string;
}

export interface MemoryExplainScoreBreakdownJson {
  semanticSimilarity: number;
  recencyDecay: number;
  importance: number;
  taskCriticality: number;
  confidenceBoost: number;
}

export interface MemoryExplainJson {
  query: string;
  /** Resolved archive snapshot used for retrieval, when available. */
  snapshot?: string;
  shown: number;
  emptyReason: 'collection' | 'page' | null;
  /** Nearest page containing entries when a stale offset returns an empty page. */
  suggestedOffset: number | null;
  pagination: MemoryExplainPaginationJson;
  filters?: MemoryExplainFiltersJson;
  results: MemoryExplainResultJson[];
}

export interface MemoryExplainFiltersJson {
  tier?: MemoryTier;
  namespace?: string;
  source?: string;
  content?: string;
  tags?: string[];
  freshness?: MemoryFreshnessState;
  pinned?: boolean;
  since?: string;
  until?: string;
  minImportance?: number;
  maxImportance?: number;
  minCriticality?: number;
  maxCriticality?: number;
}

export interface MemoryExplainPaginationJson {
  offset: number;
  limit: number | null;
  total: number;
  /** Number of matching results after the visible page. */
  remaining: number;
  pageSize: number;
  hasPrevious: boolean;
  previousOffset: number | null;
  hasMore: boolean;
  nextOffset: number | null;
}

/** Describe the visible page so human output remains useful with --offset/--limit. */
export function formatMemoryExplainPrettySummary(
  shown: number,
  total: number,
  options: { offset?: number; pageSize?: number } = {},
): string {
  const offset = options.offset ?? 0;
  const pageSize = options.pageSize ?? DEFAULT_MEMORY_EXPLAIN_LIMIT;

  if (total === 0) return 'No memories matched the query.';
  if (shown === 0) {
    const suggestedOffset = Math.floor((total - 1) / pageSize) * pageSize;
    return `No memories on this page (offset ${offset}; ${total} relevant memories matched). ` +
      `Try --offset ${suggestedOffset} to open the nearest available page.`;
  }

  const first = offset + 1;
  const last = offset + shown;
  const navigation = [
    ...(offset > 0 ? [`Previous page: use --offset ${Math.max(0, offset - pageSize)} --limit ${pageSize}.`] : []),
    ...(last < total ? [`Next page: use --offset ${last} --limit ${pageSize}.`] : []),
  ];
  return `Showing ${first}-${last} of ${total} relevant memories.${navigation.length > 0 ? ` ${navigation.join(' ')}` : ''}`;
}

/** Keep the empty-state message aligned with whether the collection or page is empty. */
export function formatMemoryExplainEmptyMessage(total: number): string {
  return total === 0
    ? 'No memories matched the query.'
    : 'No memories are visible on this page.';
}

/** Keep empty-page tips actionable without implying that matching memories are missing. */
export function formatMemoryExplainEmptyTips(total: number): string[] {
  return total === 0
    ? [
        'Try broader search terms',
        'Check if memories exist with `savestate memory list`',
        'Verify the namespace is correct',
      ]
    : [
        'Use the suggested offset above to open the nearest matching page',
        'Adjust `--offset` or `--limit` to browse other pages',
      ];
}

/** Keep the human-readable score breakdown aligned with the JSON explanation. */
export function formatMemoryExplainScoreBreakdown(
  scores: MemoryExplainScoreBreakdownJson,
): string {
  return [
    `      • Semantic Similarity: ${(scores.semanticSimilarity * 100).toFixed(1)}% (weight: 25%)`,
    `      • Task Criticality:    ${(scores.taskCriticality * 100).toFixed(1)}% (weight: 45%)`,
    `      • Importance:          ${(scores.importance * 100).toFixed(1)}% (weight: 20%)`,
    `      • Recency:             ${(scores.recencyDecay * 100).toFixed(1)}% (weight: 10%)`,
    `      • Confidence Boost:    ${(scores.confidenceBoost * 100).toFixed(1)}% (neutral)`,
  ].join('\n');
}

export function formatMemoryExplainJson(
  query: string,
  results: Array<{
    id: string;
    createdAt?: string;
    score: number;
    scoreBreakdown?: MemoryExplainScoreBreakdownJson;
    importance?: number;
    criticality?: number;
    source?: string;
    /** Trimmed namespace for tracing the memory's scope. */
    namespace?: string;
    /** Normalized metadata tags for tracing the memory's labels. */
    tags?: string[];
    summary: string;
    pinned: boolean;
    tier: MemoryTier;
    freshness: MemoryFreshnessState;
    freshnessClass?: MemoryFreshnessClass;
    lastVerifiedAt?: string;
    verificationSource?: string;
  }>,
  pagination: Partial<MemoryExplainPaginationJson> = {},
  filters?: MemoryExplainFiltersJson,
  snapshotId?: string,
): string {
  const offset = pagination.offset ?? 0;
  const total = pagination.total ?? results.length;
  const pageSize = pagination.pageSize ?? pagination.limit ?? Math.max(1, results.length);
  // Keep an empty collection from advertising pagination just because --offset was supplied.
  const hasPrevious = offset > 0 && total > 0;
  const hasMore = pagination.hasMore ?? offset + results.length < total;
  const remaining = Math.max(0, total - offset - results.length);
  const suggestedOffset = results.length === 0 && total > 0
    ? Math.floor((total - 1) / pageSize) * pageSize
    : null;
  const previousOffset = offset > 0
    ? results.length === 0 && total > 0
      ? suggestedOffset
      : Math.max(0, offset - pageSize)
    : null;
  const record: MemoryExplainJson = {
    query,
    ...(snapshotId === undefined ? {} : { snapshot: snapshotId }),
    shown: results.length,
    emptyReason: results.length > 0 ? null : total === 0 ? 'collection' : 'page',
    suggestedOffset,
    pagination: {
      offset,
      limit: pagination.limit ?? null,
      total,
      remaining,
      pageSize,
      hasPrevious,
      previousOffset: hasPrevious ? previousOffset : null,
      hasMore,
      nextOffset: pagination.nextOffset ?? (hasMore ? offset + pageSize : null),
    },
    results: results.map((result) => ({
      id: result.id,
      createdAt: result.createdAt,
      score: result.score,
      scoreBreakdown: result.scoreBreakdown,
      importance: result.importance,
      criticality: result.criticality,
      source: result.source === undefined ? undefined : normalizeMemoryListSource(result.source),
      namespace: result.namespace?.trim() || null,
      ...(result.tags === undefined || result.tags.length === 0 ? {} : { tags: result.tags }),
      summary: result.summary,
      pinned: result.pinned,
      tier: result.tier,
      freshness: result.freshness,
      freshnessClass: result.freshnessClass,
      lastVerifiedAt: result.lastVerifiedAt,
      verificationSource: result.verificationSource === undefined
        ? undefined
        : normalizeMemorySource(result.verificationSource),
    })),
  };
  if (filters && Object.keys(filters).length > 0) {
    record.filters = {
      ...filters,
      ...(filters.source === undefined
        ? {}
        : { source: normalizeMemoryListSource(filters.source) }),
      ...(filters.namespace === undefined
        ? {}
        : { namespace: filters.namespace.trim() }),
    };
  }
  return JSON.stringify(record, null, 2);
}

export interface MemoryExplainMissingJson {
  found: false;
  query: string;
  /** Resolved archive snapshot used for retrieval, when available. */
  snapshot?: string;
  shown: 0;
  emptyReason: 'collection';
  suggestedOffset: null;
  pagination: MemoryExplainPaginationJson;
  filters?: MemoryExplainFiltersJson;
  results: null;
}

export function formatMemoryExplainMissingJson(
  query: string,
  pagination: Partial<MemoryExplainPaginationJson> = {},
  filters?: MemoryExplainFiltersJson,
  snapshotId?: string,
): string {
  const offset = pagination.offset ?? 0;
  const total = pagination.total ?? 0;
  const pageSize = pagination.pageSize ?? pagination.limit ?? 1;
  // Keep an empty collection from advertising pagination just because --offset was supplied.
  const hasPrevious = offset > 0 && total > 0;
  const hasMore = pagination.hasMore ?? offset < total;
  const remaining = Math.max(0, total - offset);
  const record: MemoryExplainMissingJson = {
    found: false,
    query,
    ...(snapshotId === undefined ? {} : { snapshot: snapshotId }),
    shown: 0,
    emptyReason: 'collection',
    suggestedOffset: null,
    pagination: {
      offset,
      limit: pagination.limit ?? null,
      total,
      remaining,
      pageSize,
      hasPrevious,
      previousOffset: hasPrevious ? Math.max(0, offset - pageSize) : null,
      hasMore,
      nextOffset: pagination.nextOffset ?? (hasMore ? offset + pageSize : null),
    },
    results: null,
  };
  if (filters && Object.keys(filters).length > 0) {
    record.filters = {
      ...filters,
      ...(filters.source === undefined
        ? {}
        : { source: normalizeMemoryListSource(filters.source) }),
      ...(filters.namespace === undefined
        ? {}
        : { namespace: filters.namespace.trim() }),
    };
  }
  return JSON.stringify(record, null, 2);
}

/** Preserve every active explain scope filter for JSON consumers. */
export function getMemoryExplainFilters(options?: {
  tier?: MemoryTier;
  namespace?: string;
  source?: string;
  content?: string;
  tags?: string[];
  freshness?: MemoryFreshnessState;
  pinned?: boolean;
  since?: string;
  until?: string;
  minImportance?: number;
  maxImportance?: number;
  minCriticality?: number;
  maxCriticality?: number;
}): MemoryExplainFiltersJson | undefined {
  if (!options) return undefined;

  const filters: MemoryExplainFiltersJson = {};
  if (options.tier !== undefined) filters.tier = options.tier;
  if (options.namespace !== undefined) filters.namespace = options.namespace.trim();
  if (options.source !== undefined) filters.source = normalizeMemoryListSource(options.source);
  if (options.content !== undefined) filters.content = options.content;
  if (options.tags !== undefined) filters.tags = options.tags;
  if (options.freshness !== undefined) filters.freshness = options.freshness;
  if (options.pinned !== undefined) filters.pinned = options.pinned;
  if (options.since !== undefined) filters.since = options.since;
  if (options.until !== undefined) filters.until = options.until;
  if (options.minImportance !== undefined) filters.minImportance = options.minImportance;
  if (options.maxImportance !== undefined) filters.maxImportance = options.maxImportance;
  if (options.minCriticality !== undefined) filters.minCriticality = options.minCriticality;
  if (options.maxCriticality !== undefined) filters.maxCriticality = options.maxCriticality;
  return Object.keys(filters).length > 0 ? filters : undefined;
}

const DEFAULT_MEMORY_EXPLAIN_LIMIT = 5;
const MAX_MEMORY_EXPLAIN_LIMIT = 1000;
const MAX_MEMORY_EXPLAIN_OFFSET = 1000;

/** Parse memory explain --limit without turning user input errors into an empty result list. */
export function parseMemoryExplainLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_MEMORY_EXPLAIN_LIMIT}.`,
    );
  }

  const limit = Number(normalized);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MEMORY_EXPLAIN_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_MEMORY_EXPLAIN_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N retrieval results when --limit is set. Defaults to 5 when omitted. */
export function selectMemoryExplainEntries<T>(entries: T[], limit?: number): T[] {
  return entries.slice(0, limit ?? DEFAULT_MEMORY_EXPLAIN_LIMIT);
}

/** Parse memory explain --offset without turning user input errors into an empty result list. */
export function parseMemoryExplainOffset(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_MEMORY_EXPLAIN_OFFSET}.`,
    );
  }

  const offset = Number(normalized);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_MEMORY_EXPLAIN_OFFSET) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_MEMORY_EXPLAIN_OFFSET}.`,
    );
  }
  return offset;
}

/** Skip the first N retrieval results when --offset is set. */
export function selectMemoryExplainOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}

/** Apply memory explain --offset then --limit. */
export function applyMemoryExplainFilters<T>(
  entries: T[],
  options: { offset?: string; limit?: string } = {},
): T[] {
  return selectMemoryExplainEntries(
    selectMemoryExplainOffsetEntries(entries, parseMemoryExplainOffset(options.offset)),
    parseMemoryExplainLimit(options.limit),
  );
}

/** Keep equal-score explain pages deterministic across archive iteration order. */
export function sortMemoryExplainResults<T extends {
  entry: Pick<MemoryEntry, 'createdAt' | 'id'>;
  finalScore: number;
}>(results: T[]): T[] {
  return [...results].sort((a, b) => {
    const scoreOrder = b.finalScore - a.finalScore;
    if (scoreOrder !== 0) return scoreOrder;

    const aCreatedAt = Date.parse(a.entry.createdAt);
    const bCreatedAt = Date.parse(b.entry.createdAt);
    if (Number.isFinite(aCreatedAt) && Number.isFinite(bCreatedAt) && aCreatedAt !== bCreatedAt) {
      return bCreatedAt - aCreatedAt;
    }
    if (Number.isFinite(aCreatedAt) !== Number.isFinite(bCreatedAt)) {
      return Number.isFinite(bCreatedAt) ? 1 : -1;
    }
    return a.entry.id.localeCompare(b.entry.id);
  });
}

/**
 * Explain why memories were retrieved for a query.
 * Shows detailed breakdown of scores and policy decisions.
 *
 * @see https://github.com/savestatedev/savestate/issues/115
 */
export async function explainMemoryCommand(
  storage: StorageBackend,
  passphrase: string,
  query: string,
  options?: {
    snapshotId?: string;
    tier?: MemoryTier;
    namespace?: string;
    source?: string;
    content?: string;
    limit?: string;
    offset?: string;
    tags?: string[];
    freshness?: MemoryFreshnessState;
    pinned?: boolean;
    since?: string;
    until?: string;
    minImportance?: number;
    maxImportance?: number;
    minCriticality?: number;
    maxCriticality?: number;
    format?: 'pretty' | 'json';
  },
): Promise<void> {
  const limit = parseMemoryExplainLimit(options?.limit);
  const offset = parseMemoryExplainOffset(options?.offset);
  const { snapshot, snapshotId } = await loadSnapshot(storage, passphrase, options?.snapshotId);

  // For this demo, we search the memory entries in the snapshot
  // In a full implementation, this would use the checkpoint storage searchMemories
  const normalized = normalizeMemory(snapshot.memory);
  const entries = filterMemoryExplainEntries(normalized.core, options);

  // Simple relevance scoring for demonstration
  const queryLower = query.toLowerCase();
  const scored = entries
    .map((entry) => {
      const contentLower = entry.content.toLowerCase();
      // Access tags from metadata if available
      const entryTags = getMemoryListTags(entry);
      const tagMatch = entryTags.some((tag) => tag.toLowerCase().includes(queryLower));

      // Calculate simple relevance score
      let semanticScore = 0;
      if (contentLower.includes(queryLower)) {
        semanticScore = 0.8;
      } else if (tagMatch) {
        semanticScore = 0.6;
      } else {
        // Check for partial word matches
        const words = queryLower.split(/\s+/);
        const matches = words.filter((w) => contentLower.includes(w)).length;
        semanticScore = matches / words.length * 0.5;
      }

      if (semanticScore === 0) return null;

      // Calculate other scores
      const tier = getEffectiveTier(entry);
      const tierWeights = { L1: 1.0, L2: 0.8, L3: 0.5 };
      const tierScore = tierWeights[tier];

      const age = Date.now() - new Date(entry.createdAt).getTime();
      const recencyScore = Math.exp(-age / (7 * 24 * 60 * 60 * 1000)); // 7-day half-life

      // Keep explain ranking aligned with list filters when older archives contain bad metadata.
      const importance = getMemoryListImportance(entry);
      const criticality = getMemoryExplainCriticality(entry);

      // Weighted score (matches checkpoint ranking formula)
      const finalScore =
        criticality * 0.45 +
        semanticScore * 0.25 +
        importance * 0.20 +
        recencyScore * 0.10;

      return {
        entry,
        scores: {
          semantic: semanticScore,
          recency: recencyScore,
          importance,
          criticality,
          tier: tierScore,
        },
        finalScore,
        explanation: {
          memory_id: entry.id,
          relevance_score_breakdown: {
            semantic_similarity: semanticScore,
            recency_decay: recencyScore,
            importance,
            task_criticality: criticality,
            confidence_boost: 1.0,
          },
          source_trace: {
            ingestion_timestamp: entry.createdAt,
            source_type: 'user_input' as const,
            source_id: normalizeMemoryListSource(entry.source),
          },
          timestamp_weight: recencyScore,
          policy_path: {
            rules_applied: [
              `task_criticality weight: 0.45`,
              `semantic_similarity weight: 0.25`,
              `importance weight: 0.20`,
              `recency_decay weight: 0.10`,
            ],
            filters_matched: formatMemoryExplainFilterMatches(options),
            boosts_applied: [
              ...(semanticScore > 0.7 ? [`strong semantic match (${semanticScore.toFixed(2)})`] : []),
              ...(importance > 0.7 ? [`high importance (${importance.toFixed(2)})`] : []),
              ...(criticality > 0.7 ? [`high criticality (${criticality.toFixed(2)})`] : []),
              ...(recencyScore > 0.8 ? [`recent memory (${recencyScore.toFixed(2)})`] : []),
            ],
          },
          final_score: finalScore,
          summary: generateSummary(entry, semanticScore, query),
        },
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  const sorted = sortMemoryExplainResults(scored);
  const scoredLimited = applyMemoryExplainFilters(sorted, options ?? {});
  const pagination = {
    offset: offset ?? 0,
    limit: limit ?? null,
    total: sorted.length,
    pageSize: limit ?? DEFAULT_MEMORY_EXPLAIN_LIMIT,
  };

  if (options?.format === 'json') {
    if (scoredLimited.length === 0) {
      if (sorted.length > 0) {
        console.log(formatMemoryExplainJson(
          query,
          [],
          pagination,
          getMemoryExplainFilters(options),
          snapshotId,
        ));
        return;
      }
      console.log(formatMemoryExplainMissingJson(
        query,
        pagination,
        getMemoryExplainFilters(options),
        snapshotId,
      ));
      return;
    }
    console.log(formatMemoryExplainJson(
      query,
      scoredLimited.map((r) => {
        const freshness = getMemoryFreshness(r.entry);
        return {
          id: r.entry.id,
          createdAt: r.entry.createdAt,
          score: r.finalScore,
          scoreBreakdown: {
            semanticSimilarity: r.scores.semantic,
            recencyDecay: r.scores.recency,
            importance: r.scores.importance,
            taskCriticality: r.scores.criticality,
            confidenceBoost: 1.0,
          },
          importance: getMemoryListImportance(r.entry),
          criticality: getMemoryExplainCriticality(r.entry),
          source: normalizeMemoryListSource(r.entry.source),
          namespace: typeof r.entry.metadata?.namespace === 'string'
            ? r.entry.metadata.namespace.trim() || undefined
            : undefined,
          tags: getMemoryListTags(r.entry),
          summary: r.explanation.summary,
          pinned: !!r.entry.pinned,
          tier: getEffectiveTier(r.entry),
          freshness: freshness.state,
          freshnessClass: freshness.class,
          lastVerifiedAt: freshness.lastVerifiedAt,
          verificationSource: freshness.verificationSource,
        };
      }),
      pagination,
      getMemoryExplainFilters(options),
      snapshotId,
    ));
    return;
  }

  // Pretty print format
  console.log(`\n🔍 Memory Retrieval Explanation for: "${query}"\n`);
  console.log(`   Snapshot: ${snapshotId}\n`);
  const filterSummary = formatMemoryExplainFilterSummary(options);
  if (filterSummary) {
    console.log(`   Filter: ${filterSummary}\n`);
  }
  console.log(`${formatMemoryExplainPrettySummary(scoredLimited.length, sorted.length, {
    offset: offset ?? 0,
    pageSize: limit ?? DEFAULT_MEMORY_EXPLAIN_LIMIT,
  })}\n`);
  console.log('─'.repeat(80));

  for (const [index, result] of scoredLimited.entries()) {
    const { entry, scores, finalScore, explanation } = result;
    const tier = getEffectiveTier(entry);
    const pinned = entry.pinned ? ' 📌' : '';

    console.log(`\n#${(offset ?? 0) + index + 1} ${entry.id}${pinned}`);
    console.log(`   Tier: ${tier} | Final Score: ${(finalScore * 100).toFixed(1)}%`);
    console.log(`   Freshness: ${formatMemoryExplainFreshness(entry)}`);
    console.log(`   Content: ${formatMemoryExplainContent(entry.content)}`);
    console.log();

    // Score breakdown
    console.log('   📊 Score Breakdown:');
    console.log(formatMemoryExplainScoreBreakdown({
      semanticSimilarity: scores.semantic,
      recencyDecay: scores.recency,
      importance: scores.importance,
      taskCriticality: scores.criticality,
      confidenceBoost: 1.0,
    }));
    console.log();

    // Source trace
    // Reuse list normalization so imported padding, blanks, and duplicates do not leak into output.
    const displayTags = getMemoryListTags(entry);

    console.log('   📍 Source Trace:');
    console.log(`      • Created: ${entry.createdAt}`);
    console.log(`      • Source: ${formatMemoryExplainSource(entry.source)}`);
    const namespace = typeof entry.metadata?.namespace === 'string'
      ? entry.metadata.namespace.trim()
      : '';
    if (namespace) {
      console.log(`      • Namespace: ${formatMemoryExplainNamespace(namespace)}`);
    }
    if (displayTags.length) {
      console.log(`      • Tags: ${displayTags.join(', ')}`);
    }
    console.log();

    // Policy path
    if (explanation.policy_path.boosts_applied.length > 0) {
      console.log('   ⚡ Boosts Applied:');
      for (const boost of explanation.policy_path.boosts_applied) {
        console.log(`      • ${boost}`);
      }
      console.log();
    }

    // Summary
    console.log(`   💡 ${explanation.summary}`);
    console.log('─'.repeat(80));
  }

  if (scoredLimited.length === 0) {
    console.log(`\n   ${formatMemoryExplainEmptyMessage(sorted.length)}\n`);
    console.log('   Tips:');
    for (const tip of formatMemoryExplainEmptyTips(sorted.length)) {
      console.log(`   • ${tip}`);
    }
    console.log();
  }
}

function generateSummary(entry: MemoryEntry, semanticScore: number, query: string): string {
  const parts: string[] = [];

  if (semanticScore > 0.7) {
    parts.push(`Strong match for "${query.slice(0, 20)}${query.length > 20 ? '...' : ''}"`);
  } else if (semanticScore > 0.4) {
    parts.push(`Partial match for query`);
  } else {
    parts.push(`Weak relevance to query`);
  }

  const tier = getEffectiveTier(entry);
  if (tier === 'L1') {
    parts.push('in active short-term memory');
  } else if (tier === 'L2') {
    parts.push('in working memory');
  } else {
    parts.push('retrieved from archive');
  }

  if (entry.pinned) {
    parts.push('(pinned)');
  }

  return parts.join(' ') + '.';
}

// ─── Helpers ─────────────────────────────────────────────────

import type { Snapshot } from '../types.js';

async function loadSnapshot(
  storage: StorageBackend,
  passphrase: string,
  snapshotId?: string,
): Promise<{ snapshot: Snapshot; filename: string; snapshotId: string }> {
  let resolvedId: string;
  let filename: string;

  if (snapshotId && snapshotId !== 'latest') {
    const entry = await findEntry(snapshotId);
    if (!entry) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }
    resolvedId = entry.id;
    filename = entry.filename;
  } else {
    const latest = await getLatestEntry();
    if (!latest) {
      throw new Error('No snapshots found. Run `savestate snapshot` first.');
    }
    resolvedId = latest.id;
    filename = latest.filename;
  }

  const encrypted = await storage.get(filename);
  const archive = await decrypt(encrypted, passphrase);
  let fileMap = await unpackFromArchive(archive);

  if (isIncremental(fileMap)) {
    fileMap = await reconstructFromChain(resolvedId, storage, passphrase);
  }

  const snapshot = unpackSnapshot(fileMap);
  return { snapshot, filename, snapshotId: resolvedId };
}

async function saveSnapshot(
  storage: StorageBackend,
  passphrase: string,
  snapshot: Snapshot,
  filename: string,
): Promise<void> {
  // Update timestamp
  snapshot.manifest.timestamp = new Date().toISOString();

  const fileMap = packSnapshot(snapshot);
  const archive = packToArchive(fileMap);
  const encrypted = await encrypt(archive, passphrase);

  await storage.put(filename, encrypted);

  // Update index entry
  await updateEntry(snapshot.manifest.id, {
    timestamp: snapshot.manifest.timestamp,
  });
}
