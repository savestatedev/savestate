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
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!q) return 0;

  // Phrase boost when the full query appears
  const phrase = t.includes(q) ? 0.25 : 0;

  const queryTerms = q.split(/\s+/).filter(Boolean);
  const textTerms = t.split(/\s+/).filter(Boolean);
  const textSet = new Set(textTerms);

  let score = 0;
  for (const term of queryTerms) {
    if (textSet.has(term)) {
      score += 1 / Math.log(2 + textTerms.length);
      continue;
    }

    // Partial match (prefix/contains) for things like ids, filenames, etc.
    for (const textTerm of textSet) {
      if (textTerm.includes(term) || term.includes(textTerm)) {
        score += 0.5 / Math.log(2 + textTerms.length);
        break;
      }
    }
  }

  // Normalize and add phrase boost.
  const normalized = Math.min(1, score);
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

  async getMemory(memory_id: string): Promise<MemoryObject | null> {
    const memory = this.memories.get(memory_id);
    return memory ? { ...memory } : null;
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
    
    // Calculate scores
    const results: MemoryResult[] = candidates.map(mem => {
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

      const { score, components } = calculateMemoryScore(
        mem,
        semanticSimilarity,
        query.ranking_weights
      );

      // Staleness detection is based on memory age (created_at), not access.
      const nowIso = new Date().toISOString();
      const ageDays = daysBetween(mem.created_at, nowIso);
      const isStale = ageDays >= 90;

      return {
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
    });
    
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
    this.auditLog = [];
  }

  /**
   * Get statistics (for testing/debugging)
   */
  getStats(): { checkpoints: number; memories: number; auditEntries: number } {
    return {
      checkpoints: this.checkpoints.size,
      memories: this.memories.size,
      auditEntries: this.auditLog.length,
    };
  }
}
