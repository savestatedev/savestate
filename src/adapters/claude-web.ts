/**
 * Claude Web (claude.ai) Adapter
 *
 * Adapter for Claude consumer web interface (claude.ai).
 * This is DIFFERENT from the claude-code adapter which handles
 * Claude Code CLI projects. This adapter handles:
 *
 * - Claude.ai data export (conversations, account info)
 * - Claude memory export (text/markdown memories)
 * - Claude Projects (instructions, uploaded files, conversations)
 *
 * Data sources:
 * 1. SAVESTATE_CLAUDE_EXPORT env var → export directory
 * 2. claude-export/ in current directory
 * 3. .savestate/imports/claude/ directory
 * 4. Standalone memory file (claude-memories.md or .txt)
 *
 * Export format (Anthropic data export):
 *   conversations/ — JSON files per conversation
 *   account_info.json — user profile
 *   projects/ — project data (instructions, files)
 *
 * Conversation JSON format:
 *   { uuid, name, created_at, updated_at, chat_messages: [{ uuid, text, sender, created_at, attachments, files }] }
 */

import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import type {
  Adapter,
  PlatformMeta,
  Snapshot,
  MemoryEntry,
  KnowledgeDocument,
  ConversationMeta,
  Conversation,
  Message,
} from '../types.js';
import { SAF_VERSION, generateSnapshotId, computeChecksum } from '../format.js';

// ─── Types for Claude.ai export data ────────────────────────

interface ClaudeConversation {
  uuid?: string;
  name?: string;
  created_at?: string;
  updated_at?: string;
  chat_messages?: ClaudeChatMessage[];
  // Some exports may use alternate field names
  id?: string;
  title?: string;
  messages?: ClaudeChatMessage[];
}

interface ClaudeChatMessage {
  uuid?: string;
  id?: string;
  text?: string;
  content?: string;
  sender?: string;
  role?: string;
  created_at?: string;
  timestamp?: string;
  attachments?: ClaudeAttachment[];
  files?: ClaudeFileRef[];
}

interface ClaudeAttachment {
  file_name?: string;
  file_type?: string;
  file_size?: number;
  extracted_content?: string;
}

interface ClaudeFileRef {
  file_name?: string;
  file_id?: string;
}

interface ClaudeAccountInfo {
  uuid?: string;
  email?: string;
  full_name?: string;
  created_at?: string;
  // Handle flexible shape
  [key: string]: unknown;
}

interface ClaudeProject {
  uuid?: string;
  name?: string;
  description?: string;
  instructions?: string;
  created_at?: string;
  updated_at?: string;
  files?: ClaudeProjectFile[];
  conversations?: ClaudeConversation[];
}

interface ClaudeProjectFile {
  file_name?: string;
  content?: string;
  file_type?: string;
  file_size?: number;
}

// ─── Constants ───────────────────────────────────────────────

/** Possible export directory names to search for */
const EXPORT_DIR_CANDIDATES = [
  'claude-export',
  'claude_export',
  'claude-data-export',
  'claude_data_export',
];

/** Possible memory file names */
const MEMORY_FILE_CANDIDATES = [
  'claude-memories.md',
  'claude-memories.txt',
  'claude_memories.md',
  'claude_memories.txt',
  'memories.md',
  'memories.txt',
];

/** Maximum file size to read (5MB for export files) */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export class ClaudeWebAdapter implements Adapter {
  readonly id = 'claude-web';
  readonly name = 'Claude Web (claude.ai)';
  readonly platform = 'claude-web';
  readonly version = '0.1.0';

  private exportDir: string | null = null;
  private memoryFile: string | null = null;
  private baseDir: string;
  private warnings: string[] = [];

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? process.cwd();
  }

  async detect(): Promise<boolean> {
    const result = await this.findDataSources();
    return result.found;
  }

  async extract(): Promise<Snapshot> {
    this.warnings = [];

    const sources = await this.findDataSources();
    if (!sources.found) {
      throw new Error(
        'No Claude.ai data found. Set SAVESTATE_CLAUDE_EXPORT to your export directory, ' +
        'place export in claude-export/, or provide a claude-memories.md file.'
      );
    }

    this.exportDir = sources.exportDir;
    this.memoryFile = sources.memoryFile;

    // Extract all data
    const accountInfo = await this.readAccountInfo();
    const conversations = await this.readConversations();
    const memoryEntries = await this.readMemories();
    const projects = await this.readProjects();
    const knowledge = this.buildKnowledge(projects);

    // Build personality from project instructions
    const personality = this.buildPersonality(projects);

    const snapshotId = generateSnapshotId();
    const now = new Date().toISOString();

    // Report findings
    const convoCount = conversations.length;
    const memoryCount = memoryEntries.length;
    const projectCount = projects.length;
    console.log(`  Found ${convoCount} conversations, ${memoryCount} memories, ${projectCount} projects`);

    if (this.warnings.length > 0) {
      for (const w of this.warnings) {
        console.warn(`  ⚠ ${w}`);
      }
    }

    // Build conversation index
    const conversationIndex: ConversationMeta[] = conversations.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c.messages.length,
      path: `conversations/${c.id}.json`,
    }));

    const snapshot: Snapshot = {
      manifest: {
        version: SAF_VERSION,
        timestamp: now,
        id: snapshotId,
        platform: this.platform,
        adapter: this.id,
        checksum: '',
        size: 0,
      },
      identity: {
        personality: personality || undefined,
        config: accountInfo ? { accountInfo } : undefined,
        tools: [],
      },
      memory: {
        core: memoryEntries,
        knowledge,
      },
      conversations: {
        total: conversationIndex.length,
        conversations: conversationIndex,
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
            type: 'manual',
            description: 'Import memories via Claude.ai Settings → Memory',
            target: 'memory/',
          },
          {
            type: 'manual',
            description: 'Create Claude Projects with restored instructions and files',
            target: 'identity/',
          },
          {
            type: 'file',
            description: 'Generate claude-restore-guide.md with organized restore instructions',
            target: 'claude-restore-guide.md',
          },
        ],
        manualSteps: [
          'Claude.ai does not support automated restore — data must be manually re-entered',
          'Memories: Copy each memory entry from the restore guide into Claude.ai Settings → Memory',
          'Projects: Create new Projects in Claude.ai and paste instructions + upload files',
          'Conversations: Cannot be restored (read-only history)',
        ],
      },
    };

    return snapshot;
  }

  async restore(snapshot: Snapshot): Promise<void> {
    // Claude consumer has limited restore capabilities.
    // Generate a comprehensive restore guide for manual import.
    const restoreDir = join(this.baseDir, '.savestate', 'restore', 'claude-web');
    await mkdir(restoreDir, { recursive: true });

    const guide = this.generateRestoreGuide(snapshot);
    const guidePath = join(restoreDir, 'claude-restore-guide.md');
    await writeFile(guidePath, guide, 'utf-8');

    // Export memories as a standalone file for easy copy-paste
    if (snapshot.memory.core.length > 0) {
      const memoriesContent = this.formatMemoriesForRestore(snapshot.memory.core);
      const memoriesPath = join(restoreDir, 'memories-to-import.md');
      await writeFile(memoriesPath, memoriesContent, 'utf-8');
      console.log(`  📝 Memories file: ${memoriesPath}`);
    }

    // Export project instructions as individual files
    if (snapshot.identity.personality) {
      const projectsDir = join(restoreDir, 'projects');
      await mkdir(projectsDir, { recursive: true });
      const instructionsPath = join(projectsDir, 'project-instructions.md');
      await writeFile(instructionsPath, snapshot.identity.personality, 'utf-8');
      console.log(`  📋 Project instructions: ${instructionsPath}`);
    }

    console.log(`  📖 Restore guide: ${guidePath}`);
    console.log();
    console.log('  ℹ️  Claude.ai requires manual restore. See the guide for step-by-step instructions.');
  }

  async identify(): Promise<PlatformMeta> {
    const accountInfo = await this.readAccountInfo();
    return {
      name: 'Claude Web (claude.ai)',
      version: 'consumer',
      exportMethod: 'data-export',
      accountId: accountInfo?.uuid ?? accountInfo?.email ?? undefined,
    };
  }

  // ─── Private: Data Source Discovery ───────────────────────

  private async findDataSources(): Promise<{
    found: boolean;
    exportDir: string | null;
    memoryFile: string | null;
  }> {
    let exportDir: string | null = null;
    let memoryFile: string | null = null;

    // 1. Check SAVESTATE_CLAUDE_EXPORT env var
    const envDir = process.env.SAVESTATE_CLAUDE_EXPORT;
    if (envDir && existsSync(envDir)) {
      const s = await stat(envDir).catch(() => null);
      if (s?.isDirectory()) {
        exportDir = envDir;
      }
    }

    // 2. Check standard directory names in current dir
    if (!exportDir) {
      for (const candidate of EXPORT_DIR_CANDIDATES) {
        const candidatePath = join(this.baseDir, candidate);
        if (existsSync(candidatePath)) {
          const s = await stat(candidatePath).catch(() => null);
          if (s?.isDirectory()) {
            exportDir = candidatePath;
            break;
          }
        }
      }
    }

    // 3. Check .savestate/imports/claude/
    if (!exportDir) {
      const importsDir = join(this.baseDir, '.savestate', 'imports', 'claude');
      if (existsSync(importsDir)) {
        const s = await stat(importsDir).catch(() => null);
        if (s?.isDirectory()) {
          exportDir = importsDir;
        }
      }
    }

    // 4. Check for standalone memory file
    for (const candidate of MEMORY_FILE_CANDIDATES) {
      // Check in base dir
      const basePath = join(this.baseDir, candidate);
      if (existsSync(basePath)) {
        memoryFile = basePath;
        break;
      }
      // Check in export dir if found
      if (exportDir) {
        const exportPath = join(exportDir, candidate);
        if (existsSync(exportPath)) {
          memoryFile = exportPath;
          break;
        }
      }
      // Check in .savestate/imports/claude/
      const importPath = join(this.baseDir, '.savestate', 'imports', 'claude', candidate);
      if (existsSync(importPath)) {
        memoryFile = importPath;
        break;
      }
    }

    return {
      found: exportDir !== null || memoryFile !== null,
      exportDir,
      memoryFile,
    };
  }

  // ─── Private: Account Info ────────────────────────────────

  private async readAccountInfo(): Promise<ClaudeAccountInfo | null> {
    if (!this.exportDir) return null;

    const candidates = ['account_info.json', 'account.json', 'profile.json'];
    for (const filename of candidates) {
      const filePath = join(this.exportDir, filename);
      if (existsSync(filePath)) {
        const content = await this.safeReadFile(filePath);
        if (content) {
          try {
            return JSON.parse(content) as ClaudeAccountInfo;
          } catch {
            this.warnings.push(`Failed to parse ${filename}`);
          }
        }
      }
    }

    return null;
  }

  // ─── Private: Conversations ───────────────────────────────

  private async readConversations(): Promise<Conversation[]> {
    if (!this.exportDir) return [];

    const conversations: Conversation[] = [];

    // Look for conversations/ directory
    const convDirCandidates = ['conversations', 'chats'];
    for (const dirName of convDirCandidates) {
      const convDir = join(this.exportDir, dirName);
      if (!existsSync(convDir)) continue;

      const s = await stat(convDir).catch(() => null);
      if (!s?.isDirectory()) continue;

      const files = await readdir(convDir).catch(() => []);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const filePath = join(convDir, file);
        const parsed = await this.parseConversationFile(filePath);
        if (parsed) {
          conversations.push(parsed);
        }
      }
    }

    // Also check if there's a single conversations.json file (some export formats)
    const singleFile = join(this.exportDir, 'conversations.json');
    if (existsSync(singleFile) && conversations.length === 0) {
      const content = await this.safeReadFile(singleFile);
      if (content) {
        try {
          const data = JSON.parse(content);
          // Could be an array of conversations
          if (Array.isArray(data)) {
            for (const raw of data) {
              const parsed = this.parseConversationObject(raw);
              if (parsed) {
                conversations.push(parsed);
              }
            }
          }
        } catch {
          this.warnings.push('Failed to parse conversations.json');
        }
      }
    }

    return conversations;
  }

  private async parseConversationFile(filePath: string): Promise<Conversation | null> {
    const content = await this.safeReadFile(filePath);
    if (!content) return null;

    try {
      const raw = JSON.parse(content) as ClaudeConversation;
      return this.parseConversationObject(raw);
    } catch {
      this.warnings.push(`Failed to parse conversation: ${basename(filePath)}`);
      return null;
    }
  }

  private parseConversationObject(raw: ClaudeConversation): Conversation | null {
    if (!raw) return null;

    const id = raw.uuid ?? raw.id ?? `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const title = raw.name ?? raw.title ?? undefined;
    const createdAt = raw.created_at ?? new Date().toISOString();
    const updatedAt = raw.updated_at ?? createdAt;

    // Handle both "chat_messages" and "messages" field names
    const rawMessages = raw.chat_messages ?? raw.messages ?? [];
    const messages: Message[] = [];

    for (const msg of rawMessages) {
      const parsed = this.parseMessage(msg);
      if (parsed) {
        messages.push(parsed);
      }
    }

    if (messages.length === 0) return null;

    return { id, title, createdAt, updatedAt, messages };
  }

  private parseMessage(msg: ClaudeChatMessage): Message | null {
    if (!msg) return null;

    const id = msg.uuid ?? msg.id ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const text = msg.text ?? msg.content ?? '';

    if (!text && (!msg.attachments || msg.attachments.length === 0)) {
      return null; // Skip empty messages
    }

    // Map Claude's sender field to SaveState roles
    const rawRole = msg.sender ?? msg.role ?? 'user';
    const role = this.mapRole(rawRole);

    const timestamp = msg.created_at ?? msg.timestamp ?? new Date().toISOString();

    // Build content including attachment references
    let content = text;
    if (msg.attachments && msg.attachments.length > 0) {
      const attachmentTexts = msg.attachments
        .filter((a) => a.extracted_content)
        .map((a) => `\n[Attachment: ${a.file_name ?? 'unknown'}]\n${a.extracted_content}`);
      if (attachmentTexts.length > 0) {
        content += attachmentTexts.join('\n');
      }
    }

    // Build metadata for file references
    const metadata: Record<string, unknown> = {};
    if (msg.attachments && msg.attachments.length > 0) {
      metadata.attachments = msg.attachments.map((a) => ({
        fileName: a.file_name,
        fileType: a.file_type,
        fileSize: a.file_size,
      }));
    }
    if (msg.files && msg.files.length > 0) {
      metadata.files = msg.files.map((f) => ({
        fileName: f.file_name,
        fileId: f.file_id,
      }));
    }

    return {
      id,
      role,
      content,
      timestamp,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  /**
   * Map Claude's sender/role names to SaveState standard roles.
   * Claude uses "human"/"assistant", SaveState uses "user"/"assistant".
   */
  private mapRole(role: string): 'user' | 'assistant' | 'system' | 'tool' {
    const normalized = role.toLowerCase().trim();
    switch (normalized) {
      case 'human':
      case 'user':
        return 'user';
      case 'assistant':
      case 'claude':
      case 'ai':
        return 'assistant';
      case 'system':
        return 'system';
      case 'tool':
      case 'tool_result':
        return 'tool';
      default:
        return 'user';
    }
  }

  // ─── Private: Memories ────────────────────────────────────

  private async readMemories(): Promise<MemoryEntry[]> {
    const entries: MemoryEntry[] = [];

    // 1. Read standalone memory file
    if (this.memoryFile) {
      const parsed = await this.parseMemoryFile(this.memoryFile);
      entries.push(...parsed);
    }

    // 2. Look for memory files in export directory
    if (this.exportDir) {
      for (const candidate of MEMORY_FILE_CANDIDATES) {
        const filePath = join(this.exportDir, candidate);
        // Skip if this is the same as the standalone memory file
        if (this.memoryFile && filePath === this.memoryFile) continue;
        if (existsSync(filePath)) {
          const parsed = await this.parseMemoryFile(filePath);
          entries.push(...parsed);
        }
      }

      // Also check for a memories/ directory
      const memoriesDir = join(this.exportDir, 'memories');
      if (existsSync(memoriesDir)) {
        const s = await stat(memoriesDir).catch(() => null);
        if (s?.isDirectory()) {
          const files = await readdir(memoriesDir).catch(() => []);
          for (const file of files) {
            const filePath = join(memoriesDir, file);
            const ext = extname(file).toLowerCase();
            if (ext === '.json') {
              const jsonEntries = await this.parseMemoryJson(filePath);
              entries.push(...jsonEntries);
            } else if (ext === '.md' || ext === '.txt') {
              const textEntries = await this.parseMemoryFile(filePath);
              entries.push(...textEntries);
            }
          }
        }
      }
    }

    return entries;
  }

  /**
   * Parse a Claude memory text/markdown file.
   * Memories are typically one per line or separated by blank lines.
   * May have bullet points (- or *) or numbered entries.
   */
  private async parseMemoryFile(filePath: string): Promise<MemoryEntry[]> {
    const content = await this.safeReadFile(filePath);
    if (!content) return [];

    const entries: MemoryEntry[] = [];
    const fileStat = await stat(filePath).catch(() => null);
    const fileDate = fileStat?.mtime?.toISOString() ?? new Date().toISOString();
    const source = `claude-memory:${basename(filePath)}`;

    // Split into individual memory entries
    // Handle various formats: bullet lists, numbered lists, blank-line separated
    const lines = content.split('\n');
    let currentEntry = '';
    let entryIndex = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines (they separate entries) or headers
      if (!trimmed) {
        if (currentEntry.trim()) {
          entries.push(this.createMemoryEntry(currentEntry.trim(), source, fileDate, entryIndex));
          entryIndex++;
          currentEntry = '';
        }
        continue;
      }

      // Skip markdown headers (used as section dividers, not memories themselves)
      if (trimmed.startsWith('# ') || trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
        if (currentEntry.trim()) {
          entries.push(this.createMemoryEntry(currentEntry.trim(), source, fileDate, entryIndex));
          entryIndex++;
          currentEntry = '';
        }
        continue;
      }

      // Check if this line starts a new entry (bullet or numbered list)
      const isBullet = /^[-*•]\s/.test(trimmed);
      const isNumbered = /^\d+[.)]\s/.test(trimmed);

      if ((isBullet || isNumbered) && currentEntry.trim()) {
        // Save previous entry and start new one
        entries.push(this.createMemoryEntry(currentEntry.trim(), source, fileDate, entryIndex));
        entryIndex++;
        // Strip the bullet/number prefix
        currentEntry = trimmed.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '');
      } else if (isBullet || isNumbered) {
        currentEntry = trimmed.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '');
      } else {
        // Continuation of current entry
        currentEntry += (currentEntry ? ' ' : '') + trimmed;
      }
    }

    // Don't forget the last entry
    if (currentEntry.trim()) {
      entries.push(this.createMemoryEntry(currentEntry.trim(), source, fileDate, entryIndex));
    }

    return entries;
  }

  private createMemoryEntry(
    content: string,
    source: string,
    date: string,
    index: number,
  ): MemoryEntry {
    return {
      id: `claude-memory-${index}`,
      content,
      source,
      createdAt: date,
      metadata: { platform: 'claude.ai' },
    };
  }

  /**
   * Parse a JSON memory file (if Claude exports memories in JSON format).
   */
  private async parseMemoryJson(filePath: string): Promise<MemoryEntry[]> {
    const content = await this.safeReadFile(filePath);
    if (!content) return [];

    try {
      const data = JSON.parse(content);
      const entries: MemoryEntry[] = [];

      // Handle array of memory objects
      const items = Array.isArray(data) ? data : (data.memories ?? data.items ?? []);
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (typeof item === 'string') {
          entries.push(this.createMemoryEntry(item, `claude-memory:${basename(filePath)}`, new Date().toISOString(), i));
        } else if (item && typeof item === 'object') {
          const text = item.content ?? item.text ?? item.memory ?? item.value ?? '';
          if (text) {
            entries.push({
              id: item.id ?? item.uuid ?? `claude-memory-${i}`,
              content: String(text),
              source: `claude-memory:${basename(filePath)}`,
              createdAt: item.created_at ?? item.createdAt ?? new Date().toISOString(),
              updatedAt: item.updated_at ?? item.updatedAt ?? undefined,
              metadata: { platform: 'claude.ai' },
            });
          }
        }
      }

      return entries;
    } catch {
      this.warnings.push(`Failed to parse memory JSON: ${basename(filePath)}`);
      return [];
    }
  }

  // ─── Private: Projects ────────────────────────────────────

  private async readProjects(): Promise<ClaudeProject[]> {
    if (!this.exportDir) return [];

    const projects: ClaudeProject[] = [];

    // Look for projects/ directory in export
    const projectsDirCandidates = ['projects', 'project'];
    for (const dirName of projectsDirCandidates) {
      const projectsDir = join(this.exportDir, dirName);
      if (!existsSync(projectsDir)) continue;

      const s = await stat(projectsDir).catch(() => null);
      if (!s?.isDirectory()) continue;

      const items = await readdir(projectsDir).catch(() => []);
      for (const item of items) {
        const itemPath = join(projectsDir, item);
        const itemStat = await stat(itemPath).catch(() => null);

        if (itemStat?.isDirectory()) {
          // Each subdirectory is a project
          const project = await this.parseProjectDir(itemPath, item);
          if (project) projects.push(project);
        } else if (item.endsWith('.json') && itemStat?.isFile()) {
          // JSON file might be a project export
          const project = await this.parseProjectJson(itemPath);
          if (project) projects.push(project);
        }
      }
    }

    return projects;
  }

  private async parseProjectDir(dirPath: string, name: string): Promise<ClaudeProject | null> {
    const project: ClaudeProject = {
      name,
      files: [],
    };

    // Look for instructions file
    const instructionCandidates = [
      'instructions.md',
      'instructions.txt',
      'system_prompt.md',
      'system_prompt.txt',
      'prompt.md',
    ];
    for (const candidate of instructionCandidates) {
      const filePath = join(dirPath, candidate);
      if (existsSync(filePath)) {
        const content = await this.safeReadFile(filePath);
        if (content) {
          project.instructions = content;
          break;
        }
      }
    }

    // Look for project metadata
    const metaPath = join(dirPath, 'project.json');
    if (existsSync(metaPath)) {
      const content = await this.safeReadFile(metaPath);
      if (content) {
        try {
          const meta = JSON.parse(content) as ClaudeProject;
          project.uuid = meta.uuid;
          project.description = meta.description;
          project.created_at = meta.created_at;
          project.updated_at = meta.updated_at;
          if (meta.instructions && !project.instructions) {
            project.instructions = meta.instructions;
          }
        } catch {
          this.warnings.push(`Failed to parse project metadata: ${name}`);
        }
      }
    }

    // Read uploaded files
    const filesDirCandidates = ['files', 'documents', 'uploads'];
    for (const filesDirName of filesDirCandidates) {
      const filesDir = join(dirPath, filesDirName);
      if (!existsSync(filesDir)) continue;

      const files = await readdir(filesDir).catch(() => []);
      for (const file of files) {
        const filePath = join(filesDir, file);
        const fileStat = await stat(filePath).catch(() => null);
        if (!fileStat?.isFile()) continue;

        const content = await this.safeReadFile(filePath);
        if (content !== null) {
          project.files?.push({
            file_name: file,
            content,
            file_type: this.guessFileType(file),
            file_size: fileStat.size,
          });
        }
      }
    }

    // Also read any loose text files in the project dir itself
    const items = await readdir(dirPath).catch(() => []);
    for (const item of items) {
      if (instructionCandidates.includes(item)) continue;
      if (item === 'project.json') continue;
      if (filesDirCandidates.includes(item)) continue;

      const itemPath = join(dirPath, item);
      const itemStat = await stat(itemPath).catch(() => null);
      if (!itemStat?.isFile()) continue;

      const ext = extname(item).toLowerCase();
      if (['.md', '.txt', '.csv', '.json', '.yaml', '.yml', '.xml'].includes(ext)) {
        const content = await this.safeReadFile(itemPath);
        if (content !== null) {
          project.files?.push({
            file_name: item,
            content,
            file_type: this.guessFileType(item),
            file_size: itemStat.size,
          });
        }
      }
    }

    // Only return project if it has any content
    if (project.instructions || (project.files && project.files.length > 0)) {
      return project;
    }
    return null;
  }

  private async parseProjectJson(filePath: string): Promise<ClaudeProject | null> {
    const content = await this.safeReadFile(filePath);
    if (!content) return null;

    try {
      const raw = JSON.parse(content) as ClaudeProject;
      if (raw.instructions || (raw.files && raw.files.length > 0) || raw.name) {
        return {
          uuid: raw.uuid,
          name: raw.name ?? basename(filePath, '.json'),
          description: raw.description,
          instructions: raw.instructions,
          created_at: raw.created_at,
          updated_at: raw.updated_at,
          files: raw.files ?? [],
        };
      }
    } catch {
      this.warnings.push(`Failed to parse project file: ${basename(filePath)}`);
    }

    return null;
  }

  // ─── Private: Build Identity & Knowledge ──────────────────

  /**
   * Build personality string from project instructions.
   * Concatenates all project instructions with separators.
   */
  private buildPersonality(projects: ClaudeProject[]): string {
    if (projects.length === 0) return '';

    const parts: string[] = [];
    for (const project of projects) {
      if (!project.instructions) continue;
      const name = project.name ?? 'Unnamed Project';
      parts.push(`--- Claude Project: ${name} ---\n${project.instructions}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Build knowledge documents from project uploaded files.
   */
  private buildKnowledge(projects: ClaudeProject[]): KnowledgeDocument[] {
    const docs: KnowledgeDocument[] = [];

    for (const project of projects) {
      const projectName = project.name ?? 'unnamed';
      if (!project.files) continue;

      for (const file of project.files) {
        if (!file.content || !file.file_name) continue;

        const buf = Buffer.from(file.content, 'utf-8');
        docs.push({
          id: `project:${projectName}:${file.file_name}`,
          filename: file.file_name,
          mimeType: file.file_type ?? this.guessFileType(file.file_name),
          path: `knowledge/projects/${projectName}/${file.file_name}`,
          size: buf.length,
          checksum: computeChecksum(buf),
        });
      }
    }

    return docs;
  }

  // ─── Private: Restore Guide Generation ────────────────────

  private generateRestoreGuide(snapshot: Snapshot): string {
    const lines: string[] = [];

    lines.push('# Claude.ai Restore Guide');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Snapshot: ${snapshot.manifest.id}`);
    lines.push(`Original export: ${snapshot.manifest.timestamp}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Memories section
    if (snapshot.memory.core.length > 0) {
      lines.push('## 🧠 Memories');
      lines.push('');
      lines.push('Go to **Claude.ai → Settings → Memory** and add each memory:');
      lines.push('');
      for (const entry of snapshot.memory.core) {
        lines.push(`- ${entry.content}`);
      }
      lines.push('');
      lines.push('> **Tip:** You can tell Claude "Remember that..." for each item,');
      lines.push('> or use the Memory settings to add them directly.');
      lines.push('');
    }

    // Projects section
    if (snapshot.identity.personality) {
      lines.push('## 📁 Projects');
      lines.push('');
      lines.push('Create new Projects in Claude.ai with the following instructions:');
      lines.push('');
      lines.push('```markdown');
      lines.push(snapshot.identity.personality);
      lines.push('```');
      lines.push('');
    }

    // Knowledge / uploaded files
    if (snapshot.memory.knowledge.length > 0) {
      lines.push('## 📄 Project Files');
      lines.push('');
      lines.push('Upload these files to the appropriate Claude Project:');
      lines.push('');
      for (const doc of snapshot.memory.knowledge) {
        lines.push(`- **${doc.filename}** (${(doc.size / 1024).toFixed(1)} KB)`);
      }
      lines.push('');
    }

    // Conversations summary
    if (snapshot.conversations.total > 0) {
      lines.push('## 💬 Conversations');
      lines.push('');
      lines.push(`${snapshot.conversations.total} conversations were backed up. Conversations cannot be`);
      lines.push('restored to Claude.ai but are preserved in the snapshot archive.');
      lines.push('');
      lines.push('Recent conversations:');
      lines.push('');
      const recent = [...snapshot.conversations.conversations]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 20);
      for (const conv of recent) {
        const title = conv.title ?? 'Untitled';
        lines.push(`- **${title}** (${conv.messageCount} messages, ${conv.updatedAt.slice(0, 10)})`);
      }
      if (snapshot.conversations.total > 20) {
        lines.push(`- ... and ${snapshot.conversations.total - 20} more`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('*Generated by SaveState — https://github.com/nicholasgriffintn/savestate*');

    return lines.join('\n');
  }

  private formatMemoriesForRestore(memories: MemoryEntry[]): string {
    const lines: string[] = [];
    lines.push('# Claude Memories to Import');
    lines.push('');
    lines.push('Copy each memory below into Claude.ai Settings → Memory,');
    lines.push('or tell Claude "Remember that..." for each item.');
    lines.push('');

    for (let i = 0; i < memories.length; i++) {
      lines.push(`${i + 1}. ${memories[i].content}`);
    }

    lines.push('');
    return lines.join('\n');
  }

  // ─── Private: Utilities ───────────────────────────────────

  private async safeReadFile(filePath: string): Promise<string | null> {
    try {
      const s = await stat(filePath);
      if (s.size > MAX_FILE_SIZE) {
        this.warnings.push(`Skipped ${basename(filePath)} (${(s.size / 1024 / 1024).toFixed(1)}MB > ${MAX_FILE_SIZE / 1024 / 1024}MB limit)`);
        return null;
      }
      return await readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  private guessFileType(filename: string): string {
    const ext = extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
      '.xml': 'application/xml',
      '.html': 'text/html',
      '.pdf': 'application/pdf',
      '.py': 'text/x-python',
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.rs': 'text/x-rust',
      '.go': 'text/x-go',
      '.rb': 'text/x-ruby',
      '.sh': 'text/x-shellscript',
    };
    return mimeMap[ext] ?? 'text/plain';
  }
}
