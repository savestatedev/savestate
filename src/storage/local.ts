/**
 * Local Filesystem Storage Backend
 *
 * Default backend. Stores encrypted archives at ~/.savestate/snapshots/
 * or a user-configured directory.
 *
 * Issue #126: Added write verification and atomic operations
 */

import { readFile, writeFile, readdir, unlink, mkdir, stat, rename } from 'node:fs/promises';
import { existsSync, createWriteStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { createHash, randomBytes } from 'node:crypto';
import type { StorageBackend } from '../types.js';

const DEFAULT_BASE_DIR = join(homedir(), '.savestate', 'snapshots');

/**
 * Write verification result
 */
export interface WriteVerification {
  success: boolean;
  key: string;
  expectedHash: string;
  actualHash: string;
  size: number;
  timestamp: string;
}

export class LocalStorageBackend implements StorageBackend {
  readonly id = 'local';
  private readonly baseDir: string;

  constructor(options?: { path?: string }) {
    this.baseDir = options?.path ?? DEFAULT_BASE_DIR;
  }

  private resolvePath(key: string): string {
    // Prevent path traversal
    const sanitized = key.replace(/\.\./g, '').replace(/^\//, '');
    return join(this.baseDir, sanitized);
  }

  private async ensureDir(): Promise<void> {
    if (!existsSync(this.baseDir)) {
      await mkdir(this.baseDir, { recursive: true });
    }
  }

  /**
   * Store data with atomic write and verification.
   *
   * Issue #126: Uses temp file + rename for atomicity, then verifies
   * the write by reading back and comparing hash.
   */
  async put(key: string, data: Buffer): Promise<void> {
    await this.ensureDir();
    const filePath = this.resolvePath(key);
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });

    // Compute expected hash before writing
    const expectedHash = createHash('sha256').update(data).digest('hex');

    // Use temp file + atomic rename for crash safety
    const tempPath = `${filePath}.tmp.${randomBytes(4).toString('hex')}`;
    try {
      await writeFile(tempPath, data);
      await rename(tempPath, filePath);
    } catch (err) {
      // Clean up temp file on failure
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw new Error(
        `Storage write failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Verify write by reading back and comparing hash
    const verification = await this.verifyWrite(key, expectedHash, data.length);
    if (!verification.success) {
      throw new Error(
        `Write verification failed for key "${key}": ` +
        `expected hash ${verification.expectedHash}, got ${verification.actualHash}`
      );
    }
  }

  /**
   * Verify a write operation by reading back and comparing hash.
   *
   * Issue #126: Ensures data was actually persisted correctly.
   */
  async verifyWrite(key: string, expectedHash: string, expectedSize: number): Promise<WriteVerification> {
    const filePath = this.resolvePath(key);
    const timestamp = new Date().toISOString();

    try {
      const readBack = await readFile(filePath);

      if (readBack.length !== expectedSize) {
        return {
          success: false,
          key,
          expectedHash,
          actualHash: `size_mismatch:${readBack.length}`,
          size: readBack.length,
          timestamp,
        };
      }

      const actualHash = createHash('sha256').update(readBack).digest('hex');
      const success = actualHash === expectedHash;

      return {
        success,
        key,
        expectedHash,
        actualHash,
        size: readBack.length,
        timestamp,
      };
    } catch (err) {
      return {
        success: false,
        key,
        expectedHash,
        actualHash: `read_error:${err instanceof Error ? err.message : String(err)}`,
        size: 0,
        timestamp,
      };
    }
  }

  async get(key: string): Promise<Buffer> {
    const filePath = this.resolvePath(key);
    return readFile(filePath);
  }

  async list(prefix?: string): Promise<string[]> {
    await this.ensureDir();
    const entries = await readdir(this.baseDir, { recursive: true });
    const keys = entries.map((e) => String(e));
    if (prefix) {
      return keys.filter((k) => k.startsWith(prefix));
    }
    return keys;
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    await unlink(filePath);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.resolvePath(key);
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
