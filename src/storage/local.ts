/**
 * Local Filesystem Storage Backend
 *
 * Default backend. Stores encrypted archives at ~/.savestate/snapshots/
 * or a user-configured directory.
 */

import { readFile, writeFile, readdir, unlink, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { StorageBackend } from '../types.js';

const DEFAULT_BASE_DIR = join(homedir(), '.savestate', 'snapshots');

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

  async put(key: string, data: Buffer): Promise<void> {
    await this.ensureDir();
    const filePath = this.resolvePath(key);
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, data);
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
