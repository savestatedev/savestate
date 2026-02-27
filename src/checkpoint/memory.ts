/**
 * Knowledge Lane - Memory Management
 * 
 * Handles semantic memory objects with provenance tracking and ranked retrieval.
 */

import { randomUUID } from 'crypto';
import {
  CheckpointStorage,
  CreateMemoryInput,
  EditMemoryInput,
  ExpireMemoriesResult,
  ListOptions,
  ListMemoryOptions,
  MemoryObject,
  MemoryQuery,
  MemoryResult,
  MemoryVersion,
  MergeMemoriesResult,
  Namespace,
  namespaceKey,
  ProvenanceEntry,
  DEFAULT_RANKING_WEIGHTS,
  RankingWeights,
} from './types.js';
import { validateMemoryEntry } from '../validation/index.js';

/**
 * Calculate recency decay score (0-1).
 * Uses exponential decay with half-life of 7 days.
 * At half-life, score is 0.5; decays exponentially from there.
 */
export function calculateRecencyScore(created_at: string, last_accessed_at?: string): number {
  const now = Date.now();

  // Primary signal: how old the memory itself is.
  // (Using last_accessed_at as the only recency signal causes "immortal" stale memories
  // that stay fresh just because they were retrieved recently.)
  const createdTime = new Date(created_at).getTime();
  if (!Number.isFinite(createdTime)) return 0;

  const ageCreatedMs = now - createdTime;

  // If timestamps are in the future (clock skew), treat as maximally recent.
  if (ageCreatedMs <= 0) return 1;

  const createdHalfLifeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  const createdScore = Math.pow(0.5, ageCreatedMs / createdHalfLifeMs);

  // Secondary signal: recent access can provide a small boost, but is capped.
  // This preserves staleness detection while still preferring recently-used items.
  if (!last_accessed_at) return Math.max(0, Math.min(1, createdScore));

  const accessedTime = new Date(last_accessed_at).getTime();
  if (!Number.isFinite(accessedTime)) return Math.max(0, Math.min(1, createdScore));

  const ageAccessMs = now - accessedTime;

  // If access timestamp is in the future, ignore it (it should not artificially inflate recency).
  if (ageAccessMs < 0) return Math.max(0, Math.min(1, createdScore));

  const accessHalfLifeMs = 3.5 * 24 * 60 * 60 * 1000; // 3.5 days (faster decay)
  const accessScore = Math.pow(0.5, ageAccessMs / accessHalfLifeMs);

  // Cap the access boost so an old memory cannot become "brand new".
  const boosted = createdScore + 0.2 * accessScore;
  return Math.max(0, Math.min(1, boosted));
}

/**
 * Calculate composite ranking score for a memory.
 */
export function calculateMemoryScore(
  memory: MemoryObject,
  semanticSimilarity: number,
  weights: RankingWeights = DEFAULT_RANKING_WEIGHTS
): { score: number; components: MemoryResult['score_components'] } {
  const recency = calculateRecencyScore(memory.created_at, memory.last_accessed_at);
  
  const components = {
    task_criticality: memory.task_criticality * weights.task_criticality,
    semantic_similarity: semanticSimilarity * weights.semantic_similarity,
    importance: memory.importance * weights.importance,
    recency: recency * weights.recency_decay,
  };
  
  const score = 
    components.task_criticality +
    components.semantic_similarity +
    components.importance +
    components.recency;
  
  return { score, components };
}

/**
 * Knowledge Lane Service
 * 
 * Manages memory objects with provenance and retrieval.
 */
export class KnowledgeLane {
  constructor(private storage: CheckpointStorage) {}

  /**
   * Store a new memory with provenance.
   */
  async storeMemory(input: CreateMemoryInput): Promise<MemoryObject> {
    const validation = validateMemoryEntry({
      content: input.content,
      sourceType: input.source.type,
      sourceId: input.source.identifier,
      declaredContentType: input.content_type,
    });

    if (!validation.accepted) {
      throw new Error(validation.rejectionReason ?? 'Memory entry rejected by validation layer');
    }

    const memory_id = randomUUID();
    const created_at = new Date().toISOString();
    const confidencePercent = Math.round(validation.confidenceScore * 100);
    const lifecycleReason = validation.quarantined
      ? `Created from ${input.source.type} and quarantined (${confidencePercent}% confidence)`
      : `Created from ${input.source.type}`;
    
    const initialProvenance: ProvenanceEntry = {
      action: 'created',
      actor_id: input.source.identifier,
      timestamp: created_at,
      reason: lifecycleReason,
    };
    
    const memory: MemoryObject = {
      memory_id,
      namespace: input.namespace,
      content: validation.normalizedContent,
      content_type: validation.normalizedContentType,
      source: {
        ...input.source,
        timestamp: created_at,
      },
      ingestion: {
        source_type: validation.sourceType,
        source_id: validation.sourceId,
        ingestion_timestamp: created_at,
        confidence_score: validation.confidenceScore,
        detected_format: validation.detectedFormat,
        anomaly_flags: validation.anomalyFlags,
        quarantined: validation.quarantined,
        validation_notes: validation.validationNotes,
      },
      provenance: [initialProvenance],
      tags: input.tags ?? [],
      importance: input.importance ?? 0.5,
      task_criticality: input.task_criticality ?? 0.5,
      embedding: input.embedding,
      created_at,
      ttl_seconds: input.ttl_seconds,
      checkpoint_refs: [],
      // Lifecycle control fields (Issue #110)
      version: 1,
      previous_versions: [],
      status: validation.quarantined ? 'quarantined' : 'active',
      // Cross-session tracking (Issue #108)
      session_id: input.session_id,
      accessed_in_sessions: [],
      cross_session_recall_count: 0,
    };

    if (validation.quarantined) {
      await this.storage.saveQuarantinedMemory(memory);
    } else {
      await this.storage.saveMemory(memory);
    }
    
    await this.storage.logAudit({
      namespace: input.namespace,
      action: 'create',
      resource_type: 'memory',
      resource_id: memory_id,
      actor_id: input.source.identifier,
      metadata: {
        quarantined: validation.quarantined,
        confidence_score: validation.confidenceScore,
        anomaly_flags: validation.anomalyFlags,
      },
    });
    
    return memory;
  }

  /**
   * Get a memory by ID.
   */
  async getMemory(memory_id: string): Promise<MemoryObject | null> {
    return this.storage.getMemory(memory_id);
  }

  /**
   * List quarantined memories (excluded from normal retrieval/search).
   */
  async listQuarantinedMemories(
    namespace: Namespace,
    options?: ListOptions
  ): Promise<MemoryObject[]> {
    return this.storage.listQuarantinedMemories(namespace, options);
  }

  /**
   * Promote a quarantined memory into primary retrieval storage.
   */
  async promoteQuarantinedMemory(memory_id: string, actor_id: string): Promise<MemoryObject> {
    const memory = await this.storage.getQuarantinedMemory(memory_id);
    if (!memory) {
      throw new Error(`Quarantined memory ${memory_id} not found`);
    }

    const promotedAt = new Date().toISOString();
    memory.ingestion.quarantined = false;
    memory.provenance.push({
      action: 'modified',
      actor_id,
      timestamp: promotedAt,
      reason: 'Promoted from quarantine',
    });

    await this.storage.saveMemory(memory);
    await this.storage.deleteQuarantinedMemory(memory_id);

    await this.storage.logAudit({
      namespace: memory.namespace,
      action: 'update',
      resource_type: 'memory',
      resource_id: memory_id,
      actor_id,
      metadata: {
        promoted_from_quarantine: true,
        confidence_score: memory.ingestion.confidence_score,
      },
    });

    return memory;
  }

  /**
   * Search memories with ranked retrieval.
   */
  async searchMemories(query: MemoryQuery): Promise<MemoryResult[]> {
    const results = await this.storage.searchMemories(query);
    
    // Log search access
    await this.storage.logAudit({
      namespace: query.namespace,
      action: 'search',
      resource_type: 'memory',
      resource_id: `query:${query.query ?? 'tags'}`,
      actor_id: 'system',
      metadata: {
        query: query.query,
        tags: query.tags,
        result_count: results.length,
      },
    });
    
    return results;
  }

  /**
   * Record memory access from a checkpoint.
   * Updates last_accessed_at and adds provenance entry.
   */
  async recordAccess(
    memory_id: string,
    checkpoint_id: string,
    actor_id: string
  ): Promise<void> {
    await this.storage.updateMemoryAccess(memory_id, checkpoint_id);
    
    // Note: A full implementation would also add a provenance entry
    // This is handled by the storage layer for efficiency
  }

  /**
   * Get memories by IDs.
   * Used when restoring from a checkpoint with memory_refs.
   */
  async getMemoriesByIds(memory_ids: string[]): Promise<MemoryObject[]> {
    const memories: MemoryObject[] = [];
    
    for (const id of memory_ids) {
      const memory = await this.storage.getMemory(id);
      if (memory) {
        memories.push(memory);
      }
    }
    
    return memories;
  }

  /**
   * Link a memory to a checkpoint.
   * Used when creating checkpoints with memory references.
   */
  async linkToCheckpoint(
    memory_id: string,
    checkpoint_id: string,
    actor_id: string
  ): Promise<void> {
    const memory = await this.storage.getMemory(memory_id);
    if (!memory) {
      throw new Error(`Memory ${memory_id} not found`);
    }
    
    // Add checkpoint ref and provenance
    memory.checkpoint_refs.push(checkpoint_id);
    memory.provenance.push({
      action: 'cited',
      actor_id,
      checkpoint_id,
      timestamp: new Date().toISOString(),
      reason: 'Referenced in checkpoint',
    });
    
    await this.storage.saveMemory(memory);
  }

  /**
   * Invalidate a memory (soft delete with reason).
   */
  async invalidateMemory(
    memory_id: string,
    actor_id: string,
    reason: string
  ): Promise<void> {
    const memory = await this.storage.getMemory(memory_id);
    if (!memory) {
      throw new Error(`Memory ${memory_id} not found`);
    }

    memory.provenance.push({
      action: 'invalidated',
      actor_id,
      timestamp: new Date().toISOString(),
      reason,
    });

    // Set TTL to 0 to mark as expired
    memory.ttl_seconds = 0;

    await this.storage.saveMemory(memory);
  }

  /**
   * Search memories with detailed explanations of why each was retrieved.
   * This is a convenience wrapper around searchMemories with explain=true.
   *
   * @see https://github.com/savestatedev/savestate/issues/115
   */
  async explainRetrieval(query: Omit<MemoryQuery, 'explain'>): Promise<MemoryResult[]> {
    const results = await this.storage.searchMemories({
      ...query,
      explain: true,
    });

    // Log explain access
    await this.storage.logAudit({
      namespace: query.namespace,
      action: 'search',
      resource_type: 'memory',
      resource_id: `explain:${query.query ?? 'tags'}`,
      actor_id: 'system',
      metadata: {
        query: query.query,
        tags: query.tags,
        result_count: results.length,
        explain: true,
      },
    });

    return results;
  }

  // ─── Lifecycle Controls (Issue #110) ───────────────────────

  /**
   * Edit a memory's content or metadata.
   * Creates a version snapshot for rollback support.
   */
  async editMemory(
    memory_id: string,
    updates: EditMemoryInput,
    actor_id: string,
    reason?: string
  ): Promise<MemoryObject> {
    const memory = await this.storage.getMemory(memory_id);
    if (!memory) {
      throw new Error(`Memory ${memory_id} not found`);
    }

    if (memory.status === 'deleted') {
      throw new Error(`Cannot edit deleted memory ${memory_id}`);
    }

    const editedAt = new Date().toISOString();

    // Create version snapshot of current state
    const versionSnapshot: MemoryVersion = {
      version: memory.version,
      content: memory.content,
      content_type: memory.content_type,
      tags: [...memory.tags],
      importance: memory.importance,
      task_criticality: memory.task_criticality,
      superseded_at: editedAt,
      superseded_by: actor_id,
      change_reason: reason,
    };

    // Initialize previous_versions if needed
    if (!memory.previous_versions) {
      memory.previous_versions = [];
    }
    memory.previous_versions.push(versionSnapshot);

    // Apply updates
    const previousContent = memory.content;
    if (updates.content !== undefined) {
      memory.content = updates.content;
    }
    if (updates.content_type !== undefined) {
      memory.content_type = updates.content_type;
    }
    if (updates.tags !== undefined) {
      memory.tags = updates.tags;
    }
    if (updates.importance !== undefined) {
      memory.importance = updates.importance;
    }
    if (updates.task_criticality !== undefined) {
      memory.task_criticality = updates.task_criticality;
    }
    if (updates.embedding !== undefined) {
      memory.embedding = updates.embedding;
    }

    // Increment version
    memory.version += 1;

    // Add provenance entry
    memory.provenance.push({
      action: 'edited',
      actor_id,
      timestamp: editedAt,
      reason: reason ?? 'Memory edited',
      version: memory.version,
      previous_content: previousContent,
    });

    await this.storage.updateMemory(memory);

    await this.storage.logAudit({
      namespace: memory.namespace,
      action: 'update',
      resource_type: 'memory',
      resource_id: memory_id,
      actor_id,
      metadata: {
        action_type: 'edit',
        new_version: memory.version,
        reason,
      },
    });

    return memory;
  }

  /**
   * Soft delete a memory with audit trail.
   */
  async deleteMemory(
    memory_id: string,
    actor_id: string,
    reason: string
  ): Promise<void> {
    const memory = await this.storage.getMemory(memory_id);
    if (!memory) {
      throw new Error(`Memory ${memory_id} not found`);
    }

    if (memory.status === 'deleted') {
      throw new Error(`Memory ${memory_id} is already deleted`);
    }

    const deletedAt = new Date().toISOString();

    // Mark as deleted (soft delete)
    memory.status = 'deleted';

    // Add provenance entry
    memory.provenance.push({
      action: 'deleted',
      actor_id,
      timestamp: deletedAt,
      reason,
    });

    await this.storage.updateMemory(memory);

    await this.storage.logAudit({
      namespace: memory.namespace,
      action: 'delete',
      resource_type: 'memory',
      resource_id: memory_id,
      actor_id,
      metadata: {
        reason,
        soft_delete: true,
      },
    });
  }

  /**
   * Merge multiple memories into one.
   * Original memories are soft-deleted.
   */
  async mergeMemories(
    memory_ids: string[],
    merged_content: string,
    actor_id: string,
    options?: {
      tags?: string[];
      importance?: number;
      task_criticality?: number;
    }
  ): Promise<MergeMemoriesResult> {
    if (memory_ids.length < 2) {
      throw new Error('At least 2 memories are required for merging');
    }

    // Fetch all memories
    const memories: MemoryObject[] = [];
    for (const id of memory_ids) {
      const mem = await this.storage.getMemory(id);
      if (!mem) {
        throw new Error(`Memory ${id} not found`);
      }
      if (mem.status === 'deleted') {
        throw new Error(`Cannot merge deleted memory ${id}`);
      }
      memories.push(mem);
    }

    // Verify all memories are in the same namespace
    const namespace = memories[0].namespace;
    for (const mem of memories) {
      if (JSON.stringify(mem.namespace) !== JSON.stringify(namespace)) {
        throw new Error('All memories must be in the same namespace to merge');
      }
    }

    const mergedAt = new Date().toISOString();

    // Combine tags from all memories (unique)
    const allTags = new Set<string>();
    for (const mem of memories) {
      for (const tag of mem.tags) {
        allTags.add(tag);
      }
    }
    const combinedTags = options?.tags ?? Array.from(allTags);

    // Calculate combined importance (average by default)
    const avgImportance = memories.reduce((sum, m) => sum + m.importance, 0) / memories.length;
    const avgCriticality = memories.reduce((sum, m) => sum + m.task_criticality, 0) / memories.length;

    // Create new merged memory
    const merged = await this.storeMemory({
      namespace,
      content: merged_content,
      content_type: 'text',
      source: {
        type: 'system',
        identifier: actor_id,
        metadata: {
          merged_from: memory_ids,
          merge_timestamp: mergedAt,
        },
      },
      tags: combinedTags,
      importance: options?.importance ?? avgImportance,
      task_criticality: options?.task_criticality ?? avgCriticality,
    });

    // Add merge provenance to the new memory
    merged.provenance.push({
      action: 'merged',
      actor_id,
      timestamp: mergedAt,
      reason: `Merged from ${memory_ids.length} memories`,
      merged_from: memory_ids,
    });
    await this.storage.updateMemory(merged);

    // Soft-delete original memories
    for (const mem of memories) {
      mem.status = 'deleted';
      mem.provenance.push({
        action: 'deleted',
        actor_id,
        timestamp: mergedAt,
        reason: `Merged into ${merged.memory_id}`,
      });
      await this.storage.updateMemory(mem);
    }

    await this.storage.logAudit({
      namespace,
      action: 'update',
      resource_type: 'memory',
      resource_id: merged.memory_id,
      actor_id,
      metadata: {
        action_type: 'merge',
        merged_ids: memory_ids,
      },
    });

    return {
      merged_memory: merged,
      merged_ids: memory_ids,
    };
  }

  /**
   * Quarantine a memory (move out of normal retrieval).
   */
  async quarantineMemory(
    memory_id: string,
    actor_id: string,
    reason: string
  ): Promise<MemoryObject> {
    // Check both primary and quarantine stores
    let memory = await this.storage.getMemory(memory_id);
    if (!memory) {
      // Check if already in quarantine store
      const quarantined = await this.storage.getQuarantinedMemory(memory_id);
      if (quarantined) {
        throw new Error(`Memory ${memory_id} is already quarantined`);
      }
      throw new Error(`Memory ${memory_id} not found`);
    }

    if (memory.status === 'quarantined') {
      throw new Error(`Memory ${memory_id} is already quarantined`);
    }

    if (memory.status === 'deleted') {
      throw new Error(`Cannot quarantine deleted memory ${memory_id}`);
    }

    const quarantinedAt = new Date().toISOString();

    memory.status = 'quarantined';
    memory.ingestion.quarantined = true;

    memory.provenance.push({
      action: 'quarantined',
      actor_id,
      timestamp: quarantinedAt,
      reason,
    });

    await this.storage.updateMemory(memory);

    await this.storage.logAudit({
      namespace: memory.namespace,
      action: 'update',
      resource_type: 'memory',
      resource_id: memory_id,
      actor_id,
      metadata: {
        action_type: 'quarantine',
        reason,
      },
    });

    return memory;
  }

  /**
   * Rollback a memory to a previous version.
   */
  async rollbackMemory(
    memory_id: string,
    target_version: number,
    actor_id: string
  ): Promise<MemoryObject> {
    const memory = await this.storage.getMemory(memory_id);
    if (!memory) {
      throw new Error(`Memory ${memory_id} not found`);
    }

    if (memory.status === 'deleted') {
      throw new Error(`Cannot rollback deleted memory ${memory_id}`);
    }

    if (!memory.previous_versions || memory.previous_versions.length === 0) {
      throw new Error(`Memory ${memory_id} has no previous versions to rollback to`);
    }

    // Find the target version
    const targetSnapshot = memory.previous_versions.find(v => v.version === target_version);
    if (!targetSnapshot) {
      const availableVersions = memory.previous_versions.map(v => v.version).join(', ');
      throw new Error(
        `Version ${target_version} not found. Available versions: ${availableVersions}`
      );
    }

    const rolledBackAt = new Date().toISOString();

    // Save current state before rollback
    const currentSnapshot: MemoryVersion = {
      version: memory.version,
      content: memory.content,
      content_type: memory.content_type,
      tags: [...memory.tags],
      importance: memory.importance,
      task_criticality: memory.task_criticality,
      superseded_at: rolledBackAt,
      superseded_by: actor_id,
      change_reason: `Rolled back to version ${target_version}`,
    };
    memory.previous_versions.push(currentSnapshot);

    // Restore from target version
    const previousContent = memory.content;
    memory.content = targetSnapshot.content;
    memory.content_type = targetSnapshot.content_type;
    memory.tags = [...targetSnapshot.tags];
    memory.importance = targetSnapshot.importance;
    memory.task_criticality = targetSnapshot.task_criticality;
    memory.version += 1;

    memory.provenance.push({
      action: 'rolled_back',
      actor_id,
      timestamp: rolledBackAt,
      reason: `Rolled back to version ${target_version}`,
      version: memory.version,
      previous_content: previousContent,
    });

    await this.storage.updateMemory(memory);

    await this.storage.logAudit({
      namespace: memory.namespace,
      action: 'update',
      resource_type: 'memory',
      resource_id: memory_id,
      actor_id,
      metadata: {
        action_type: 'rollback',
        target_version,
        new_version: memory.version,
      },
    });

    return memory;
  }

  /**
   * Expire memories based on TTL policy.
   */
  async expireMemories(namespace: Namespace): Promise<ExpireMemoriesResult> {
    const now = new Date();
    const nowIso = now.toISOString();
    const expiredIds: string[] = [];

    // Get all memories including those with expires_at
    const memories = await this.storage.listMemories(namespace, {
      include_expired: true,
      status: 'active',
    });

    for (const memory of memories) {
      let shouldExpire = false;

      // Check expires_at timestamp
      if (memory.expires_at) {
        if (new Date(memory.expires_at).getTime() <= now.getTime()) {
          shouldExpire = true;
        }
      }

      // Check ttl_seconds
      if (memory.ttl_seconds !== undefined && memory.ttl_seconds !== null) {
        if (memory.ttl_seconds === 0) {
          shouldExpire = true;
        } else {
          const createdAt = new Date(memory.created_at).getTime();
          const expiresAt = createdAt + memory.ttl_seconds * 1000;
          if (now.getTime() >= expiresAt) {
            shouldExpire = true;
          }
        }
      }

      if (shouldExpire && memory.status !== 'deleted') {
        memory.status = 'deleted';
        memory.provenance.push({
          action: 'expired',
          actor_id: 'system',
          timestamp: nowIso,
          reason: 'TTL expired',
        });
        await this.storage.updateMemory(memory);
        expiredIds.push(memory.memory_id);
      }
    }

    if (expiredIds.length > 0) {
      await this.storage.logAudit({
        namespace,
        action: 'delete',
        resource_type: 'memory',
        resource_id: `batch:${expiredIds.length}`,
        actor_id: 'system',
        metadata: {
          action_type: 'expire',
          expired_count: expiredIds.length,
          expired_ids: expiredIds,
        },
      });
    }

    return {
      expired_count: expiredIds.length,
      expired_ids: expiredIds,
    };
  }

  /**
   * Get the complete audit/provenance log for a memory.
   */
  async memoryAuditLog(memory_id: string): Promise<ProvenanceEntry[]> {
    return this.storage.getMemoryAuditLog(memory_id);
  }

  /**
   * List memories in a namespace with optional filters.
   */
  async listMemories(
    namespace: Namespace,
    options?: ListMemoryOptions
  ): Promise<MemoryObject[]> {
    return this.storage.listMemories(namespace, options);
  }

  // ─── Cross-Session Tracking (Issue #108) ────────────────────

  /**
   * Get session history for a namespace.
   * Returns all sessions and their associated memories.
   */
  async sessionHistory(namespace: Namespace): Promise<SessionHistoryEntry[]> {
    const memories = await this.storage.listMemories(namespace, { status: 'active' });

    // Group memories by session
    const sessionMap = new Map<string, SessionHistoryEntry>();

    for (const memory of memories) {
      const sessionId = memory.session_id ?? 'default';

      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, {
          session_id: sessionId,
          namespace_key: namespaceKey(namespace),
          started_at: memory.created_at,
          memory_ids: [],
          memory_count: 0,
          cross_session_recalls: 0,
        });
      }

      const entry = sessionMap.get(sessionId)!;
      entry.memory_ids.push(memory.memory_id);
      entry.memory_count++;
      entry.cross_session_recalls += memory.cross_session_recall_count ?? 0;

      // Update started_at to earliest memory
      if (memory.created_at < entry.started_at) {
        entry.started_at = memory.created_at;
      }
    }

    // Sort sessions by start time (newest first)
    const sessions = Array.from(sessionMap.values());
    sessions.sort((a, b) =>
      new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    );

    return sessions;
  }

  /**
   * Get memories for a specific session.
   */
  async getSessionMemories(
    namespace: Namespace,
    sessionId: string
  ): Promise<MemoryObject[]> {
    const memories = await this.storage.listMemories(namespace, { status: 'active' });
    return memories.filter(m => m.session_id === sessionId);
  }

  // ─── Drift Detection (Issue #108) ───────────────────────────

  /**
   * Calculate drift score for a session.
   * Higher scores indicate less coherence/more topic changes.
   */
  async driftScore(
    namespace: Namespace,
    sessionId: string,
    thresholds?: DriftThresholds
  ): Promise<DriftMetrics> {
    const memories = await this.getSessionMemories(namespace, sessionId);
    return calculateDriftMetrics(memories, thresholds);
  }

  /**
   * Check if session drift exceeds thresholds.
   */
  async checkDrift(
    namespace: Namespace,
    sessionId: string,
    thresholds?: DriftThresholds
  ): Promise<{ alert: boolean; metrics: DriftMetrics }> {
    const metrics = await this.driftScore(namespace, sessionId, thresholds);
    return {
      alert: metrics.drift_detected,
      metrics,
    };
  }
}

// ─── Session History Types (Issue #108) ──────────────────────

/**
 * Session history entry for cross-session tracking.
 */
export interface SessionHistoryEntry {
  session_id: string;
  namespace_key: string;
  started_at: string;
  ended_at?: string;
  memory_ids: string[];
  memory_count: number;
  parent_session_id?: string;
  cross_session_recalls: number;
}

// ─── Drift Detection Types (Issue #108) ──────────────────────

/**
 * Drift thresholds for alerting.
 */
export interface DriftThresholds {
  max_drift_score: number;
  min_coherence_score: number;
  max_fragmentation_score: number;
}

export const DEFAULT_DRIFT_THRESHOLDS: DriftThresholds = {
  max_drift_score: 0.4,
  min_coherence_score: 0.6,
  max_fragmentation_score: 0.3,
};

/**
 * Drift metrics for a session.
 */
export interface DriftMetrics {
  drift_score: number;
  drift_detected: boolean;
  topic_changes: number;
  coherence_score: number;
  fragmentation_score: number;
  last_checked_at: string;
}

/**
 * Calculate drift metrics for a set of memories.
 */
export function calculateDriftMetrics(
  memories: MemoryObject[],
  thresholds: DriftThresholds = DEFAULT_DRIFT_THRESHOLDS,
): DriftMetrics {
  if (memories.length === 0) {
    return {
      drift_score: 0,
      drift_detected: false,
      topic_changes: 0,
      coherence_score: 1,
      fragmentation_score: 0,
      last_checked_at: new Date().toISOString(),
    };
  }

  // Sort memories by creation time
  const sorted = [...memories].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  // Calculate topic changes based on tag differences
  let topicChanges = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prevTags = new Set(sorted[i - 1].tags);
    const currTags = new Set(sorted[i].tags);
    const intersection = [...currTags].filter((t) => prevTags.has(t));
    const union = new Set([...prevTags, ...currTags]);

    // Jaccard distance - if tags are very different, count as topic change
    const similarity = union.size > 0 ? intersection.length / union.size : 1;
    if (similarity < 0.3) {
      topicChanges++;
    }
  }

  // Calculate fragmentation (memories with no shared tags)
  let isolatedCount = 0;
  for (const mem of memories) {
    const hasSharedTags = memories.some(
      (other) =>
        other.memory_id !== mem.memory_id &&
        other.tags.some((t) => mem.tags.includes(t)),
    );
    if (!hasSharedTags && mem.tags.length > 0) {
      isolatedCount++;
    }
  }
  const fragmentationScore = memories.length > 1 ? isolatedCount / memories.length : 0;

  // Calculate coherence based on tag overlap across all memories
  const allTags = new Map<string, number>();
  for (const mem of memories) {
    for (const tag of mem.tags) {
      allTags.set(tag, (allTags.get(tag) ?? 0) + 1);
    }
  }
  const avgTagFrequency =
    allTags.size > 0
      ? Array.from(allTags.values()).reduce((a, b) => a + b, 0) / allTags.size / memories.length
      : 0;
  const coherenceScore = Math.min(1, avgTagFrequency * 2);

  // Compute drift score
  const topicChangeRate = sorted.length > 1 ? topicChanges / (sorted.length - 1) : 0;
  const driftScore = Math.min(
    1,
    topicChangeRate * 0.4 + fragmentationScore * 0.3 + (1 - coherenceScore) * 0.3,
  );

  const driftDetected =
    driftScore > thresholds.max_drift_score ||
    coherenceScore < thresholds.min_coherence_score ||
    fragmentationScore > thresholds.max_fragmentation_score;

  return {
    drift_score: driftScore,
    drift_detected: driftDetected,
    topic_changes: topicChanges,
    coherence_score: coherenceScore,
    fragmentation_score: fragmentationScore,
    last_checked_at: new Date().toISOString(),
  };
}
