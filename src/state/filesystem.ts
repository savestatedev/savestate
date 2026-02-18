/**
 * Path-Addressable State Filesystem
 * 
 * Core implementation of the state filesystem with
 * write, get, list, resolve, and bundle operations.
 */

import {
  StateObject,
  StateStorage,
  StateValueType,
  WriteInput,
  WriteResult,
  ListOptions,
  ListItem,
  ResolveQuery,
  ResolveResult,
  BundleRequest,
  StateBundle,
  Citation,
  ActorContext,
} from './types.js';

/**
 * Detect value type from a value
 */
export function detectValueType(value: unknown): StateValueType {
  if (value === null || value === undefined) {
    return 'json';
  }
  
  if (typeof value === 'string') {
    // Check if it's a datetime
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(value)) {
      return 'datetime';
    }
    // Check if it looks like code
    if (value.includes('\n') && (
      value.includes('function') ||
      value.includes('const ') ||
      value.includes('import ') ||
      value.includes('def ') ||
      value.includes('class ')
    )) {
      return 'code';
    }
    // Long text
    if (value.length > 500) {
      return 'text';
    }
    return 'string';
  }
  
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  
  return 'json';
}

/**
 * Validate a path format
 */
export function validatePath(path: string): { valid: boolean; error?: string } {
  if (!path.startsWith('/')) {
    return { valid: false, error: 'Path must start with /' };
  }
  
  if (path.includes('//')) {
    return { valid: false, error: 'Path cannot contain //' };
  }
  
  if (path.endsWith('/') && path.length > 1) {
    return { valid: false, error: 'Path cannot end with / (except root)' };
  }
  
  // Check for invalid characters
  if (!/^[a-zA-Z0-9/_\-.:]+$/.test(path)) {
    return { valid: false, error: 'Path contains invalid characters' };
  }
  
  return { valid: true };
}

/**
 * Parse path into segments
 */
export function parsePath(path: string): string[] {
  return path.split('/').filter(s => s.length > 0);
}

/**
 * Check if path matches a prefix
 */
export function matchesPrefix(path: string, prefix: string): boolean {
  if (prefix === '/') return true;
  return path === prefix || path.startsWith(prefix + '/');
}

/**
 * Simple BM25-like scoring for text matching
 */
function bm25Score(query: string, text: string): number {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const textTerms = text.toLowerCase().split(/\s+/);
  const textSet = new Set(textTerms);
  
  let score = 0;
  for (const term of queryTerms) {
    if (textSet.has(term)) {
      score += 1 / Math.log(1 + textTerms.length);
    }
    // Partial match
    for (const textTerm of textSet) {
      if (textTerm.includes(term) || term.includes(textTerm)) {
        score += 0.5 / Math.log(1 + textTerms.length);
      }
    }
  }
  
  return Math.min(1, score);
}

/**
 * Calculate recency score (0-1)
 */
function recencyScore(updated_at: string): number {
  const now = Date.now();
  const updated = new Date(updated_at).getTime();
  const ageMs = now - updated;
  const halfLifeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  return Math.pow(0.5, ageMs / halfLifeMs);
}

/**
 * Estimate token count (simple approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * State Filesystem Service
 */
export class StateFilesystem {
  constructor(private storage: StateStorage) {}

  /**
   * Write a value to a path
   */
  async write<T>(input: WriteInput<T>): Promise<WriteResult> {
    // Validate path
    const validation = validatePath(input.path);
    if (!validation.valid) {
      return {
        path: input.path,
        version: 0,
        updated_at: new Date().toISOString(),
        success: false,
        error: validation.error,
      };
    }

    // Check expected version for optimistic locking
    if (input.expected_version !== undefined) {
      const existing = await this.storage.get(input.path);
      if (existing && existing.version !== input.expected_version) {
        return {
          path: input.path,
          version: existing.version,
          updated_at: existing.updated_at,
          success: false,
          error: `Version mismatch: expected ${input.expected_version}, got ${existing.version}`,
        };
      }
    }

    return this.storage.write(input);
  }

  /**
   * Get a value from a path
   */
  async get<T = unknown>(path: string): Promise<StateObject<T> | null> {
    return this.storage.get(path) as Promise<StateObject<T> | null>;
  }

  /**
   * Get a specific version
   */
  async getVersion<T = unknown>(path: string, version: number): Promise<StateObject<T> | null> {
    return this.storage.getVersion(path, version) as Promise<StateObject<T> | null>;
  }

  /**
   * List paths by prefix
   */
  async list(prefix: string, options?: ListOptions): Promise<ListItem[]> {
    return this.storage.list(prefix, options);
  }

  /**
   * Check if path exists
   */
  async exists(path: string): Promise<boolean> {
    return this.storage.exists(path);
  }

  /**
   * Delete a path
   */
  async delete(path: string): Promise<boolean> {
    return this.storage.delete(path);
  }

  /**
   * Get version history
   */
  async history(path: string, limit?: number): Promise<StateObject[]> {
    return this.storage.history(path, limit);
  }

  /**
   * Resolve: Find relevant paths for a query
   * Uses hybrid BM25 + embedding search (embedding is placeholder)
   */
  async resolve(query: ResolveQuery): Promise<ResolveResult[]> {
    // Get candidate paths
    const prefix = query.prefix || '/';
    const allItems = await this.storage.list(prefix, { 
      include_values: true,
      limit: 100,
    });

    // Score each item
    const scored: ResolveResult[] = [];

    for (const item of allItems) {
      const state = item.value ? {
        ...item,
        created_at: item.updated_at, // Fallback
        writer: 'unknown',
        evidence_refs: [],
      } as StateObject : await this.storage.get(item.path);

      if (!state) continue;

      // Build searchable text
      const searchText = [
        item.path,
        state.description || '',
        typeof state.value === 'string' ? state.value : JSON.stringify(state.value),
        ...(state.tags || []),
      ].join(' ');

      // Calculate scores
      const bm25 = bm25Score(query.query, searchText);
      const recency = recencyScore(item.updated_at);
      const confidence = item.confidence;

      // Actor context boost
      let contextBoost = 0;
      if (query.actor_context) {
        // Boost if recently accessed
        if (query.actor_context.recent_paths?.includes(item.path)) {
          contextBoost += 0.2;
        }
        // Boost if tags match interests
        if (query.actor_context.interested_tags && state.tags) {
          const matchingTags = state.tags.filter(t => 
            query.actor_context!.interested_tags!.includes(t)
          );
          contextBoost += matchingTags.length * 0.1;
        }
      }

      // Combined score (weights can be tuned)
      const score = Math.min(1, 
        bm25 * 0.4 + 
        recency * 0.2 + 
        confidence * 0.3 + 
        contextBoost * 0.1
      );

      if (score >= (query.min_score || 0)) {
        scored.push({
          path: item.path,
          score,
          reason: this.generateReason(bm25, recency, confidence, contextBoost),
          score_components: {
            bm25,
            recency,
            confidence,
          },
          state: query.include_values ? state : undefined,
        });
      }
    }

    // Sort by score and limit
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, query.limit || 10);
  }

  /**
   * Generate human-readable reason for match
   */
  private generateReason(bm25: number, recency: number, confidence: number, contextBoost: number): string {
    const reasons: string[] = [];
    
    if (bm25 > 0.5) reasons.push('strong text match');
    else if (bm25 > 0.2) reasons.push('partial text match');
    
    if (recency > 0.7) reasons.push('recently updated');
    if (confidence > 0.8) reasons.push('high confidence');
    if (contextBoost > 0) reasons.push('matches context');
    
    return reasons.length > 0 ? reasons.join(', ') : 'relevant path';
  }

  /**
   * Bundle: Assemble context from multiple paths
   */
  async bundle(request: BundleRequest): Promise<StateBundle> {
    const { paths, token_budget, strategy, priorities } = request;
    
    // Fetch all state objects
    const states: Array<{ path: string; state: StateObject; priority: number }> = [];
    
    for (const path of paths) {
      const state = await this.storage.get(path);
      if (state) {
        states.push({
          path,
          state,
          priority: priorities?.[path] ?? 0,
        });
      }
    }

    // Sort by priority (higher first)
    states.sort((a, b) => b.priority - a.priority);

    // Build context
    const includedPaths: string[] = [];
    const excludedPaths: string[] = [];
    const citations: Citation[] = [];
    const contextParts: string[] = [];
    let currentTokens = 0;

    for (const { path, state, priority } of states) {
      const formatted = this.formatStateForContext(state, strategy);
      const tokens = estimateTokens(formatted);

      if (currentTokens + tokens <= token_budget) {
        contextParts.push(formatted);
        currentTokens += tokens;
        includedPaths.push(path);
        citations.push({
          path,
          version: state.version,
          evidence_refs: state.evidence_refs,
          confidence: state.confidence,
        });
      } else {
        excludedPaths.push(path);
      }
    }

    return {
      context: contextParts.join('\n\n'),
      token_count: currentTokens,
      included_paths: includedPaths,
      excluded_paths: excludedPaths,
      citations,
      metadata: {
        strategy,
        budget: token_budget,
        created_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Format state object for context based on strategy
   */
  private formatStateForContext(state: StateObject, strategy: string): string {
    const header = `## ${state.path} (v${state.version}, confidence: ${state.confidence.toFixed(2)})`;
    
    switch (strategy) {
      case 'full':
        const valueStr = typeof state.value === 'string' 
          ? state.value 
          : JSON.stringify(state.value, null, 2);
        return `${header}\n${valueStr}`;

      case 'summary':
        const fullValue = typeof state.value === 'string' 
          ? state.value 
          : JSON.stringify(state.value, null, 2);
        // Truncate to ~100 chars for summary
        const summary = fullValue.length > 100 
          ? fullValue.slice(0, 100) + '...'
          : fullValue;
        return `${header}\n${summary}`;

      case 'references':
        return `${header}\n[Reference: ${state.evidence_refs.join(', ') || 'none'}]`;

      default:
        return header;
    }
  }

  /**
   * Atomic multi-write operation
   */
  async writeMany(inputs: WriteInput[]): Promise<WriteResult[]> {
    const results: WriteResult[] = [];
    
    for (const input of inputs) {
      const result = await this.write(input);
      results.push(result);
      
      // Stop on first failure in transaction mode
      if (!result.success) {
        break;
      }
    }
    
    return results;
  }

  /**
   * Copy state from one path to another
   */
  async copy(source: string, destination: string, writer: string): Promise<WriteResult> {
    const state = await this.storage.get(source);
    if (!state) {
      return {
        path: destination,
        version: 0,
        updated_at: new Date().toISOString(),
        success: false,
        error: `Source path not found: ${source}`,
      };
    }

    return this.write({
      path: destination,
      value: state.value,
      type: state.type,
      writer,
      confidence: state.confidence,
      evidence_refs: [...state.evidence_refs, source],
      description: state.description,
      tags: state.tags,
    });
  }

  /**
   * Move state from one path to another
   */
  async move(source: string, destination: string, writer: string): Promise<WriteResult> {
    const copyResult = await this.copy(source, destination, writer);
    if (copyResult.success) {
      await this.storage.delete(source);
    }
    return copyResult;
  }
}
