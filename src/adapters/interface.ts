/**
 * Adapter Interface
 *
 * Each AI platform needs an adapter to extract and restore state.
 * Adapters are the bridge between SaveState and the outside world.
 */

export type { Adapter, PlatformMeta, Snapshot, SnapshotStateEvents } from '../types.js';

// Re-export state event utilities for adapter implementations (Issue #91)
export {
  getGlobalStore,
  queryStateEvents,
  getStateEventsByType,
  getStateEventsByKey,
  getLatestStateValue,
  getDecisions,
  getPreferences,
  getErrors,
  getApiResponses,
} from '../state-events/helpers.js';

export type { StateEvent, StateEventType, StateEventFilter } from '../state-events/types.js';
