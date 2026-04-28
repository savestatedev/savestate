/**
 * Signal Fitness League - Memory Registry
 * Issue #71: Snippet registry + metadata schema
 *
 * Manages the collection of memory units with their metadata,
 * fitness scores, and lifecycle status.
 */

import { randomUUID } from 'crypto';
import {
  MemoryUnit,
  MemorySource,
  IntentTag,
  CriticalityClass,
  FitnessScore,
  PromotionStatus,
  RegistryStats,
  RarityAnalysis,
} from './types.js';

/**
 * Registry entry with full lifecycle tracking
 */
export interface RegistryEntry {
  memory: MemoryUnit;
  status: PromotionStatus;
  fitness_score?: FitnessScore;
  consecutive_failures: number;
  consecutive_successes: number;
  last_policy_decision_at?: string;
}

/**
 * Options for registering a new memory
 */
export interface RegisterOptions {
  content: string;
  source: MemorySource;
  topic: string;
  intent_tags: IntentTag[];
  criticality?: CriticalityClass;
  owner_id?: string;
  token_cost?: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

/**
 * Query options for finding memories
 */
export interface QueryOptions {
  status?: PromotionStatus[];
  source?: MemorySource[];
  topic?: string;
  intent_tags?: IntentTag[];
  criticality?: CriticalityClass[];
  min_fitness?: number;
  max_fitness?: number;
  limit?: number;
  offset?: number;
  sort_by?: 'fitness' | 'created_at' | 'last_accessed_at' | 'access_count';
  sort_order?: 'asc' | 'desc';
}

/**
 * Memory Registry - In-memory storage for memory units
 * In production, this would be backed by a database
 */
export class MemoryRegistry {
  private entries: Map<string, RegistryEntry> = new Map();
  private topicIndex: Map<string, Set<string>> = new Map();
  private statusIndex: Map<PromotionStatus, Set<string>> = new Map();
  private protectedIds: Set<string> = new Set();

  constructor(protectedIds: string[] = []) {
    this.protectedIds = new Set(protectedIds);
    
    // Initialize status index
    const statuses: PromotionStatus[] = ['active', 'promoted', 'demoted', 'archived', 'protected'];
    for (const status of statuses) {
      this.statusIndex.set(status, new Set());
    }
  }

  /**
   * Register a new memory unit
   */
  register(options: RegisterOptions): MemoryUnit {
    const id = randomUUID();
    const now = new Date().toISOString();
    
    const memory: MemoryUnit = {
      id,
      content: options.content,
      source: options.source,
      topic: options.topic,
      intent_tags: options.intent_tags,
      criticality: options.criticality ?? 'normal',
      owner_id: options.owner_id,
      token_cost: options.token_cost ?? this.estimateTokenCost(options.content),
      created_at: now,
      updated_at: now,
      access_count: 0,
      embedding: options.embedding,
      metadata: options.metadata,
    };

    // Determine initial status based on criticality
    const isProtectedCriticality = 
      memory.criticality === 'compliance' || 
      memory.criticality === 'protected';
    const status: PromotionStatus = isProtectedCriticality || this.protectedIds.has(id) 
      ? 'protected' 
      : 'active';
    
    const entry: RegistryEntry = {
      memory,
      status,
      consecutive_failures: 0,
      consecutive_successes: 0,
    };

    this.entries.set(id, entry);
    this.indexEntry(entry);
    
    return memory;
  }

  /**
   * Get a memory by ID
   */
  get(id: string): RegistryEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Get memory content and record access
   */
  access(id: string): MemoryUnit | undefined {
    const entry = this.entries.get(id);
    if (!entry) return undefined;
    
    entry.memory.access_count++;
    entry.memory.last_accessed_at = new Date().toISOString();
    
    return entry.memory;
  }

  /**
   * Update memory content
   */
  update(id: string, content: string, embedding?: number[]): MemoryUnit | undefined {
    const entry = this.entries.get(id);
    if (!entry) return undefined;
    
    entry.memory.content = content;
    entry.memory.token_cost = this.estimateTokenCost(content);
    entry.memory.updated_at = new Date().toISOString();
    
    if (embedding) {
      entry.memory.embedding = embedding;
    }
    
    return entry.memory;
  }

  /**
   * Update fitness score for a memory
   */
  updateFitnessScore(id: string, score: FitnessScore): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    
    entry.fitness_score = score;
  }

  /**
   * Update promotion status
   */
  updateStatus(id: string, status: PromotionStatus): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    
    // Cannot demote protected memories
    if (entry.status === 'protected' && status !== 'protected') {
      return;
    }
    
    // Update indices
    this.statusIndex.get(entry.status)?.delete(id);
    this.statusIndex.get(status)?.add(id);
    
    entry.status = status;
    entry.last_policy_decision_at = new Date().toISOString();
  }

  /**
   * Record a successful evaluation (memory helped)
   */
  recordSuccess(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    
    entry.consecutive_successes++;
    entry.consecutive_failures = 0;
  }

  /**
   * Record a failed evaluation (memory didn't help or hurt)
   */
  recordFailure(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    
    entry.consecutive_failures++;
    entry.consecutive_successes = 0;
  }

  /**
   * Query memories with filters
   */
  query(options: QueryOptions = {}): RegistryEntry[] {
    let results = Array.from(this.entries.values());
    
    // Filter by status
    if (options.status?.length) {
      results = results.filter(e => options.status!.includes(e.status));
    }
    
    // Filter by source
    if (options.source?.length) {
      results = results.filter(e => options.source!.includes(e.memory.source));
    }
    
    // Filter by topic
    if (options.topic) {
      results = results.filter(e => e.memory.topic === options.topic);
    }
    
    // Filter by intent tags
    if (options.intent_tags?.length) {
      results = results.filter(e => 
        options.intent_tags!.some(tag => e.memory.intent_tags.includes(tag))
      );
    }
    
    // Filter by criticality
    if (options.criticality?.length) {
      results = results.filter(e => options.criticality!.includes(e.memory.criticality));
    }
    
    // Filter by fitness range
    if (options.min_fitness !== undefined) {
      results = results.filter(e => (e.fitness_score?.fitness ?? 0) >= options.min_fitness!);
    }
    if (options.max_fitness !== undefined) {
      results = results.filter(e => (e.fitness_score?.fitness ?? 1) <= options.max_fitness!);
    }
    
    // Sort
    const sortBy = options.sort_by ?? 'created_at';
    const sortOrder = options.sort_order ?? 'desc';
    
    results.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;
      
      switch (sortBy) {
        case 'fitness':
          aVal = a.fitness_score?.fitness ?? 0;
          bVal = b.fitness_score?.fitness ?? 0;
          break;
        case 'last_accessed_at':
          aVal = a.memory.last_accessed_at ?? a.memory.created_at;
          bVal = b.memory.last_accessed_at ?? b.memory.created_at;
          break;
        case 'access_count':
          aVal = a.memory.access_count;
          bVal = b.memory.access_count;
          break;
        default:
          aVal = a.memory.created_at;
          bVal = b.memory.created_at;
      }
      
      if (typeof aVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }
      
      return sortOrder === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal;
    });
    
    // Pagination
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;
    
    return results.slice(offset, offset + limit);
  }

  /**
   * Get memories by status
   */
  getByStatus(status: PromotionStatus): RegistryEntry[] {
    const ids = this.statusIndex.get(status) ?? new Set();
    return Array.from(ids)
      .map(id => this.entries.get(id))
      .filter((e): e is RegistryEntry => e !== undefined);
  }

  /**
   * Get memories by topic
   */
  getByTopic(topic: string): RegistryEntry[] {
    const ids = this.topicIndex.get(topic) ?? new Set();
    return Array.from(ids)
      .map(id => this.entries.get(id))
      .filter((e): e is RegistryEntry => e !== undefined);
  }

  /**
   * Get active memories (for context selection)
   */
  getActiveMemories(): MemoryUnit[] {
    const activeStatuses: PromotionStatus[] = ['active', 'promoted', 'protected'];
    const active: MemoryUnit[] = [];
    
    for (const status of activeStatuses) {
      for (const id of this.statusIndex.get(status) ?? []) {
        const entry = this.entries.get(id);
        if (entry) {
          active.push(entry.memory);
        }
      }
    }
    
    return active;
  }

  /**
   * Get memories at risk of demotion
   */
  getAtRisk(consecutiveFailureThreshold: number): RegistryEntry[] {
    return Array.from(this.entries.values())
      .filter(e => 
        e.status !== 'protected' && 
        e.consecutive_failures >= consecutiveFailureThreshold - 1
      )
      .sort((a, b) => b.consecutive_failures - a.consecutive_failures);
  }

  /**
   * Delete a memory
   */
  delete(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    
    // Cannot delete protected memories
    if (this.isProtected(id)) {
      return false;
    }
    
    this.removeFromIndices(entry);
    return this.entries.delete(id);
  }

  /**
   * Archive a memory (soft delete)
   */
  archive(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    
    // Cannot archive protected memories
    if (this.isProtected(id)) {
      return false;
    }
    
    this.updateStatus(id, 'archived');
    return true;
  }

  /**
   * Add memory to protected set
   */
  protect(id: string): void {
    this.protectedIds.add(id);
    this.updateStatus(id, 'protected');
  }

  /**
   * Remove memory from protected set
   */
  unprotect(id: string): void {
    this.protectedIds.delete(id);
    const entry = this.entries.get(id);
    if (entry && entry.status === 'protected') {
      this.updateStatus(id, 'active');
    }
  }

  /**
   * Check if a memory is protected
   */
  isProtected(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return this.protectedIds.has(id);
    
    return this.protectedIds.has(id) || 
      entry.memory.criticality === 'compliance' ||
      entry.memory.criticality === 'protected' ||
      entry.status === 'protected';
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const entries = Array.from(this.entries.values());
    const active = entries.filter(e => ['active', 'promoted'].includes(e.status));
    const archived = entries.filter(e => e.status === 'archived');
    const protected_ = entries.filter(e => e.status === 'protected');
    
    const fitnessScores = entries
      .filter(e => e.fitness_score)
      .map(e => e.fitness_score!.fitness);
    
    const avgFitness = fitnessScores.length > 0
      ? fitnessScores.reduce((a, b) => a + b, 0) / fitnessScores.length
      : 0;
    
    const activeTokens = active.reduce((sum, e) => sum + e.memory.token_cost, 0);
    const totalTokens = entries.reduce((sum, e) => sum + e.memory.token_cost, 0);
    
    // Get today's evaluations (simplified - in production, track in DB)
    const today = new Date().toISOString().split('T')[0];
    const evaluationsToday = entries
      .filter(e => e.fitness_score?.last_evaluated_at?.startsWith(today))
      .length;
    
    const promotionsToday = entries
      .filter(e => e.last_policy_decision_at?.startsWith(today) && e.status === 'promoted')
      .length;
    
    const demotionsToday = entries
      .filter(e => e.last_policy_decision_at?.startsWith(today) && e.status === 'demoted')
      .length;
    
    return {
      total_memories: entries.length,
      active_memories: active.length,
      archived_memories: archived.length,
      protected_memories: protected_.length,
      total_tokens: totalTokens,
      active_tokens: activeTokens,
      avg_fitness: avgFitness,
      evaluations_today: evaluationsToday,
      promotions_today: promotionsToday,
      demotions_today: demotionsToday,
    };
  }

  /**
   * Analyze rarity of a memory
   */
  analyzeRarity(id: string): RarityAnalysis | undefined {
    const entry = this.entries.get(id);
    if (!entry) return undefined;
    
    const memory = entry.memory;
    
    // Calculate nearest neighbor distance
    let nearestDistance = Infinity;
    let totalDistance = 0;
    let neighborCount = 0;
    
    if (memory.embedding) {
      for (const other of this.entries.values()) {
        if (other.memory.id === id || !other.memory.embedding) continue;
        
        const distance = this.cosineSimilarity(memory.embedding, other.memory.embedding);
        const dissimilarity = 1 - distance;
        
        nearestDistance = Math.min(nearestDistance, dissimilarity);
        totalDistance += dissimilarity;
        neighborCount++;
      }
    }
    
    const avgDistance = neighborCount > 0 ? totalDistance / neighborCount : 1;
    nearestDistance = nearestDistance === Infinity ? 1 : nearestDistance;
    
    // Calculate topic frequency
    const topicMemories = this.topicIndex.get(memory.topic)?.size ?? 1;
    const totalMemories = this.entries.size || 1;
    const topicFrequency = topicMemories / totalMemories;
    
    // Rarity is inversely proportional to frequency
    const topicImportance = 1 - topicFrequency;
    
    // Combine semantic uniqueness and topic rarity
    const semanticUniqueness = (nearestDistance + avgDistance) / 2;
    const rarityScore = 0.6 * semanticUniqueness + 0.4 * topicImportance;
    
    return {
      memory_id: id,
      nearest_neighbor_distance: nearestDistance,
      avg_cluster_distance: avgDistance,
      topic: memory.topic,
      topic_frequency: topicFrequency,
      topic_importance: topicImportance,
      rarity_score: Math.min(1, Math.max(0, rarityScore)),
    };
  }

  /**
   * Export registry to JSON
   */
  export(): RegistryEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Import registry from JSON
   */
  import(entries: RegistryEntry[]): void {
    for (const entry of entries) {
      this.entries.set(entry.memory.id, entry);
      this.indexEntry(entry);
    }
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
    this.topicIndex.clear();
    for (const set of this.statusIndex.values()) {
      set.clear();
    }
  }

  /**
   * Get total count
   */
  get size(): number {
    return this.entries.size;
  }

  // Private helpers

  private indexEntry(entry: RegistryEntry): void {
    const { memory, status } = entry;
    
    // Topic index
    if (!this.topicIndex.has(memory.topic)) {
      this.topicIndex.set(memory.topic, new Set());
    }
    this.topicIndex.get(memory.topic)!.add(memory.id);
    
    // Status index
    this.statusIndex.get(status)?.add(memory.id);
  }

  private removeFromIndices(entry: RegistryEntry): void {
    const { memory, status } = entry;
    
    this.topicIndex.get(memory.topic)?.delete(memory.id);
    this.statusIndex.get(status)?.delete(memory.id);
  }

  private estimateTokenCost(content: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(content.length / 4);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}
