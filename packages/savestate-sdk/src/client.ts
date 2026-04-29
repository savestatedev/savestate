/**
 * SaveStateClient — programmatic façade over the SaveState engine.
 *
 * Every method in this file is a thin adapter over an existing function
 * exported by `@savestate/cli` (the parent package). The SDK never
 * reimplements logic; it just packages the engine into an ergonomic
 * class so AI builders don't have to shell out to the CLI.
 */

import type {
  Adapter,
  SaveStateConfig,
  SearchResult,
  StorageBackend,
  StorageConfig,
} from '../../../src/types.js';
import {
  createSnapshot,
  type CreateSnapshotResult,
} from '../../../src/snapshot.js';
import { restoreSnapshot, type RestoreResult } from '../../../src/restore.js';
import { searchSnapshots } from '../../../src/search.js';
import { loadIndex, type SnapshotIndexEntry } from '../../../src/index-file.js';
import { applyListFilters } from '../../../src/commands/list.js';
import { computeStats } from '../../../src/commands/stats.js';
import { LocalStorageBackend } from '../../../src/storage/local.js';
import { resolveStorage } from '../../../src/storage/resolve.js';
import { getAdapter } from '../../../src/adapters/registry.js';
import { MemoryStore } from '../../../src/memory/store.js';
import type {
  MemoryEntry,
  MemoryQuery,
  MemoryStats,
} from '../../../src/memory/types.js';

/**
 * Options accepted by `new SaveStateClient(...)`.
 */
export interface SaveStateClientOptions {
  /**
   * Encryption passphrase. Used to encrypt/decrypt snapshots.
   * Falls back to `process.env.SAVESTATE_PASSPHRASE` if omitted.
   */
  passphrase?: string;
  /**
   * Storage configuration. Currently `local` is supported directly;
   * cloud storage flows through `savestate cloud push/pull` (Pro tier).
   */
  storage?: StorageConfig | { type: 'local'; path?: string };
  /**
   * Optional pre-built `StorageBackend`. Takes precedence over `storage`.
   * Useful for tests and custom backends.
   */
  storageBackend?: StorageBackend;
  /**
   * Optional path for the local SQLite-backed memory store.
   * Defaults to `~/.savestate/memory.db`.
   */
  memoryDbPath?: string;
}

export interface SnapshotOptions {
  /** Adapter id (e.g. 'claude-code') OR an `Adapter` instance. */
  adapter: string | Adapter;
  label?: string;
  tags?: string[];
  parentId?: string;
  /** Force a full snapshot even if an incremental delta is possible. */
  full?: boolean;
}

export interface RestoreOptions {
  /** Adapter id or instance to push the snapshot back into. */
  adapter: string | Adapter;
  include?: ('identity' | 'memory' | 'conversations')[];
  dryRun?: boolean;
}

export interface ListOptions {
  since?: string;
  until?: string;
  adapter?: string;
  tag?: string;
}

export interface SearchOptions {
  /** Restrict to specific snapshot IDs. */
  snapshots?: string[];
  /** Filter result types. */
  types?: Array<'memory' | 'conversation' | 'identity' | 'knowledge'>;
  /** Maximum number of results. */
  limit?: number;
}

/**
 * Live, SQLite-backed memory store handle (NOT a snapshot).
 * Surfaces the runtime memory layer used by the MCP server and other
 * agent integrations.
 */
export interface MemoryHandle {
  add(
    entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MemoryEntry>;
  get(id: string): Promise<MemoryEntry | null>;
  update(
    id: string,
    updates: Partial<MemoryEntry>,
  ): Promise<MemoryEntry | null>;
  delete(id: string): boolean;
  search(query?: MemoryQuery): Promise<MemoryEntry[]>;
  stats(): MemoryStats;
}

function resolveAdapter(adapter: string | Adapter): Adapter {
  if (typeof adapter !== 'string') return adapter;
  const found = getAdapter(adapter);
  if (!found) {
    throw new Error(
      `Unknown adapter '${adapter}'. Pass an Adapter instance or use a registered id.`,
    );
  }
  return found;
}

function toStorageConfig(
  storage: SaveStateClientOptions['storage'],
): StorageConfig {
  if (!storage) return { type: 'local', options: {} };
  if (storage.type === 'local') {
    // Allow the shorthand { type: 'local', path: '...' }.
    const maybePath = (storage as { path?: string }).path;
    if (maybePath !== undefined) {
      return { type: 'local', options: { path: maybePath } } as StorageConfig;
    }
  }
  return storage as StorageConfig;
}

export class SaveStateClient {
  private readonly passphraseValue?: string;
  private readonly storageConfig: StorageConfig;
  private readonly storage: StorageBackend;
  private readonly memoryDbPath?: string;
  private memoryStore?: MemoryStore;

  constructor(options: SaveStateClientOptions = {}) {
    this.passphraseValue = options.passphrase;
    this.storageConfig = toStorageConfig(options.storage);
    this.memoryDbPath = options.memoryDbPath;

    if (options.storageBackend) {
      this.storage = options.storageBackend;
    } else if (this.storageConfig.type === 'local') {
      this.storage = new LocalStorageBackend({
        path: (this.storageConfig.options as { path?: string }).path,
      });
    } else {
      // Defer to the engine resolver for any non-local config it knows.
      this.storage = resolveStorage(this.config());
    }
  }

  /**
   * Resolve a passphrase, throwing a single, clear error if none is
   * available. Centralized so every operation surfaces the same message.
   */
  private passphrase(): string {
    const pass = this.passphraseValue ?? process.env.SAVESTATE_PASSPHRASE;
    if (!pass) {
      throw new Error(
        'No passphrase available. Pass `passphrase` to SaveStateClient or set SAVESTATE_PASSPHRASE.',
      );
    }
    return pass;
  }

  /**
   * Build the SaveStateConfig the engine expects. Adapters list is empty
   * because the SDK resolves adapters per-call rather than from config.
   */
  private config(): SaveStateConfig {
    return {
      version: '1',
      storage: this.storageConfig,
      adapters: [],
    } as SaveStateConfig;
  }

  /**
   * Create a snapshot of the given adapter's state and store it
   * encrypted in the configured storage backend.
   */
  async snapshot(options: SnapshotOptions): Promise<CreateSnapshotResult> {
    const adapter = resolveAdapter(options.adapter);
    return createSnapshot(adapter, this.storage, this.passphrase(), {
      label: options.label,
      tags: options.tags,
      parentId: options.parentId,
      full: options.full,
    });
  }

  /**
   * Restore a snapshot back into the live platform via its adapter.
   */
  async restore(
    snapshotId: string,
    options: RestoreOptions,
  ): Promise<RestoreResult> {
    const adapter = resolveAdapter(options.adapter);
    return restoreSnapshot(snapshotId, adapter, this.storage, this.passphrase(), {
      include: options.include,
      dryRun: options.dryRun,
    });
  }

  /**
   * Search across snapshot contents (memories, identity, conversations,
   * knowledge). Decrypts on the fly; results are scored.
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    return searchSnapshots(query, this.config(), {
      passphrase: this.passphrase(),
      snapshots: options.snapshots,
      types: options.types,
      limit: options.limit,
    });
  }

  /**
   * List indexed snapshots, optionally filtered.
   */
  async list(options: ListOptions = {}): Promise<SnapshotIndexEntry[]> {
    const index = await loadIndex();
    return applyListFilters(index.snapshots, options);
  }

  /**
   * Aggregate stats across all snapshots (count, span, cadence, mix).
   */
  async stats(): Promise<ReturnType<typeof computeStats>> {
    const index = await loadIndex();
    return computeStats(index.snapshots);
  }

  /**
   * Open the live SQLite-backed memory store. Lazily instantiated; the
   * same handle is returned on subsequent calls so callers can share a
   * single DB connection across an agent's lifetime.
   */
  memory(): MemoryHandle {
    if (!this.memoryStore) {
      this.memoryStore = new MemoryStore({ dbPath: this.memoryDbPath });
    }
    const store = this.memoryStore;
    return {
      add: (entry) => store.create(entry),
      get: (id) => store.get(id),
      update: (id, updates) => store.update(id, updates),
      delete: (id) => store.delete(id),
      search: (query = {}) => store.query(query),
      stats: () => store.getStats(),
    };
  }
}
