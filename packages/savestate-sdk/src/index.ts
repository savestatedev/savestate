/**
 * @savestate/sdk — Programmatic SaveState client.
 *
 * Thin wrapper around the @savestate/cli engine. Lets builders snapshot,
 * search, restore, and migrate AI memory across platforms without shelling
 * out to the CLI.
 *
 * The SDK does not reimplement any engine logic — it composes the same
 * functions the CLI itself uses (`createSnapshot`, `restoreSnapshot`,
 * `searchSnapshots`, `MemoryStore`, etc.) into a small, ergonomic class.
 */

export { SaveStateClient } from './client.js';
export type {
  SaveStateClientOptions,
  SnapshotOptions,
  RestoreOptions,
  ListOptions,
  SearchOptions,
  MemoryHandle,
} from './client.js';

// Re-export the most commonly needed types from the engine so SDK
// consumers don't have to also depend on @savestate/cli for types.
export type {
  Snapshot,
  Adapter,
  StorageBackend,
  StorageConfig,
  SaveStateConfig,
  SearchResult,
  Manifest,
  Memory,
  Identity,
  Conversation,
} from '../../../src/types.js';

export type {
  MemoryEntry,
  MemoryType,
  MemoryQuery,
  MemoryStats,
} from '../../../src/memory/types.js';

export type { CreateSnapshotResult } from '../../../src/snapshot.js';
export type { RestoreResult } from '../../../src/restore.js';
export type { SnapshotIndexEntry, SnapshotIndex } from '../../../src/index-file.js';
