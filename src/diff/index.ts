/**
 * Diff Module (Issue #92)
 *
 * Provides semantic diffing for agent identity and state events.
 */

export {
  // Semantic diff
  ChangeType,
  SemanticChange,
  IdentityDiff,
  diffIdentity,
  formatIdentityDiff,
} from './semantic.js';

export {
  // State events diff
  StateEventType,
  StateEventChange,
  StateEventDiff,
  diffStateEvents,
  formatStateEventDiff,
} from './state-events.js';
