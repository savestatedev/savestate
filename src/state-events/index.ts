/**
 * State Events Module
 *
 * Schema-aware, metadata-tagged state capture for AI agents.
 * Issue #91: Structured, queryable state beyond raw file-based snapshots.
 *
 * @example
 * ```ts
 * import {
 *   recordStateEvent,
 *   recordDecision,
 *   recordPreference,
 *   queryStateEvents,
 *   getDecisions,
 * } from '@savestate/state-events';
 *
 * // Record state during a session
 * recordDecision('api_provider', 'openai', 'Best model performance');
 * recordPreference('output_format', 'markdown');
 *
 * // Query state events
 * const decisions = getDecisions();
 * const recent = queryStateEvents({ after: '2024-01-01' });
 * ```
 */

// Types
export {
  type StateEvent,
  type StateEventType,
  type StateEventInput,
  type StateEventFilter,
  type StateEventStore as IStateEventStore,
  type SnapshotStateEvents,
  parseTagString,
  parseMetaString,
  STATE_EVENTS_VERSION,
} from './types.js';

// Store
export { StateEventStore, STATE_EVENTS_FILE } from './store.js';

// Helpers
export {
  getGlobalStore,
  setGlobalStore,
  clearGlobalStore,
  recordStateEvent,
  queryStateEvents,
  getStateEventsByType,
  getStateEventsByKey,
  getLatestStateValue,
  getDecisions,
  getPreferences,
  getErrors,
  getApiResponses,
  hasDecision,
  getPreference,
  recordDecision,
  recordPreference,
  recordError,
  recordApiResponse,
  importStateEvents,
  exportStateEvents,
} from './helpers.js';
