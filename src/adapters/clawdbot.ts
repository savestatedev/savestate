/**
 * Clawdbot Adapter
 *
 * First-party adapter for Clawdbot / Moltbot workspaces.
 * Reads SOUL.md, MEMORY.md, memory/, USER.md, TOOLS.md,
 * conversation logs, and other workspace files.
 *
 * This is the dogfood adapter — SaveState eats its own cooking.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Adapter, PlatformMeta, Snapshot, MemoryEntry, ConversationMeta } from '../types.js';
import { SAF_VERSION, generateSnapshotId, computeChecksum } from '../format.js';

/** Files that constitute the agent's identity */
const IDENTITY_FILES = ['SOUL.md', 'USER.md', 'AGENTS.md', 'TOOLS.md'];

/** Directories containing memory data */
const MEMORY_DIRS = ['memory'];

/** Files containing memory data */
const MEMORY_FILES = ['memory.md', 'MEMORY.md'];

export class ClawdbotAdapter implements Adapter {
  readonly id = 'clawdbot';
  readonly name = 'Clawdbot';
  readonly platform = 'clawdbot';
  readonly version = '0.1.0';

  private readonly workspaceDir: string;

  constructor(workspaceDir?: string) {
    this.workspaceDir = workspaceDir ?? process.cwd();
  }

  async detect(): Promise<boolean> {
    // Detect by looking for characteristic files
    const markers = ['SOUL.md', 'memory.md', 'AGENTS.md', 'memory/'];
    for (const marker of markers) {
      if (existsSync(join(this.workspaceDir, marker))) {
        return true;
      }
    }
    return false;
  }

  async extract(): Promise<Snapshot> {
    const personality = await this.readIdentity();
    const memoryEntries = await this.readMemory();
    const conversations = await this.readConversations();

    const snapshotId = generateSnapshotId();
    const now = new Date().toISOString();

    const snapshot: Snapshot = {
      manifest: {
        version: SAF_VERSION,
        timestamp: now,
        id: snapshotId,
        platform: this.platform,
        adapter: this.id,
        checksum: '', // Computed during packing
        size: 0,      // Computed during packing
      },
      identity: {
        personality,
        config: await this.readJsonSafe(join(this.workspaceDir, '.savestate', 'agent-config.json')),
        tools: [],
      },
      memory: {
        core: memoryEntries,
        knowledge: [],
      },
      conversations: {
        total: conversations.length,
        conversations,
      },
      platform: await this.identify(),
      chain: {
        current: snapshotId,
        ancestors: [],
      },
      restoreHints: {
        platform: this.platform,
        steps: [
          {
            type: 'file',
            description: 'Restore SOUL.md and identity files',
            target: 'identity/',
          },
          {
            type: 'file',
            description: 'Restore memory files',
            target: 'memory/',
          },
        ],
      },
    };

    return snapshot;
  }

  async restore(snapshot: Snapshot): Promise<void> {
    // TODO: Write identity files back to workspace
    // TODO: Write memory files back to workspace
    // TODO: Handle merge conflicts
    void snapshot;
  }

  async identify(): Promise<PlatformMeta> {
    return {
      name: 'Clawdbot',
      version: this.version,
      exportMethod: 'direct-file-access',
    };
  }

  // ─── Private helpers ─────────────────────────────────────

  private async readIdentity(): Promise<string> {
    const parts: string[] = [];
    for (const file of IDENTITY_FILES) {
      const path = join(this.workspaceDir, file);
      if (existsSync(path)) {
        const content = await readFile(path, 'utf-8');
        parts.push(`--- ${file} ---\n${content}`);
      }
    }
    return parts.join('\n\n');
  }

  private async readMemory(): Promise<MemoryEntry[]> {
    const entries: MemoryEntry[] = [];

    // Read standalone memory files
    for (const file of MEMORY_FILES) {
      const path = join(this.workspaceDir, file);
      if (existsSync(path)) {
        const content = await readFile(path, 'utf-8');
        const fileStat = await stat(path);
        entries.push({
          id: `file:${file}`,
          content,
          source: file,
          createdAt: fileStat.birthtime.toISOString(),
          updatedAt: fileStat.mtime.toISOString(),
        });
      }
    }

    // Read memory directory
    for (const dir of MEMORY_DIRS) {
      const dirPath = join(this.workspaceDir, dir);
      if (existsSync(dirPath)) {
        const files = await readdir(dirPath);
        for (const file of files) {
          if (file.endsWith('.md') || file.endsWith('.json')) {
            const filePath = join(dirPath, file);
            const content = await readFile(filePath, 'utf-8');
            const fileStat = await stat(filePath);
            entries.push({
              id: `file:${dir}/${file}`,
              content,
              source: `${dir}/${file}`,
              createdAt: fileStat.birthtime.toISOString(),
              updatedAt: fileStat.mtime.toISOString(),
            });
          }
        }
      }
    }

    return entries;
  }

  private async readConversations(): Promise<ConversationMeta[]> {
    // TODO: Read conversation logs from the workspace
    // Clawdbot stores conversations in various formats depending on config
    return [];
  }

  private async readJsonSafe(path: string): Promise<Record<string, unknown> | undefined> {
    try {
      const content = await readFile(path, 'utf-8');
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
}
