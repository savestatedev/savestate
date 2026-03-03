/**
 * State Event Store
 *
 * Lightweight sidecar storage for state events.
 * Persists as JSONL inside snapshots (state-events.jsonl).
 * Issue #91: Schema-aware, metadata-tagged state capture.
 */

import { randomUUID } from 'node:crypto';
import type {
  StateEvent,
  StateEventInput,
  StateEventFilter,
  StateEventStore as IStateEventStore,
  StateEventType,
} from './types.js';

/**
 * In-memory state event store with JSONL serialization.
 */
export class StateEventStore implements IStateEventStore {
  private events: Map<string, StateEvent> = new Map();

  /**
   * Add a new state event.
   */
  add(input: StateEventInput): StateEvent {
    const event: StateEvent = {
      id: randomUUID(),
      type: input.type,
      timestamp: new Date().toISOString(),
      key: input.key,
      value: input.value,
      tags: input.tags ?? [],
      metadata: input.metadata ?? {},
    };

    this.events.set(event.id, event);
    return event;
  }

  /**
   * Get a state event by ID.
   */
  get(id: string): StateEvent | null {
    return this.events.get(id) ?? null;
  }

  /**
   * Query state events with filters.
   */
  query(filter?: StateEventFilter): StateEvent[] {
    let results = Array.from(this.events.values());

    if (!filter) {
      return results;
    }

    // Filter by type
    if (filter.type) {
      results = results.filter(e => e.type === filter.type);
    }

    // Filter by exact key
    if (filter.key) {
      results = results.filter(e => e.key === filter.key);
    }

    // Filter by key prefix
    if (filter.keyPrefix) {
      results = results.filter(e => e.key.startsWith(filter.keyPrefix!));
    }

    // Filter by tags (ALL must match)
    if (filter.tags && filter.tags.length > 0) {
      results = results.filter(e =>
        filter.tags!.every(tag => e.tags.includes(tag))
      );
    }

    // Filter by tags (ANY must match)
    if (filter.tagsAny && filter.tagsAny.length > 0) {
      results = results.filter(e =>
        filter.tagsAny!.some(tag => e.tags.includes(tag))
      );
    }

    // Filter by timestamp range
    if (filter.after) {
      results = results.filter(e => e.timestamp >= filter.after!);
    }
    if (filter.before) {
      results = results.filter(e => e.timestamp <= filter.before!);
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Apply offset
    if (filter.offset && filter.offset > 0) {
      results = results.slice(filter.offset);
    }

    // Apply limit
    if (filter.limit && filter.limit > 0) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  /**
   * Get all events of a specific type.
   */
  getByType(type: StateEventType): StateEvent[] {
    return this.query({ type });
  }

  /**
   * Get all events with a specific key.
   */
  getByKey(key: string): StateEvent[] {
    return this.query({ key });
  }

  /**
   * Get the most recent event for a key.
   */
  getLatestByKey(key: string): StateEvent | null {
    const events = this.query({ key, limit: 1 });
    return events.length > 0 ? events[0] : null;
  }

  /**
   * Get all events.
   */
  getAll(): StateEvent[] {
    return this.query();
  }

  /**
   * Get count of events.
   */
  count(): number {
    return this.events.size;
  }

  /**
   * Clear all events.
   */
  clear(): void {
    this.events.clear();
  }

  /**
   * Serialize to JSONL string (one JSON object per line).
   */
  toJSONL(): string {
    const events = Array.from(this.events.values());
    // Sort by timestamp for deterministic output
    events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return events.map(e => JSON.stringify(e)).join('\n') + (events.length > 0 ? '\n' : '');
  }

  /**
   * Load from JSONL string.
   */
  fromJSONL(jsonl: string): void {
    const lines = jsonl.trim().split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        const event = JSON.parse(line) as StateEvent;
        this.events.set(event.id, event);
      } catch {
        // Skip invalid lines
      }
    }
  }

  /**
   * Create a store from JSONL string.
   */
  static fromJSONL(jsonl: string): StateEventStore {
    const store = new StateEventStore();
    store.fromJSONL(jsonl);
    return store;
  }

  /**
   * Merge events from another store (for restore scenarios).
   */
  merge(other: StateEventStore): void {
    for (const event of other.getAll()) {
      this.events.set(event.id, event);
    }
  }
}

/** File path for state events inside the archive */
export const STATE_EVENTS_FILE = 'state-events.jsonl';
