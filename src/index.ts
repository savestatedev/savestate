/**
 * SaveState — Time Machine for AI
 *
 * Public API for programmatic usage.
 */

// Core types
export type {
  Manifest,
  Identity,
  Memory,
  MemoryEntry,
  KnowledgeDocument,
  Conversation,
  ConversationIndex,
  ConversationMeta,
  Message,
  Snapshot,
  PlatformMeta,
  SnapshotChain,
  RestoreHints,
  RestoreStep,
  ToolConfig,
  EmbeddingData,
  Adapter,
  StorageBackend,
  SaveStateConfig,
  StorageConfig,
  RetentionPolicy,
  AdapterConfig,
  SearchResult,
  DiffResult,
  DiffChange,
} from './types.js';

// Encryption
export { encrypt, decrypt, verify } from './encryption.js';

// Format
export {
  packSnapshot,
  unpackSnapshot,
  computeChecksum,
  generateSnapshotId,
  snapshotFilename,
  SAF_EXTENSION,
  SAF_VERSION,
} from './format.js';

// Config
export {
  loadConfig,
  saveConfig,
  initializeProject,
  isInitialized,
  defaultConfig,
  SAVESTATE_DIR,
  GLOBAL_SAVESTATE_DIR,
} from './config.js';

// Snapshot
export { createSnapshot, getLatestSnapshotId } from './snapshot.js';

// Restore
export { restoreSnapshot, validateSnapshot } from './restore.js';

// Search
export { searchSnapshots, scoreMatch } from './search.js';

// Storage
export { LocalStorageBackend } from './storage/index.js';

// Adapters
export { ClawdbotAdapter, listAdapters, getAdapter, detectAdapter, getAdapterInfo } from './adapters/index.js';
