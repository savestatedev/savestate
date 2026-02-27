/**
 * In-Memory Checkpoint Storage
 * 
 * Reference implementation of CheckpointStorage for testing and development.
 * Not suitable for production use - data is lost on process exit.
 */

import { randomUUID } from 'crypto';
import {
  AuditEntry,
  Checkpoint,
  CheckpointStorage,
  ListOptions,
  ListMemoryOptions,
  MemoryObject,
  MemoryQuery,
  MemoryResult,
  Namespace,
  namespaceKey,
  ProvenanceEntry,
} from '../types.js';
import { calculateMemoryScore } from '../memory.js';

/**
 * Simple cosine similarity for vector comparison.
 * Used for semantic search when embeddings are available.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
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

/**
 * Lightweight relevance scoring (0..1) for query→text.
 *
 * Goal: be more accurate than Jaccard for short queries without needing embeddings.
 * Uses a BM25-ish term presence score + partial matches + phrase boost.
 */
function relevanceScore(query: string, text: string): number {
  const qRaw = query.toLowerCase().trim();
  const tRaw = text.toLowerCase();
  if (!qRaw) return 0;

  const STOPWORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by',
    'for', 'from', 'has', 'have', 'he', 'her', 'hers', 'him', 'his',
    'i', 'if', 'in', 'into', 'is', 'it', 'its', 'me', 'my',
    'of', 'on', 'or', 'our', 'ours', 'she', 'so', 'than', 'that',
    'the', 'their', 'theirs', 'them', 'then', 'there', 'these', 'they',
    'this', 'to', 'too', 'us', 'was', 'we', 'were', 'what', 'when',
    'where', 'which', 'who', 'why', 'will', 'with', 'you', 'your', 'yours',
  ]);

  const tokenize = (s: string): string[] =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .map(t => t.trim())
      .filter(t => t.length >= 2 && !STOPWORDS.has(t));

  // Phrase boost when the full (raw) query appears.
  // Use raw text so punctuation-sensitive phrases still match.
  const phrase = tRaw.includes(qRaw) ? 0.25 : 0;

  const queryTerms = tokenize(qRaw);
  const textTerms = tokenize(tRaw);
  if (queryTerms.length === 0 || textTerms.length === 0) return phrase;

  const textSet = new Set(textTerms);

  let score = 0;
  const denom = Math.log(2 + textTerms.length);

  for (const term of queryTerms) {
    if (textSet.has(term)) {
      score += 1 / denom;
      continue;
    }

    // Partial match (prefix/contains) for things like ids, filenames, etc.
    // Only attempt partial match for longer terms to avoid noise.
    if (term.length < 4) continue;

    for (const textTerm of textSet) {
      if (textTerm.includes(term) || term.includes(textTerm)) {
        score += 0.5 / denom;
        break;
      }
    }
  }

  // Normalize by query length so long queries don't dominate.
  const normalized = Math.min(1, score / Math.max(1, queryTerms.length));
  return Math.min(1, normalized + phrase);
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.max(0, (b - a) / (24 * 60 * 60 * 1000));
}

export class InMemoryCheckpointStorage implements CheckpointStorage {
  private checkpoints: Map<string, Checkpoint> = new Map();
  private memories: Map<string, MemoryObject> = new Map();
  private quarantinedMemories: Map<string, MemoryObject> = new Map();
  private auditLog: AuditEntry[] = [];

  // ─── Checkpoint Operations ─────────────────────────────────

  async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
    this.checkpoints.set(checkpoint.checkpoint_id, { ...checkpoint });
  }

  async getCheckpoint(checkpoint_id: string): Promise<Checkpoint | null> {
    const checkpoint = this.checkpoints.get(checkpoint_id);
    return checkpoint ? { ...checkpoint } : null;
  }

  async getLatestCheckpoint(
    namespace: Namespace,
    run_id?: string
  ): Promise<Checkpoint | null> {
    const nsKey = namespaceKey(namespace);
    
    let candidates = Array.from(this.checkpoints.values()).filter(
      cp => namespaceKey(cp.namespace) === nsKey
    );
    
    if (run_id) {
      candidates = candidates.filter(cp => cp.run_id === run_id);
    }
    
    if (candidates.length === 0) return null;
    
    // Sort by created_at descending, then by step_index descending
    candidates.sort((a, b) => {
      const timeCompare = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (timeCompare !== 0) return timeCompare;
      return b.step_index - a.step_index;
    });
    
    return { ...candidates[0] };
  }

  async listCheckpoints(
    namespace: Namespace,
    options?: ListOptions
  ): Promise<Checkpoint[]> {
    const nsKey = namespaceKey(namespace);
    
    let checkpoints = Array.from(this.checkpoints.values())
      .filter(cp => namespaceKey(cp.namespace) === nsKey);
    
    // Sort
    const order = options?.order ?? 'desc';
    checkpoints.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return order === 'desc' ? timeB - timeA : timeA - timeB;
    });
    
    // Pagination
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;
    checkpoints = checkpoints.slice(offset, offset + limit);
    
    return checkpoints.map(cp => ({ ...cp }));
  }

  // ─── Memory Operations ─────────────────────────────────────

  async saveMemory(memory: MemoryObject): Promise<void> {
    this.memories.set(memory.memory_id, { ...memory });
  }

  async saveQuarantinedMemory(memory: MemoryObject): Promise<void> {
    this.quarantinedMemories.set(memory.memory_id, { ...memory });
  }

  async getMemory(memory_id: string): Promise<MemoryObject | null> {
    const memory = this.memories.get(memory_id);
    return memory ? { ...memory } : null;
  }

  async getQuarantinedMemory(memory_id: string): Promise<MemoryObject | null> {
    const memory = this.quarantinedMemories.get(memory_id);
    return memory ? { ...memory } : null;
  }

  async listQuarantinedMemories(
    namespace: Namespace,
    options?: ListOptions
  ): Promise<MemoryObject[]> {
    const nsKey = namespaceKey(namespace);

    let memories = Array.from(this.quarantinedMemories.values()).filter(
      mem => namespaceKey(mem.namespace) === nsKey
    );

    const order = options?.order ?? 'desc';
    memories.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return order === 'desc' ? timeB - timeA : timeA - timeB;
    });

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;
    memories = memories.slice(offset, offset + limit);

    return memories.map(memory => ({ ...memory }));
  }

  async deleteQuarantinedMemory(memory_id: string): Promise<void> {
    this.quarantinedMemories.delete(memory_id);
  }

  async searchMemories(query: MemoryQuery): Promise<MemoryResult[]> {
    const nsKey = namespaceKey(query.namespace);
    
    let candidates = Array.from(this.memories.values())
      .filter(mem => namespaceKey(mem.namespace) === nsKey);
    
    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      candidates = candidates.filter(mem =>
        query.tags!.every(tag => mem.tags.includes(tag))
      );
    }
    
    // Filter by source types
    if (query.source_types && query.source_types.length > 0) {
      candidates = candidates.filter(mem =>
        query.source_types!.includes(mem.source.type)
      );
    }
    
    // Filter by minimum importance
    if (query.min_importance !== undefined) {
      candidates = candidates.filter(mem => mem.importance >= query.min_importance!);
    }
    
    // Filter out expired memories
    const now = Date.now();
    candidates = candidates.filter(mem => {
      if (!mem.ttl_seconds) return true;
      if (mem.ttl_seconds === 0) return false; // Invalidated
      const createdAt = new Date(mem.created_at).getTime();
      return now < createdAt + mem.ttl_seconds * 1000;
    });

    // Optional staleness filtering (hard filter)
    if (query.max_age_seconds !== undefined) {
      const maxAgeMs = query.max_age_seconds * 1000;
      candidates = candidates.filter(mem => {
        const createdAt = new Date(mem.created_at).getTime();
        const accessedAt = mem.last_accessed_at ? new Date(mem.last_accessed_at).getTime() : NaN;

        // Use the most recent known timestamp to determine age.
        const effective = Number.isFinite(accessedAt) ? Math.max(createdAt, accessedAt) : createdAt;
        if (!Number.isFinite(effective)) return false;

        return now - effective <= maxAgeMs;
      });
    }

    const minSemantic = query.query
      ? (query.min_semantic_similarity ?? 0.03)
      : 0;

    // Calculate scores
    const scoredResults = candidates
      .map(mem => {
        // Calculate relevance / semantic similarity
        let semanticSimilarity = 0;
        if (query.query) {
          const searchable = [
            mem.content,
            ...(mem.tags ?? []),
            mem.source?.type ?? '',
            mem.source?.identifier ?? '',
          ].join(' ');

          if (mem.embedding) {
            // If we had a query embedding, we'd use cosine similarity.
            // For now we use text relevance.
            semanticSimilarity = relevanceScore(query.query, searchable);
          } else {
            semanticSimilarity = relevanceScore(query.query, searchable);
          }
        }

        // If we have a query, guard against irrelevant results.
        if (query.query && semanticSimilarity < minSemantic) return null;

        const { score, components } = calculateMemoryScore(
          mem,
          semanticSimilarity,
          query.ranking_weights
        );

        // Staleness detection is based on memory age (created_at), not access.
        const nowIso = new Date().toISOString();
        const ageDays = daysBetween(mem.created_at, nowIso);
        const isStale = ageDays >= 90;

        const result: MemoryResult = {
          memory_id: mem.memory_id,
          score,
          score_components: components,
          is_stale: isStale,
          age_days: ageDays,
          stale_reason: isStale ? `Memory is ${Math.floor(ageDays)} days old` : undefined,
          content: query.include_content !== false ? mem.content : undefined,
          tags: mem.tags,
          source: mem.source,
          provenance: mem.provenance,
        };
        return result;
      })
      .filter((r): r is MemoryResult => r !== null);
    const results = scoredResults;
    
    // Sort by score
    results.sort((a, b) => b.score - a.score);
    
    // Apply limit
    const limit = query.limit ?? 10;
    return results.slice(0, limit);
  }

  async updateMemoryAccess(memory_id: string, checkpoint_id?: string): Promise<void> {
    const memory = this.memories.get(memory_id);
    if (!memory) return;

    memory.last_accessed_at = new Date().toISOString();

    if (checkpoint_id && !memory.checkpoint_refs.includes(checkpoint_id)) {
      memory.checkpoint_refs.push(checkpoint_id);
    }

    memory.provenance.push({
      action: 'accessed',
      actor_id: 'system',
      checkpoint_id,
      timestamp: memory.last_accessed_at,
    });

    this.memories.set(memory_id, memory);
  }

  // ─── Lifecycle Operations (Issue #110) ─────────────────────

  async listMemories(
    namespace: Namespace,
    options?: ListMemoryOptions
  ): Promise<MemoryObject[]> {
    const nsKey = namespaceKey(namespace);
    const now = Date.now();

    let memories = Array.from(this.memories.values()).filter(
      mem => namespaceKey(mem.namespace) === nsKey
    );

    // Filter by status if specified
    if (options?.status) {
      memories = memories.filter(mem => mem.status === options.status);
    } else {
      // By default, exclude deleted memories
      memories = memories.filter(mem => mem.status !== 'deleted');
    }

    // Filter out expired memories unless explicitly included
    if (!options?.include_expired) {
      memories = memories.filter(mem => {
        if (!mem.expires_at) return true;
        return new Date(mem.expires_at).getTime() > now;
      });
    }

    // Sort by created_at
    const order = options?.order ?? 'desc';
    memories.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return order === 'desc' ? timeB - timeA : timeA - timeB;
    });

    // Pagination
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;
    memories = memories.slice(offset, offset + limit);

    return memories.map(memory => ({ ...memory }));
  }

  async updateMemory(memory: MemoryObject): Promise<void> {
    // Check if memory exists in either store
    const existing = this.memories.get(memory.memory_id)
      || this.quarantinedMemories.get(memory.memory_id);

    if (!existing) {
      throw new Error(`Memory ${memory.memory_id} not found`);
    }

    // Handle status transitions
    if (memory.status === 'quarantined') {
      // Move to quarantine store
      this.memories.delete(memory.memory_id);
      this.quarantinedMemories.set(memory.memory_id, { ...memory });
    } else if (memory.status === 'deleted') {
      // Keep in main store but marked as deleted (soft delete)
      this.quarantinedMemories.delete(memory.memory_id);
      this.memories.set(memory.memory_id, { ...memory });
    } else {
      // Active status - ensure in main store
      this.quarantinedMemories.delete(memory.memory_id);
      this.memories.set(memory.memory_id, { ...memory });
    }
  }

  async getMemoryAuditLog(memory_id: string): Promise<ProvenanceEntry[]> {
    // Check both stores for the memory
    const memory = this.memories.get(memory_id)
      || this.quarantinedMemories.get(memory_id);

    if (!memory) {
      return [];
    }

    // Return provenance sorted by timestamp (newest first)
    return [...memory.provenance].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });
  }

  // ─── Audit Operations ──────────────────────────────────────

  async logAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
    this.auditLog.push({
      ...entry,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    });
  }

  async getAuditLog(namespace: Namespace, options?: ListOptions): Promise<AuditEntry[]> {
    const nsKey = namespaceKey(namespace);
    
    let entries = this.auditLog.filter(
      entry => namespaceKey(entry.namespace) === nsKey
    );
    
    // Sort
    const order = options?.order ?? 'desc';
    entries.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return order === 'desc' ? timeB - timeA : timeA - timeB;
    });
    
    // Pagination
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;
    
    return entries.slice(offset, offset + limit);
  }

  // ─── Testing Helpers ───────────────────────────────────────

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.checkpoints.clear();
    this.memories.clear();
    this.quarantinedMemories.clear();
    this.auditLog = [];
  }

  /**
   * Get statistics (for testing/debugging)
   */
  getStats(): {
    checkpoints: number;
    memories: number;
    quarantinedMemories: number;
    auditEntries: number;
  } {
    return {
      checkpoints: this.checkpoints.size,
      memories: this.memories.size,
      quarantinedMemories: this.quarantinedMemories.size,
      auditEntries: this.auditLog.length,
    };
  }
}
