/**
 * In-Memory State Storage
 * 
 * Reference implementation for testing and development.
 */

import {
  StateObject,
  StateStorage,
  WriteInput,
  WriteResult,
  ListOptions,
  ListItem,
} from '../types.js';
import { detectValueType, matchesPrefix } from '../filesystem.js';

/**
 * In-memory state storage with version history
 */
export class InMemoryStateStorage implements StateStorage {
  // path -> current version
  private states: Map<string, StateObject> = new Map();
  
  // path -> version history (all versions)
  private versionHistory: Map<string, StateObject[]> = new Map();

  async write(input: WriteInput): Promise<WriteResult> {
    const now = new Date().toISOString();
    const existing = this.states.get(input.path);
    const version = existing ? existing.version + 1 : 1;

    const state: StateObject = {
      path: input.path,
      type: input.type ?? detectValueType(input.value),
      value: input.value,
      version,
      updated_at: now,
      created_at: existing?.created_at ?? now,
      writer: input.writer,
      confidence: input.confidence ?? 1.0,
      ttl: input.ttl,
      evidence_refs: input.evidence_refs ?? [],
      description: input.description,
      tags: input.tags,
    };

    // Store current version
    this.states.set(input.path, state);

    // Add to history
    const pathHistory = this.versionHistory.get(input.path) ?? [];
    pathHistory.push({ ...state });
    this.versionHistory.set(input.path, pathHistory);

    return {
      path: input.path,
      version,
      updated_at: now,
      success: true,
    };
  }

  async get(path: string): Promise<StateObject | null> {
    const state = this.states.get(path);
    if (!state) return null;

    // Check TTL
    if (state.ttl) {
      const created = new Date(state.created_at).getTime();
      const now = Date.now();
      if (now > created + state.ttl * 1000) {
        // Expired
        return null;
      }
    }

    return { ...state };
  }

  async getVersion(path: string, version: number): Promise<StateObject | null> {
    const pathHistory = this.versionHistory.get(path);
    if (!pathHistory) return null;

    const state = pathHistory.find(s => s.version === version);
    return state ? { ...state } : null;
  }

  async list(prefix: string, options?: ListOptions): Promise<ListItem[]> {
    const items: ListItem[] = [];

    for (const [path, state] of this.states.entries()) {
      if (!matchesPrefix(path, prefix)) continue;

      // Check TTL
      if (state.ttl) {
        const created = new Date(state.created_at).getTime();
        if (Date.now() > created + state.ttl * 1000) continue;
      }

      // Filter by tags
      if (options?.tags && options.tags.length > 0) {
        if (!state.tags || !options.tags.every(t => state.tags!.includes(t))) {
          continue;
        }
      }

      // Filter by confidence
      if (options?.min_confidence !== undefined) {
        if (state.confidence < options.min_confidence) continue;
      }

      items.push({
        path: state.path,
        type: state.type,
        version: state.version,
        updated_at: state.updated_at,
        confidence: state.confidence,
        value: options?.include_values ? state.value : undefined,
      });
    }

    // Sort
    const sortBy = options?.sort_by ?? 'path';
    const order = options?.order ?? 'asc';
    
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'path':
          cmp = a.path.localeCompare(b.path);
          break;
        case 'updated_at':
          cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
        case 'confidence':
          cmp = a.confidence - b.confidence;
          break;
        case 'version':
          cmp = a.version - b.version;
          break;
      }
      return order === 'desc' ? -cmp : cmp;
    });

    // Pagination
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;

    return items.slice(offset, offset + limit);
  }

  async delete(path: string): Promise<boolean> {
    const existed = this.states.has(path);
    this.states.delete(path);
    // Keep history for audit
    return existed;
  }

  async exists(path: string): Promise<boolean> {
    const state = this.states.get(path);
    if (!state) return false;

    // Check TTL
    if (state.ttl) {
      const created = new Date(state.created_at).getTime();
      if (Date.now() > created + state.ttl * 1000) {
        return false;
      }
    }

    return true;
  }

  async history(path: string, limit?: number): Promise<StateObject[]> {
    const pathHistory = this.versionHistory.get(path);
    if (!pathHistory) return [];

    // Return in reverse order (newest first)
    const sorted = [...pathHistory].reverse();
    return limit ? sorted.slice(0, limit) : sorted;
  }

  // ─── Testing Helpers ───────────────────────────────────────

  /**
   * Clear all data
   */
  clear(): void {
    this.states.clear();
    this.versionHistory.clear();
  }

  /**
   * Get stats
   */
  getStats(): { paths: number; totalVersions: number } {
    let totalVersions = 0;
    for (const hist of this.versionHistory.values()) {
      totalVersions += hist.length;
    }
    return {
      paths: this.states.size,
      totalVersions,
    };
  }
}
