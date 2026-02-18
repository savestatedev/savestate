/**
 * Knowledge Lane - Memory Management
 * 
 * Handles semantic memory objects with provenance tracking and ranked retrieval.
 */

import { randomUUID } from 'crypto';
import {
  CheckpointStorage,
  CreateMemoryInput,
  MemoryObject,
  MemoryQuery,
  MemoryResult,
  Namespace,
  ProvenanceEntry,
  DEFAULT_RANKING_WEIGHTS,
  RankingWeights,
} from './types.js';

/**
 * Calculate recency decay score (0-1).
 * Uses exponential decay with half-life of 7 days.
 * At half-life, score is 0.5; decays exponentially from there.
 */
export function calculateRecencyScore(created_at: string, last_accessed_at?: string): number {
  const now = Date.now();
  const lastTime = last_accessed_at 
    ? new Date(last_accessed_at).getTime()
    : new Date(created_at).getTime();
  
  const ageMs = now - lastTime;
  const halfLifeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  
  // Exponential decay: score = 0.5^(age/halfLife)
  // This ensures score = 0.5 at exactly one half-life
  return Math.pow(0.5, ageMs / halfLifeMs);
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
    const memory_id = randomUUID();
    const created_at = new Date().toISOString();
    
    const initialProvenance: ProvenanceEntry = {
      action: 'created',
      actor_id: input.source.identifier,
      timestamp: created_at,
      reason: `Created from ${input.source.type}`,
    };
    
    const memory: MemoryObject = {
      memory_id,
      namespace: input.namespace,
      content: input.content,
      content_type: input.content_type ?? 'text',
      source: {
        ...input.source,
        timestamp: created_at,
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
    
    await this.storage.saveMemory(memory);
    
    await this.storage.logAudit({
      namespace: input.namespace,
      action: 'create',
      resource_type: 'memory',
      resource_id: memory_id,
      actor_id: input.source.identifier,
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
