/**
 * State Events Types
 *
 * Schema-aware, metadata-tagged state capture for AI agents.
 * Issue #91: Structured, queryable state beyond raw file-based snapshots.
 */

/**
 * State event types for categorizing captured state.
 */
export type StateEventType =
  | 'decision'      // Architectural or implementation decisions
  | 'preference'    // User or agent preferences
  | 'error'         // Captured errors and their context
  | 'api_response'  // Key API responses to remember
  | 'custom';       // User-defined event types

/**
 * A single state event capturing a key-value pair with metadata.
 */
export interface StateEvent {
  /** Unique identifier for this event */
  id: string;
  /** Event type category */
  type: StateEventType;
  /** ISO 8601 timestamp when the event was recorded */
  timestamp: string;
  /** The key/name for this state entry */
  key: string;
  /** The value associated with this key (can be any JSON-serializable value) */
  value: unknown;
  /** Tags for categorization and filtering */
  tags: string[];
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Options for creating a new state event.
 */
export interface StateEventInput {
  /** Event type category */
  type: StateEventType;
  /** The key/name for this state entry */
  key: string;
  /** The value associated with this key */
  value: unknown;
  /** Optional tags for categorization */
  tags?: string[];
  /** Optional additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Filters for querying state events.
 */
export interface StateEventFilter {
  /** Filter by event type */
  type?: StateEventType;
  /** Filter by key (exact match) */
  key?: string;
  /** Filter by key prefix */
  keyPrefix?: string;
  /** Filter events that have ALL of these tags */
  tags?: string[];
  /** Filter events that have ANY of these tags */
  tagsAny?: string[];
  /** Filter events after this timestamp (inclusive) */
  after?: string;
  /** Filter events before this timestamp (inclusive) */
  before?: string;
  /** Maximum number of events to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Collection of state events with query capabilities.
 */
export interface StateEventStore {
  /** Add a new state event */
  add(event: StateEventInput): StateEvent;

  /** Get a state event by ID */
  get(id: string): StateEvent | null;

  /** Query state events with filters */
  query(filter?: StateEventFilter): StateEvent[];

  /** Get all events of a specific type */
  getByType(type: StateEventType): StateEvent[];

  /** Get all events with a specific key */
  getByKey(key: string): StateEvent[];

  /** Get the most recent event for a key */
  getLatestByKey(key: string): StateEvent | null;

  /** Get all events */
  getAll(): StateEvent[];

  /** Get count of events */
  count(): number;

  /** Clear all events */
  clear(): void;

  /** Serialize to JSONL string */
  toJSONL(): string;

  /** Load from JSONL string */
  fromJSONL(jsonl: string): void;
}

/**
 * State events section in a snapshot.
 */
export interface SnapshotStateEvents {
  /** Schema version for state events */
  version: string;
  /** Count of state events */
  count: number;
  /** State events (inline for small counts, or path to JSONL file) */
  events?: StateEvent[];
  /** Path to JSONL file for large event sets */
  eventsPath?: string;
}

/**
 * Parse a CLI tag string into a StateEventInput.
 * Format: "type:key=value" (e.g., "decision:api_provider=openai")
 */
export function parseTagString(tagString: string): StateEventInput | null {
  const colonIndex = tagString.indexOf(':');
  if (colonIndex === -1) return null;

  const type = tagString.slice(0, colonIndex) as StateEventType;
  const rest = tagString.slice(colonIndex + 1);

  const equalsIndex = rest.indexOf('=');
  if (equalsIndex === -1) return null;

  const key = rest.slice(0, equalsIndex);
  const value = rest.slice(equalsIndex + 1);

  // Validate type
  const validTypes: StateEventType[] = ['decision', 'preference', 'error', 'api_response', 'custom'];
  if (!validTypes.includes(type)) return null;

  return {
    type,
    key,
    value,
    tags: [],
    metadata: {},
  };
}

/**
 * Parse a CLI metadata string into a key-value pair.
 * Format: "key=value"
 */
export function parseMetaString(metaString: string): { key: string; value: string } | null {
  const equalsIndex = metaString.indexOf('=');
  if (equalsIndex === -1) return null;

  return {
    key: metaString.slice(0, equalsIndex),
    value: metaString.slice(equalsIndex + 1),
  };
}

/** Current state events schema version */
export const STATE_EVENTS_VERSION = '1.0.0';
