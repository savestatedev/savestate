/**
 * State Events SDK/API Helpers
 *
 * Convenience functions for adapters and integrations.
 * Issue #91: Schema-aware, metadata-tagged state capture.
 */

import type {
  StateEvent,
  StateEventType,
  StateEventFilter,
  StateEventInput,
} from './types.js';
import { StateEventStore } from './store.js';

/**
 * Global state event store instance.
 * Used for recording events during a snapshot session.
 */
let globalStore: StateEventStore | null = null;

/**
 * Get the global state event store, creating one if needed.
 */
export function getGlobalStore(): StateEventStore {
  if (!globalStore) {
    globalStore = new StateEventStore();
  }
  return globalStore;
}

/**
 * Set the global state event store.
 * Used during restore to provide access to loaded events.
 */
export function setGlobalStore(store: StateEventStore): void {
  globalStore = store;
}

/**
 * Clear the global state event store.
 */
export function clearGlobalStore(): void {
  globalStore = null;
}

/**
 * Record a new state event.
 *
 * @param type - Event type category
 * @param key - The key/name for this state entry
 * @param value - The value associated with this key
 * @param tags - Optional tags for categorization
 * @param metadata - Optional additional metadata
 * @returns The created state event
 *
 * @example
 * ```ts
 * // Record a decision
 * recordStateEvent('decision', 'api_provider', 'openai', ['architecture']);
 *
 * // Record a preference with metadata
 * recordStateEvent('preference', 'theme', 'dark', [], { confidence: 'high' });
 *
 * // Record an error
 * recordStateEvent('error', 'auth_failure', { code: 401, message: 'Unauthorized' });
 * ```
 */
export function recordStateEvent(
  type: StateEventType,
  key: string,
  value: unknown,
  tags?: string[],
  metadata?: Record<string, unknown>,
): StateEvent {
  const store = getGlobalStore();
  return store.add({
    type,
    key,
    value,
    tags,
    metadata,
  });
}

/**
 * Query state events with filters.
 *
 * @param filters - Optional filters to apply
 * @returns Array of matching state events
 *
 * @example
 * ```ts
 * // Get all decisions
 * const decisions = queryStateEvents({ type: 'decision' });
 *
 * // Get recent preferences
 * const prefs = queryStateEvents({
 *   type: 'preference',
 *   after: '2024-01-01T00:00:00Z',
 * });
 *
 * // Get events by tag
 * const important = queryStateEvents({ tags: ['important'] });
 * ```
 */
export function queryStateEvents(filters?: StateEventFilter): StateEvent[] {
  const store = getGlobalStore();
  return store.query(filters);
}

/**
 * Get all state events of a specific type.
 *
 * @param type - The event type to filter by
 * @returns Array of state events of that type
 */
export function getStateEventsByType(type: StateEventType): StateEvent[] {
  const store = getGlobalStore();
  return store.getByType(type);
}

/**
 * Get all state events with a specific key.
 *
 * @param key - The key to filter by
 * @returns Array of state events with that key
 */
export function getStateEventsByKey(key: string): StateEvent[] {
  const store = getGlobalStore();
  return store.getByKey(key);
}

/**
 * Get the most recent value for a state key.
 *
 * @param key - The key to look up
 * @returns The value if found, undefined otherwise
 */
export function getLatestStateValue<T = unknown>(key: string): T | undefined {
  const store = getGlobalStore();
  const event = store.getLatestByKey(key);
  return event ? (event.value as T) : undefined;
}

/**
 * Get all decisions recorded in the current session.
 */
export function getDecisions(): StateEvent[] {
  return getStateEventsByType('decision');
}

/**
 * Get all preferences recorded in the current session.
 */
export function getPreferences(): StateEvent[] {
  return getStateEventsByType('preference');
}

/**
 * Get all errors recorded in the current session.
 */
export function getErrors(): StateEvent[] {
  return getStateEventsByType('error');
}

/**
 * Get all API responses recorded in the current session.
 */
export function getApiResponses(): StateEvent[] {
  return getStateEventsByType('api_response');
}

/**
 * Check if a specific decision has been made.
 *
 * @param key - The decision key to check
 * @returns true if the decision exists
 */
export function hasDecision(key: string): boolean {
  const events = queryStateEvents({ type: 'decision', key });
  return events.length > 0;
}

/**
 * Get a specific preference value.
 *
 * @param key - The preference key
 * @param defaultValue - Default value if not found
 * @returns The preference value or default
 */
export function getPreference<T = unknown>(key: string, defaultValue?: T): T | undefined {
  const events = queryStateEvents({ type: 'preference', key, limit: 1 });
  return events.length > 0 ? (events[0].value as T) : defaultValue;
}

/**
 * Record a decision with standard metadata.
 *
 * @param key - Decision identifier
 * @param value - The decision value
 * @param reason - Why this decision was made
 * @param alternatives - Other options considered
 */
export function recordDecision(
  key: string,
  value: unknown,
  reason?: string,
  alternatives?: string[],
): StateEvent {
  return recordStateEvent('decision', key, value, [], {
    reason,
    alternatives,
    decided_at: new Date().toISOString(),
  });
}

/**
 * Record a user preference.
 *
 * @param key - Preference identifier
 * @param value - The preference value
 * @param source - Where this preference came from
 */
export function recordPreference(
  key: string,
  value: unknown,
  source?: string,
): StateEvent {
  return recordStateEvent('preference', key, value, [], {
    source: source ?? 'user',
    recorded_at: new Date().toISOString(),
  });
}

/**
 * Record an error for future reference.
 *
 * @param key - Error identifier
 * @param error - Error details
 * @param context - Additional context
 */
export function recordError(
  key: string,
  error: unknown,
  context?: Record<string, unknown>,
): StateEvent {
  const errorValue = error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : error;

  return recordStateEvent('error', key, errorValue, [], {
    ...context,
    recorded_at: new Date().toISOString(),
  });
}

/**
 * Record an API response for caching/reference.
 *
 * @param key - API identifier (e.g., endpoint name)
 * @param response - The response data
 * @param requestContext - Optional request context
 */
export function recordApiResponse(
  key: string,
  response: unknown,
  requestContext?: Record<string, unknown>,
): StateEvent {
  return recordStateEvent('api_response', key, response, [], {
    ...requestContext,
    recorded_at: new Date().toISOString(),
  });
}

/**
 * Bulk import state events from an array.
 *
 * @param events - Array of state event inputs to import
 * @returns Array of created state events
 */
export function importStateEvents(events: StateEventInput[]): StateEvent[] {
  const store = getGlobalStore();
  return events.map(e => store.add(e));
}

/**
 * Export all state events as an array.
 *
 * @returns Array of all state events
 */
export function exportStateEvents(): StateEvent[] {
  const store = getGlobalStore();
  return store.getAll();
}
