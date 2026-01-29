/**
 * Storage Backend Resolver
 *
 * Creates a storage backend instance from config.
 * Cloud storage (S3/R2/B2) requires Pro or Team subscription.
 */

import type { SaveStateConfig, StorageBackend } from '../types.js';
import { LocalStorageBackend } from './local.js';

/**
 * Create a storage backend from the config's storage section.
 * 
 * Note: Direct cloud storage (s3/r2/b2) has been removed from the CLI.
 * Use `savestate cloud push/pull` for cloud backups (requires Pro subscription).
 */
export function resolveStorage(config: SaveStateConfig): StorageBackend {
  const { type, options } = config.storage;

  switch (type) {
    case 'local':
      return new LocalStorageBackend({
        path: options.path as string | undefined,
      });

    case 's3':
    case 'r2':
    case 'b2':
      throw new Error(
        `Direct cloud storage (${type}) has been removed.\n\n` +
        `Cloud backups are now managed through the SaveState API:\n` +
        `  savestate cloud push     Push local snapshots to cloud (Pro)\n` +
        `  savestate cloud pull     Pull snapshots from cloud (Pro)\n` +
        `  savestate cloud list     List cloud snapshots (Pro)\n\n` +
        `Upgrade at: https://savestate.dev/#pricing`
      );

    default:
      throw new Error(
        `Unknown storage backend: ${type}. ` +
        `Supported: local (use 'savestate cloud' for cloud storage).`,
      );
  }
}
