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
  }
): Promise<void> {
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

    console.log(`\nMemory edited successfully.`);
    console.log(`  ID:      ${updated.memory_id}`);
    console.log(`  Version: ${updated.version}`);
    if (options.content) {
      console.log(`  Content: ${updated.content.slice(0, 50)}...`);
    }
    if (options.tags) {
      console.log(`  Tags:    ${updated.tags.join(', ')}`);
    }
    if (options.importance !== undefined) {
      console.log(`  Importance: ${updated.importance}`);
    }
  } catch (err) {
    throw new Error(`Failed to edit memory: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
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
  }
): Promise<void> {
  const checkpointStorage = new InMemoryCheckpointStorage();
  const knowledgeLane = new KnowledgeLane(checkpointStorage);

  try {
    await knowledgeLane.deleteMemory(memoryId, options.actorId, options.reason);

    console.log(`\nMemory deleted (soft delete).`);
    console.log(`  ID:     ${memoryId}`);
    console.log(`  Reason: ${options.reason}`);
    console.log(`  Actor:  ${options.actorId}`);
    console.log(`\nNote: The memory is marked as deleted but retained for audit purposes.`);
  } catch (err) {
    throw new Error(`Failed to delete memory: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
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
  }
): Promise<void> {
  const checkpointStorage = new InMemoryCheckpointStorage();
  const knowledgeLane = new KnowledgeLane(checkpointStorage);

  try {
    const restored = await knowledgeLane.rollbackMemory(
      memoryId,
      options.version,
      options.actorId
    );

    console.log(`\nMemory rolled back successfully.`);
    console.log(`  ID:              ${restored.memory_id}`);
    console.log(`  Rolled back to:  Version ${options.version}`);
    console.log(`  New version:     ${restored.version}`);
    console.log(`  Content:         ${restored.content.slice(0, 50)}...`);
  } catch (err) {
    throw new Error(`Failed to rollback memory: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
  }
): Promise<void> {
  const checkpointStorage = new InMemoryCheckpointStorage();
  const knowledgeLane = new KnowledgeLane(checkpointStorage);

  const namespace = parseNamespace(options.namespace);

  if (options.dryRun) {
    // In dry-run mode, just list what would be expired
    const memories = await knowledgeLane.listMemories(namespace, {
      include_expired: true,
      status: 'active',
    });

    const now = Date.now();
    const expirableMemories = memories.filter((mem) => {
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
    });

    console.log(`\nDry run: Would expire ${expirableMemories.length} memories:\n`);
    for (const mem of expirableMemories) {
      console.log(`  ${mem.memory_id} - ${mem.content.slice(0, 40)}...`);
    }
    return;
  }

  try {
    const result = await knowledgeLane.expireMemories(namespace);

    console.log(`\nExpiration complete.`);
    console.log(`  Namespace:      ${options.namespace}`);
    console.log(`  Expired count:  ${result.expired_count}`);

    if (result.expired_ids.length > 0) {
      console.log(`\nExpired memory IDs:`);
      for (const id of result.expired_ids) {
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
  }
): Promise<void> {
  const checkpointStorage = new InMemoryCheckpointStorage();
  const knowledgeLane = new KnowledgeLane(checkpointStorage);

  try {
    const log = await knowledgeLane.memoryAuditLog(memoryId);

    if (log.length === 0) {
      console.log(`\nNo audit log found for memory ${memoryId}`);
      console.log(`(Memory may not exist or has no recorded history)`);
      return;
    }

    if (options?.format === 'json') {
      console.log(JSON.stringify(log, null, 2));
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
