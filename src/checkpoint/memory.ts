/**
 * Knowledge Lane - Memory Management
 * 
 * Handles semantic memory objects with provenance tracking and ranked retrieval.
 */

import { randomUUID } from 'crypto';
import {
  CheckpointStorage,
  CreateMemoryInput,
  ListOptions,
  MemoryObject,
  MemoryQuery,
  MemoryResult,
  Namespace,
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
}
