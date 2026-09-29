/**
 * SaveState Memory Lifecycle Commands
 *
 * Issue #110: Memory Lifecycle Controls - mutation, correction, expiry, audit
 *
 * Commands:
 * - edit: Edit memory content/metadata with version tracking
 * - delete: Soft delete with audit trail
 * - rollback: Revert to a previous version
 * - expire: Process TTL-based expiration
 * - log: View audit/provenance history
 */

import type { StorageBackend } from '../types.js';
import { KnowledgeLane } from '../checkpoint/memory.js';
import { InMemoryCheckpointStorage } from '../checkpoint/storage/memory.js';
import type { ProvenanceEntry, Namespace } from '../checkpoint/types.js';

export interface MemoryLogEventJson {
  action: string;
  actorId: string;
  timestamp: string;
  reason: string | null;
  version: number | null;
  checkpointId: string | null;
  mergedFrom: string[];
}

export interface MemoryLogJson {
  memoryId: string;
  events: MemoryLogEventJson[];
}

function toLogEventJson(entry: ProvenanceEntry): MemoryLogEventJson {
  return {
    action: entry.action,
    actorId: entry.actor_id ?? 'unknown',
    timestamp: entry.timestamp,
    reason: entry.reason ?? null,
    version: entry.version ?? null,
    checkpointId: entry.checkpoint_id ?? null,
    mergedFrom: entry.merged_from ?? [],
  };
}

export function formatMemoryLogJson(memoryId: string, log: ProvenanceEntry[]): string {
  return JSON.stringify(
    {
      memoryId,
      events: log.map(toLogEventJson),
    },
    null,
    2,
  );
}

export interface MemoryLogMissingJson {
  found: false;
  id: string;
  events: null;
}

export function formatMemoryLogMissingJson(id: string): string {
  return JSON.stringify(
    {
      found: false,
      id,
      events: null,
    },
    null,
    2,
  );
}

const MAX_MEMORY_LOG_LIMIT = 1000;

/** Parse memory log --limit without turning user input errors into an empty audit log. */
export function parseMemoryLogLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MEMORY_LOG_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_MEMORY_LOG_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N audit events when --limit is set. */
export function selectMemoryLogEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

export interface MemoryEditJson {
  id: string;
  version: number;
  content: string;
  tags: string[];
  importance: number;
}

export function formatMemoryEditJson(memory: {
  memory_id: string;
  version: number;
  content: string;
  tags: string[];
  importance: number;
}): string {
  const record: MemoryEditJson = {
    id: memory.memory_id,
    version: memory.version,
    content: memory.content,
    tags: [...memory.tags],
    importance: memory.importance,
  };
  return JSON.stringify(record, null, 2);
}

export interface MemoryEditMissingJson {
  found: false;
  id: string;
  version: null;
}

export function formatMemoryEditMissingJson(id: string): string {
  return JSON.stringify(
    {
      found: false,
      id,
      version: null,
    },
    null,
    2,
  );
}

export interface MemoryDeleteJson {
  id: string;
  deleted: true;
  reason: string;
  actorId: string;
}

export function formatMemoryDeleteJson(id: string, reason: string, actorId: string): string {
  const record: MemoryDeleteJson = { id, deleted: true, reason, actorId };
  return JSON.stringify(record, null, 2);
}

export interface MemoryDeleteMissingJson {
  found: false;
  id: string;
  deleted: null;
}

export function formatMemoryDeleteMissingJson(id: string): string {
  return JSON.stringify(
    {
      found: false,
      id,
      deleted: null,
    },
    null,
    2,
  );
}

export interface MemoryRollbackJson {
  id: string;
  rolledBack: true;
  toVersion: number;
  version: number;
  actorId: string;
}

export function formatMemoryRollbackJson(
  id: string,
  toVersion: number,
  version: number,
  actorId: string,
): string {
  const record: MemoryRollbackJson = { id, rolledBack: true, toVersion, version, actorId };
  return JSON.stringify(record, null, 2);
}

export interface MemoryRollbackMissingJson {
  found: false;
  id: string;
  rolledBack: null;
}

export function formatMemoryRollbackMissingJson(id: string): string {
  return JSON.stringify(
    {
      found: false,
      id,
      rolledBack: null,
    },
    null,
    2,
  );
}

export interface MemoryExpireJson {
  dryRun: boolean;
  applied: boolean;
  namespace: string;
  expiredCount: number;
  expiredIds: string[];
}

export function formatMemoryExpireJson(
  namespace: string,
  expiredIds: string[],
  options?: { dryRun?: boolean },
): string {
  const dryRun = options?.dryRun ?? false;
  const record: MemoryExpireJson = {
    dryRun,
    applied: !dryRun && expiredIds.length > 0,
    namespace,
    expiredCount: expiredIds.length,
    expiredIds: [...expiredIds],
  };
  return JSON.stringify(record, null, 2);
}

export interface MemoryExpireMissingJson {
  found: false;
  namespace: string;
  applied: false;
  expiredCount: 0;
}

export function formatMemoryExpireMissingJson(namespace: string): string {
  return JSON.stringify(
    {
      found: false,
      namespace,
      applied: false,
      expiredCount: 0,
    },
    null,
    2,
  );
}

const MAX_MEMORY_EXPIRE_LIMIT = 1000;

/** Parse memory expire --limit without turning user input errors into an empty expire list. */
export function parseMemoryExpireLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MEMORY_EXPIRE_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_MEMORY_EXPIRE_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N expirable memories when --limit is set. */
export function selectExpiredMemories<T>(memories: T[], limit?: number): T[] {
  if (limit === undefined) return memories;
  return memories.slice(0, limit);
}

/**
 * Parse a namespace string into a Namespace object.
 * Format: org:app:agent[:user]
 */
function parseNamespace(ns: string): Namespace {
  const parts = ns.split(':');
  if (parts.length < 3) {
    throw new Error(
      `Invalid namespace format: "${ns}". Expected format: org:app:agent[:user]`
    );
  }
  return {
    org_id: parts[0],
    app_id: parts[1],
    agent_id: parts[2],
    user_id: parts[3],
  };
}

/**
 * Format a timestamp for display.
 */
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString();
}

/**
 * Format an action type for display.
 */
function formatAction(action: ProvenanceEntry['action']): string {
  const icons: Record<string, string> = {
    created: '+',
    accessed: '.',
    modified: '~',
    cited: '@',
    invalidated: '!',
    edited: '~',
    deleted: 'x',
    merged: 'm',
    quarantined: 'q',
    rolled_back: 'r',
    expired: 'e',
  };
  return `[${icons[action] ?? '?'}] ${action}`;
}

// Note: In a real implementation, this would use the actual storage backend
// and checkpoint system. For this implementation, we use a simplified approach
// that works directly with the KnowledgeLane service.

const MAX_MEMORY_EDIT_LIMIT = 1000;

/** Parse memory edit --limit without turning user input errors into an empty edit. */
export function parseMemoryEditLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MEMORY_EDIT_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_MEMORY_EDIT_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N edit status field rows when --limit is set. */
export function selectMemoryEditEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

/**
 * Edit a memory's content or metadata.
 */
export async function editMemoryCommand(
  _storage: StorageBackend,
  _passphrase: string,
  memoryId: string,
  options: {
    content?: string;
    tags?: string[];
    importance?: number;
    actorId: string;
    reason?: string;
    format?: 'pretty' | 'json';
    limit?: string;
  }
): Promise<void> {
  const limit = parseMemoryEditLimit(options.limit);
  // For this implementation, we'll use a simplified checkpoint storage
  // In production, this would integrate with the full storage backend
  const checkpointStorage = new InMemoryCheckpointStorage();
  const knowledgeLane = new KnowledgeLane(checkpointStorage);

  // Verify at least one update is provided
  if (!options.content && !options.tags && options.importance === undefined) {
    throw new Error('At least one of --content, --tags, or --importance must be provided');
  }

  try {
    const updated = await knowledgeLane.editMemory(
      memoryId,
      {
        content: options.content,
        tags: options.tags,
        importance: options.importance,
      },
      options.actorId,
      options.reason
    );

    if (options.format === 'json') {
      console.log(formatMemoryEditJson(updated));
      return;
    }

    const rows = [
      `\nMemory edited successfully.`,
      `  ID:      ${updated.memory_id}`,
      `  Version: ${updated.version}`,
    ];
    if (options.content) {
      rows.push(`  Content: ${updated.content.slice(0, 50)}...`);
    }
    if (options.tags) {
      rows.push(`  Tags:    ${updated.tags.join(', ')}`);
    }
    if (options.importance !== undefined) {
      rows.push(`  Importance: ${updated.importance}`);
    }
    for (const row of selectMemoryEditEntries(rows, limit)) {
      console.log(row);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (options.format === 'json' && message === `Memory ${memoryId} not found`) {
      console.log(formatMemoryEditMissingJson(memoryId));
      return;
    }
    throw new Error(`Failed to edit memory: ${message}`);
  }
}

const MAX_MEMORY_DELETE_LIMIT = 1000;

/** Parse memory delete --limit without turning user input errors into an empty delete. */
export function parseMemoryDeleteLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MEMORY_DELETE_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_MEMORY_DELETE_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N delete status field rows when --limit is set. */
export function selectMemoryDeleteEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

/**
 * Soft delete a memory with audit trail.
 */
export async function deleteMemoryCommand(
  _storage: StorageBackend,
  _passphrase: string,
  memoryId: string,
  options: {
    actorId: string;
    reason: string;
    format?: 'pretty' | 'json';
    limit?: string;
  }
): Promise<void> {
  const limit = parseMemoryDeleteLimit(options.limit);
  const checkpointStorage = new InMemoryCheckpointStorage();
  const knowledgeLane = new KnowledgeLane(checkpointStorage);

  try {
    await knowledgeLane.deleteMemory(memoryId, options.actorId, options.reason);

    if (options.format === 'json') {
      console.log(formatMemoryDeleteJson(memoryId, options.reason, options.actorId));
      return;
    }

    const rows = [
      `\nMemory deleted (soft delete).`,
      `  ID:     ${memoryId}`,
      `  Reason: ${options.reason}`,
      `  Actor:  ${options.actorId}`,
      `\nNote: The memory is marked as deleted but retained for audit purposes.`,
    ];
    for (const row of selectMemoryDeleteEntries(rows, limit)) {
      console.log(row);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (options.format === 'json' && message === `Memory ${memoryId} not found`) {
      console.log(formatMemoryDeleteMissingJson(memoryId));
      return;
    }
    throw new Error(`Failed to delete memory: ${message}`);
  }
}

const MAX_MEMORY_ROLLBACK_LIMIT = 1000;

/** Parse memory rollback --limit without turning user input errors into an empty rollback. */
export function parseMemoryRollbackLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MEMORY_ROLLBACK_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_MEMORY_ROLLBACK_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N rollback status field rows when --limit is set. */
export function selectMemoryRollbackEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

/**
 * Rollback a memory to a previous version.
 */
export async function rollbackMemoryCommand(
  _storage: StorageBackend,
  _passphrase: string,
  memoryId: string,
  options: {
    version: number;
    actorId: string;
    format?: 'pretty' | 'json';
    limit?: string;
  }
): Promise<void> {
  const limit = parseMemoryRollbackLimit(options.limit);
  const checkpointStorage = new InMemoryCheckpointStorage();
  const knowledgeLane = new KnowledgeLane(checkpointStorage);

  try {
    const restored = await knowledgeLane.rollbackMemory(
      memoryId,
      options.version,
      options.actorId
    );

    if (options.format === 'json') {
      console.log(formatMemoryRollbackJson(
        restored.memory_id,
        options.version,
        restored.version,
        options.actorId,
      ));
      return;
    }

    const rows = [
      `\nMemory rolled back successfully.`,
      `  ID:              ${restored.memory_id}`,
      `  Rolled back to:  Version ${options.version}`,
      `  New version:     ${restored.version}`,
      `  Content:         ${restored.content.slice(0, 50)}...`,
    ];
    for (const row of selectMemoryRollbackEntries(rows, limit)) {
      console.log(row);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (options.format === 'json' && message === `Memory ${memoryId} not found`) {
      console.log(formatMemoryRollbackMissingJson(memoryId));
      return;
    }
    throw new Error(`Failed to rollback memory: ${message}`);
  }
}

/**
 * Expire memories based on TTL policy.
 */
export async function expireMemoriesCommand(
  _storage: StorageBackend,
  _passphrase: string,
  options: {
    namespace: string;
    dryRun?: boolean;
    format?: 'pretty' | 'json';
    limit?: string;
  }
): Promise<void> {
  const checkpointStorage = new InMemoryCheckpointStorage();
  const knowledgeLane = new KnowledgeLane(checkpointStorage);
  const limit = parseMemoryExpireLimit(options.limit);

  const namespace = parseNamespace(options.namespace);

  if (options.format === 'json') {
    const memories = await knowledgeLane.listMemories(namespace, {
      include_expired: true,
      status: 'active',
    });
    if (memories.length === 0) {
      console.log(formatMemoryExpireMissingJson(options.namespace));
      return;
    }
  }

  if (options.dryRun) {
    // In dry-run mode, just list what would be expired
    const memories = await knowledgeLane.listMemories(namespace, {
      include_expired: true,
      status: 'active',
    });

    const now = Date.now();
    const expirableMemories = selectExpiredMemories(
      memories.filter((mem) => {
        if (mem.expires_at) {
          return new Date(mem.expires_at).getTime() <= now;
        }
        if (mem.ttl_seconds !== undefined && mem.ttl_seconds !== null) {
          if (mem.ttl_seconds === 0) return true;
          const createdAt = new Date(mem.created_at).getTime();
          const expiresAt = createdAt + mem.ttl_seconds * 1000;
          return now >= expiresAt;
        }
        return false;
      }),
      limit,
    );

    if (options.format === 'json') {
      console.log(formatMemoryExpireJson(
        options.namespace,
        expirableMemories.map((mem) => mem.memory_id),
        { dryRun: true },
      ));
      return;
    }

    console.log(`\nDry run: Would expire ${expirableMemories.length} memories:\n`);
    for (const mem of expirableMemories) {
      console.log(`  ${mem.memory_id} - ${mem.content.slice(0, 40)}...`);
    }
    return;
  }

  try {
    const result = await knowledgeLane.expireMemories(namespace);
    const expiredIds = selectExpiredMemories(result.expired_ids, limit);

    if (options.format === 'json') {
      console.log(formatMemoryExpireJson(options.namespace, expiredIds));
      return;
    }

    console.log(`\nExpiration complete.`);
    console.log(`  Namespace:      ${options.namespace}`);
    console.log(`  Expired count:  ${expiredIds.length}`);

    if (expiredIds.length > 0) {
      console.log(`\nExpired memory IDs:`);
      for (const id of expiredIds) {
        console.log(`  - ${id}`);
      }
    }
  } catch (err) {
    throw new Error(`Failed to expire memories: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Show audit/provenance history for a memory.
 */
export async function memoryLogCommand(
  _storage: StorageBackend,
  _passphrase: string,
  memoryId: string,
  options?: {
    format?: 'table' | 'json';
    limit?: string;
  }
): Promise<void> {
  const checkpointStorage = new InMemoryCheckpointStorage();
  const knowledgeLane = new KnowledgeLane(checkpointStorage);

  try {
    const log = selectMemoryLogEntries(
      await knowledgeLane.memoryAuditLog(memoryId),
      parseMemoryLogLimit(options?.limit),
    );

    if (options?.format === 'json') {
      if (log.length === 0) {
        console.log(formatMemoryLogMissingJson(memoryId));
        return;
      }
      console.log(formatMemoryLogJson(memoryId, log));
      return;
    }

    if (log.length === 0) {
      console.log(`\nNo audit log found for memory ${memoryId}`);
      console.log(`(Memory may not exist or has no recorded history)`);
      return;
    }

    // Table format
    console.log(`\nAudit Log for Memory: ${memoryId}\n`);
    console.log('Timestamp                  Action           Actor            Reason');
    console.log('-'.repeat(80));

    for (const entry of log) {
      const timestamp = formatTimestamp(entry.timestamp).padEnd(24);
      const action = formatAction(entry.action).padEnd(16);
      const actor = (entry.actor_id ?? 'unknown').slice(0, 16).padEnd(16);
      const reason = entry.reason ?? '-';

      console.log(`${timestamp} ${action} ${actor} ${reason}`);

      // Show version info if present
      if (entry.version !== undefined) {
        console.log(`                          Version: ${entry.version}`);
      }

      // Show merged IDs if present
      if (entry.merged_from && entry.merged_from.length > 0) {
        console.log(`                          Merged from: ${entry.merged_from.join(', ')}`);
      }
    }

    console.log(`\nTotal entries: ${log.length}`);
  } catch (err) {
    throw new Error(`Failed to get audit log: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}
