/**
 * Path-Addressable State Filesystem
 * 
 * Typed, versioned state objects at stable paths with:
 * - write/get/list for basic CRUD
 * - resolve for hybrid search (BM25 + embedding)
 * - bundle for context assembly with token budgets
 * 
 * @see https://github.com/savestatedev/savestate/issues/70
 */

// Types
export {
  // State objects
  StateValueType,
  StateObject,
  WriteInput,
  WriteResult,
  
  // Listing
  ListOptions,
  ListItem,
  
  // Resolve
  ActorContext,
  ResolveQuery,
  ResolveResult,
  
  // Bundle
  BundleStrategy,
  BundleRequest,
  StateBundle,
  Citation,
  
  // Path patterns
  PATH_PATTERNS,
  PathBuilder,
  
  // Storage
  StateStorage,
} from './types.js';

// Filesystem service
export {
  StateFilesystem,
  detectValueType,
  validatePath,
  parsePath,
  matchesPrefix,
} from './filesystem.js';

// Storage backends
export { InMemoryStateStorage } from './storage/index.js';
