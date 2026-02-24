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
  MemoryTier,
  MemoryTierConfig,
  StorageBackend,
} from '../types.js';
import { findEntry, getLatestEntry, updateEntry } from '../index-file.js';
import { decrypt, encrypt } from '../encryption.js';
import { unpackFromArchive, unpackSnapshot, packSnapshot, packToArchive, snapshotFilename } from '../format.js';
import { isIncremental, reconstructFromChain } from '../incremental.js';

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

function getNextLowerTier(tier: MemoryTier): MemoryTier | null {
  const order: MemoryTier[] = ['L1', 'L2', 'L3'];
  const index = order.indexOf(tier);
  if (index < order.length - 1) {
    return order[index + 1];
  }
  return null; // L3 has no lower tier
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
    limit?: number;
    format?: 'table' | 'json';
  },
): Promise<void> {
  const { snapshot } = await loadSnapshot(storage, passphrase, options?.snapshotId);
  const normalized = normalizeMemory(snapshot.memory);

  let entries = normalized.core;

  // Filter by tier
  if (options?.tier) {
    entries = filterByTier(entries, options.tier);
  }

  // Filter by pinned status
  if (options?.pinned !== undefined) {
    entries = entries.filter((e) => !!e.pinned === options.pinned);
  }

  // Apply limit
  if (options?.limit) {
    entries = entries.slice(0, options.limit);
  }

  if (options?.format === 'json') {
    console.log(JSON.stringify(entries, null, 2));
    return;
  }

  // Table format
  const counts = countByTier(normalized.core);
  console.log(`\nMemory Tiers Summary:`);
  console.log(`  L1 (short-term):  ${counts.L1} items`);
  console.log(`  L2 (working set): ${counts.L2} items`);
  console.log(`  L3 (archive):     ${counts.L3} items`);
  console.log(`  Total:            ${normalized.core.length} items\n`);

  if (entries.length === 0) {
    console.log('No memories found matching the criteria.');
    return;
  }

  console.log('ID                                    Tier  Pinned  Content (truncated)');
  console.log('─'.repeat(80));

  for (const entry of entries) {
    const tier = getEffectiveTier(entry);
    const pinned = entry.pinned ? '📌' : '  ';
    const content = entry.content.slice(0, 40).replace(/\n/g, ' ');
    console.log(`${entry.id.padEnd(36)}  ${tier}   ${pinned}      ${content}...`);
  }
}

/**
 * Promote a memory to a higher tier.
 */
export async function promoteMemoryCommand(
  storage: StorageBackend,
  passphrase: string,
  memoryId: string,
  options: {
    to?: MemoryTier;
    snapshotId?: string;
  },
): Promise<void> {
  const targetTier = options.to ?? 'L1';
  const { snapshot, filename } = await loadSnapshot(storage, passphrase, options.snapshotId);

  const entryIndex = snapshot.memory.core.findIndex((e) => e.id === memoryId);
  if (entryIndex === -1) {
    throw new Error(`Memory entry not found: ${memoryId}`);
  }

  const entry = snapshot.memory.core[entryIndex];
  const currentTier = getEffectiveTier(entry);

  const promoted = promoteMemory(entry, targetTier);
  snapshot.memory.core[entryIndex] = promoted;

  // Save updated snapshot
  await saveSnapshot(storage, passphrase, snapshot, filename);

  console.log(`✓ Promoted memory ${memoryId} from ${currentTier} to ${targetTier}`);
}

/**
 * Demote a memory to a lower tier.
 */
export async function demoteMemoryCommand(
  storage: StorageBackend,
  passphrase: string,
  memoryId: string,
  options: {
    to?: MemoryTier;
    snapshotId?: string;
  },
): Promise<void> {
  const targetTier = options.to ?? 'L3';
  const { snapshot, filename } = await loadSnapshot(storage, passphrase, options.snapshotId);

  const entryIndex = snapshot.memory.core.findIndex((e) => e.id === memoryId);
  if (entryIndex === -1) {
    throw new Error(`Memory entry not found: ${memoryId}`);
  }

  const entry = snapshot.memory.core[entryIndex];
  const currentTier = getEffectiveTier(entry);

  const demoted = demoteMemory(entry, targetTier);
  snapshot.memory.core[entryIndex] = demoted;

  // Save updated snapshot
  await saveSnapshot(storage, passphrase, snapshot, filename);

  console.log(`✓ Demoted memory ${memoryId} from ${currentTier} to ${targetTier}`);
}

/**
 * Pin a memory (prevents automatic demotion).
 */
export async function pinMemoryCommand(
  storage: StorageBackend,
  passphrase: string,
  memoryId: string,
  options?: {
    snapshotId?: string;
  },
): Promise<void> {
  const { snapshot, filename } = await loadSnapshot(storage, passphrase, options?.snapshotId);

  const entryIndex = snapshot.memory.core.findIndex((e) => e.id === memoryId);
  if (entryIndex === -1) {
    throw new Error(`Memory entry not found: ${memoryId}`);
  }

  const entry = snapshot.memory.core[entryIndex];
  if (entry.pinned) {
    console.log(`Memory ${memoryId} is already pinned.`);
    return;
  }

  snapshot.memory.core[entryIndex] = pinMemory(entry);

  await saveSnapshot(storage, passphrase, snapshot, filename);

  console.log(`✓ Pinned memory ${memoryId}`);
}

/**
 * Unpin a memory.
 */
export async function unpinMemoryCommand(
  storage: StorageBackend,
  passphrase: string,
  memoryId: string,
  options?: {
    snapshotId?: string;
  },
): Promise<void> {
  const { snapshot, filename } = await loadSnapshot(storage, passphrase, options?.snapshotId);

  const entryIndex = snapshot.memory.core.findIndex((e) => e.id === memoryId);
  if (entryIndex === -1) {
    throw new Error(`Memory entry not found: ${memoryId}`);
  }

  const entry = snapshot.memory.core[entryIndex];
  if (!entry.pinned) {
    console.log(`Memory ${memoryId} is not pinned.`);
    return;
  }

  snapshot.memory.core[entryIndex] = unpinMemory(entry);

  await saveSnapshot(storage, passphrase, snapshot, filename);

  console.log(`✓ Unpinned memory ${memoryId}`);
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
  },
): Promise<void> {
  const { snapshot, filename } = await loadSnapshot(storage, passphrase, options?.snapshotId);
  const config = snapshot.memory.tierConfig ?? DEFAULT_TIER_CONFIG;

  const { updated, changes } = applyTierPolicies(snapshot.memory.core, config);

  if (changes.length === 0) {
    console.log('No tier changes needed based on current policies.');
    return;
  }

  console.log(`\nTier changes (${options?.dryRun ? 'dry run' : 'applying'}):\n`);
  for (const change of changes) {
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

/**
 * Show tier configuration.
 */
export async function showTierConfig(
  storage: StorageBackend,
  passphrase: string,
  options?: {
    snapshotId?: string;
  },
): Promise<void> {
  const { snapshot } = await loadSnapshot(storage, passphrase, options?.snapshotId);
  const config = snapshot.memory.tierConfig ?? DEFAULT_TIER_CONFIG;

  console.log('\nMemory Tier Configuration:\n');
  console.log(JSON.stringify(config, null, 2));
}

// ─── Helpers ─────────────────────────────────────────────────

import type { Snapshot } from '../types.js';

async function loadSnapshot(
  storage: StorageBackend,
  passphrase: string,
  snapshotId?: string,
): Promise<{ snapshot: Snapshot; filename: string }> {
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
  return { snapshot, filename };
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
