/**
 * Clawdbot Adapter
 *
 * First-party adapter for Clawdbot / Moltbot workspaces.
 * Reads SOUL.md, MEMORY.md, memory/, USER.md, TOOLS.md,
 * conversation logs, and other workspace files.
 *
 * This is the dogfood adapter — SaveState eats its own cooking.
 */

import { readFile, writeFile, readdir, stat, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { Adapter, PlatformMeta, Snapshot, MemoryEntry, ConversationMeta } from '../types.js';
import { SAF_VERSION, generateSnapshotId, computeChecksum } from '../format.js';

/** Files that constitute the agent's identity */
const IDENTITY_FILES = ['SOUL.md', 'USER.md', 'AGENTS.md', 'TOOLS.md'];

/** Directories containing memory data */
const MEMORY_DIRS = ['memory'];

/** Files containing memory data */
const MEMORY_FILES = ['memory.md', 'MEMORY.md'];

/** Separator used in concatenated personality */
const FILE_SEPARATOR_PREFIX = '--- ';
const FILE_SEPARATOR_SUFFIX = ' ---';

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
    // Restore identity files from concatenated personality
    if (snapshot.identity.personality) {
      await this.restoreIdentity(snapshot.identity.personality);
    }

    // Restore memory files
    await this.restoreMemory(snapshot.memory.core);
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

  // ─── Restore helpers ──────────────────────────────────────

  /**
   * Parse concatenated personality back into individual files and write them.
   * Files are joined with `--- FILENAME ---` markers.
   */
  private async restoreIdentity(personality: string): Promise<void> {
    const files = this.parsePersonality(personality);

    for (const [filename, content] of files) {
      const targetPath = join(this.workspaceDir, filename);

      // Backup existing file
      await this.backupFile(targetPath);

      // Write restored content
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, content, 'utf-8');
    }
  }

  /**
   * Parse the concatenated personality string into individual files.
   * Format: `--- FILENAME ---\ncontent\n\n--- NEXTFILE ---\ncontent`
   */
  private parsePersonality(personality: string): Map<string, string> {
    const files = new Map<string, string>();
    const regex = /^--- (.+?) ---$/gm;
    const matches = [...personality.matchAll(regex)];

    for (let i = 0; i < matches.length; i++) {
      const filename = matches[i][1];
      const startIdx = matches[i].index! + matches[i][0].length + 1; // +1 for newline
      const endIdx = i + 1 < matches.length ? matches[i + 1].index! : personality.length;

      let content = personality.slice(startIdx, endIdx);
      // Trim trailing newlines between sections (but keep content intact)
      content = content.replace(/\n\n$/, '\n');
      if (!content.endsWith('\n')) content += '\n';

      files.set(filename, content);
    }

    return files;
  }

  /**
   * Restore memory entries back to their source files.
   */
  private async restoreMemory(entries: MemoryEntry[]): Promise<void> {
    for (const entry of entries) {
      const targetPath = join(this.workspaceDir, entry.source);

      // Backup existing file
      await this.backupFile(targetPath);

      // Ensure directory exists
      await mkdir(dirname(targetPath), { recursive: true });

      // Write restored content
      await writeFile(targetPath, entry.content, 'utf-8');
    }
  }

  /**
   * Create a .bak backup of an existing file before overwriting.
   */
  private async backupFile(filePath: string): Promise<void> {
    if (existsSync(filePath)) {
      const backupPath = filePath + '.bak';
      try {
        await rename(filePath, backupPath);
      } catch {
        // If rename fails (e.g., permissions), continue without backup
      }
    }
  }
}
