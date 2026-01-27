/**
 * Storage Backend Resolver
 *
 * Creates a storage backend instance from config.
 */

import type { SaveStateConfig, StorageBackend } from '../types.js';
import { LocalStorageBackend } from './local.js';

/**
 * Create a storage backend from the config's storage section.
 */
export function resolveStorage(config: SaveStateConfig): StorageBackend {
  switch (config.storage.type) {
    case 'local':
      return new LocalStorageBackend({
        path: config.storage.options.path as string | undefined,
      });

    default:
      throw new Error(
        `Unknown storage backend: ${config.storage.type}. ` +
        `Supported: local. S3/R2/B2 coming soon.`,
      );
  }
}
