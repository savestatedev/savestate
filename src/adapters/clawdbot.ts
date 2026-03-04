/**
 * Clawdbot / OpenClaw Adapter
 *
 * First-party adapter for Clawdbot / Moltbot / OpenClaw workspaces.
 *
 * Captures:
 *   Workspace: SOUL.md, MEMORY.md, memory/, USER.md, TOOLS.md, AGENTS.md
 *   Skills: SKILL.md + scripts per skill
 *   Personal scripts: personal-scripts/, cron-wrappers/
 *   Extensions: extension configs
 *   Conversations: session JSONL files
 *
 * NEW in v0.3.0 - Full OpenClaw runtime state:
 *   Gateway config: openclaw.json (agent defs, model config, routing)
 *   Cron jobs: cron/jobs.json (scheduled behaviors)
 *   Credentials: channel auth, OAuth tokens
 *   Device identity: device pairing
 *   Paired nodes: mobile node pairing
 *   Memory databases: SQLite semantic memory
 *   Channel state: telegram offsets, whatsapp session, etc.
 *
 * This is the dogfood adapter - SaveState eats its own cooking.
 */

import { readFile, writeFile, readdir, stat, rename, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, extname, relative, basename } from 'node:path';
import { homedir } from 'node:os';
import type {
  Adapter,
  PlatformMeta,
  Snapshot,
  MemoryEntry,
  KnowledgeDocument,
  ConversationMeta,
  SkillEntry,
  ScriptEntry,
  ExtensionEntry,
} from '../types.js';
import { SAF_VERSION, generateSnapshotId, computeChecksum } from '../format.js';
import { TraceStore } from '../trace/index.js';

// ─── OpenClaw Runtime State Types ────────────────────────────

export interface OpenClawState {
  /** Gateway configuration (openclaw.json) */
  gatewayConfig?: string;
  /** Cron jobs configuration */
  cronJobs?: string;
  /** Device identity */
  deviceIdentity?: Record<string, string>;
  /** Paired nodes */
  pairedNodes?: Record<string, string>;
  /** Channel credentials (redacted by default) */
  credentials?: Record<string, string>;
  /** Channel state (telegram offsets, etc.) */
  channelState?: Record<string, string>;
  /** Memory database paths (for binary backup) */
  memoryDatabases?: MemoryDatabaseEntry[];
}

export interface MemoryDatabaseEntry {
  /** Agent ID this database belongs to */
  agentId: string;
  /** Relative path within archive */
  archivePath: string;
  /** Original file path */
  sourcePath: string;
  /** Size in bytes */
  size: number;
  /** SHA-256 checksum */
  checksum: string;
}

// ─── Configuration ───────────────────────────────────────────

/** Files that constitute the agent's identity */
const IDENTITY_FILES = ['SOUL.md', 'USER.md', 'AGENTS.md', 'TOOLS.md', 'IDENTITY.md', 'BOOTSTRAP.md', 'HEARTBEAT.md'];

/** Directories containing memory data */
const MEMORY_DIRS = ['memory'];

/** Files containing memory data */
const MEMORY_FILES = ['memory.md', 'MEMORY.md'];

/** Config files to capture at workspace root */
const CONFIG_FILES = ['.env', 'config.json', 'config.yaml', 'config.yml', '.savestate/config.json'];

/** OpenClaw config directory names (in order of preference) */
const OPENCLAW_CONFIG_DIRS = ['.openclaw', '.moltbot', '.clawdbot'];

/** Gateway config file names (in order of preference) */
const GATEWAY_CONFIG_FILES = ['openclaw.json', 'moltbot.json', 'clawdbot.json'];

/** File extensions to skip as binary */
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.bmp', '.tiff',
  '.mp3', '.mp4', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.webm', '.avi', '.mov', '.mkv',
  '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.o', '.a',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.db', '.sqlite', '.sqlite3',
  '.DS_Store',
]);

/** Maximum file size for text files (1MB) */
const MAX_TEXT_FILE_SIZE = 1024 * 1024;

/** Maximum file size for binary files like SQLite (100MB) */
const MAX_BINARY_FILE_SIZE = 100 * 1024 * 1024;

/** Directories to skip when scanning */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv', 'venv']);

/** Sensitive fields to redact from gateway config */
const SENSITIVE_CONFIG_FIELDS = ['apiKey', 'token', 'secret', 'password', 'accessToken', 'refreshToken'];

export interface ClawdbotAdapterOptions {
  /** Include credentials in backup (default: false for security) */
  includeCredentials?: boolean;
  /** Include memory SQLite databases (default: true, but large!) */
  includeMemoryDatabases?: boolean;
  /** Redact API keys from gateway config (default: true) */
  redactSecrets?: boolean;
  /** Specific agent ID to backup (default: all agents) */
  agentId?: string;
}

export class ClawdbotAdapter implements Adapter {
  readonly id = 'clawdbot';
  readonly name = 'OpenClaw';
  readonly platform = 'openclaw';
  readonly version = '0.3.0';

  private readonly workspaceDir: string;
  private readonly options: ClawdbotAdapterOptions;
  private warnings: string[] = [];

  constructor(workspaceDir?: string, options?: ClawdbotAdapterOptions) {
    this.workspaceDir = workspaceDir ?? process.cwd();
    this.options = {
      includeCredentials: false,
      includeMemoryDatabases: true,
      redactSecrets: true,
      ...options,
    };
  }

  async detect(): Promise<boolean> {
    // Detect by looking for characteristic files
    const markers = ['SOUL.md', 'memory.md', 'AGENTS.md', 'memory/', 'MEMORY.md'];
    for (const marker of markers) {
      if (existsSync(join(this.workspaceDir, marker))) {
        return true;
      }
    }
    // Also check for OpenClaw config dir
    const configDir = this.findOpenClawConfigDir();
    if (configDir) return true;
    
    return false;
  }

  async extract(): Promise<Snapshot> {
    this.warnings = [];

    // Workspace content
    const personality = await this.readIdentity();
    const memoryEntries = await this.readMemory();
    const conversations = await this.readConversations();
    const skills = await this.readSkills();
    const scripts = await this.readScripts();
    const extensions = await this.readExtensions();
    const configEntries = await this.readConfigFiles();
    const knowledge = await this.buildKnowledgeIndex(skills, scripts);
    const trace = await this.readTraceData();

    // NEW: OpenClaw runtime state
    const openclawState = await this.readOpenClawState();

    const snapshotId = generateSnapshotId();
    const now = new Date().toISOString();

    // Log warnings
    if (this.warnings.length > 0) {
      for (const w of this.warnings) {
        console.warn(`  ⚠ ${w}`);
      }
    }

    // Merge OpenClaw state into config
    const fullConfig: Record<string, unknown> = {
      ...configEntries,
      _openclaw: openclawState,
    };

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
        config: fullConfig,
        tools: [],
        skills,
        scripts,
        extensions,
      },
      memory: {
        core: memoryEntries,
        knowledge,
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
          {
            type: 'file',
            description: 'Restore skills directory',
            target: 'skills/',
          },
          {
            type: 'file',
            description: 'Restore personal scripts',
            target: 'personal-scripts/',
          },
          {
            type: 'file',
            description: 'Restore extension configs',
            target: 'extensions/',
          },
          {
            type: 'file',
            description: 'Restore Askable Echoes trace ledger',
            target: '.savestate/traces/',
          },
          {
            type: 'file',
            description: 'Restore OpenClaw gateway config',
            target: '~/.openclaw/openclaw.json',
          },
          {
            type: 'file',
            description: 'Restore cron jobs',
            target: '~/.openclaw/cron/jobs.json',
          },
          {
            type: 'manual',
            description: 'Re-authenticate channel credentials (Telegram, WhatsApp, etc.)',
            target: 'credentials/',
          },
        ],
        manualSteps: [
          'Re-link Telegram bot if credentials were not included',
          'Re-authenticate WhatsApp session',
          'Re-pair mobile nodes',
          'Verify API keys in gateway config',
        ],
      },
      trace,
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

    // Restore skills
    if (snapshot.identity.skills?.length) {
      await this.restoreSkills(snapshot.identity.skills);
    }

    // Restore scripts
    if (snapshot.identity.scripts?.length) {
      await this.restoreScripts(snapshot.identity.scripts);
    }

    // Restore extensions
    if (snapshot.identity.extensions?.length) {
      await this.restoreExtensions(snapshot.identity.extensions);
    }

    // Restore config files (excluding _openclaw which needs special handling)
    if (snapshot.identity.config) {
      const { _openclaw, ...workspaceConfigs } = snapshot.identity.config as Record<string, unknown>;
      if (Object.keys(workspaceConfigs).length > 0) {
        await this.restoreConfigFiles(workspaceConfigs);
      }

      // Restore OpenClaw state
      if (_openclaw) {
        await this.restoreOpenClawState(_openclaw as OpenClawState);
      }
    }

    // Restore trace ledger (if available)
    if (snapshot.trace) {
      const traceStore = new TraceStore({ cwd: this.workspaceDir, redactSecrets: false });
      await traceStore.writeSnapshotTrace(snapshot.trace);
    }
  }

  async identify(): Promise<PlatformMeta> {
    // Try to read version from OpenClaw config or package.json
    let version = this.version;
    
    const configDir = this.findOpenClawConfigDir();
    if (configDir) {
      for (const configFile of GATEWAY_CONFIG_FILES) {
        const configPath = join(configDir, configFile);
        if (existsSync(configPath)) {
          try {
            const content = await readFile(configPath, 'utf-8');
            const config = JSON.parse(content);
            if (config.meta?.lastTouchedVersion) {
              version = config.meta.lastTouchedVersion;
              break;
            }
          } catch { /* ignore */ }
        }
      }
    }

    return {
      name: 'OpenClaw',
      version,
      exportMethod: 'direct-file-access',
    };
  }

  // ─── OpenClaw Config Directory ─────────────────────────────

  private findOpenClawConfigDir(): string | null {
    for (const dirName of OPENCLAW_CONFIG_DIRS) {
      const dirPath = join(homedir(), dirName);
      if (existsSync(dirPath)) {
        return dirPath;
      }
    }
    return null;
  }

  // ─── OpenClaw Runtime State ────────────────────────────────

  private async readOpenClawState(): Promise<OpenClawState> {
    const state: OpenClawState = {};
    const configDir = this.findOpenClawConfigDir();
    
    if (!configDir) {
      this.warnings.push('OpenClaw config directory not found (~/.openclaw)');
      return state;
    }

    // 1. Gateway config (openclaw.json / moltbot.json / clawdbot.json)
    for (const configFile of GATEWAY_CONFIG_FILES) {
      const configPath = join(configDir, configFile);
      if (existsSync(configPath)) {
        try {
          let content = await readFile(configPath, 'utf-8');
          if (this.options.redactSecrets) {
            content = this.redactSensitiveData(content);
          }
          state.gatewayConfig = content;
          break;
        } catch (e) {
          this.warnings.push(`Failed to read gateway config: ${e}`);
        }
      }
    }

    // 2. Cron jobs
    const cronPath = join(configDir, 'cron', 'jobs.json');
    if (existsSync(cronPath)) {
      try {
        state.cronJobs = await readFile(cronPath, 'utf-8');
      } catch (e) {
        this.warnings.push(`Failed to read cron jobs: ${e}`);
      }
    }

    // 3. Device identity
    const identityDir = join(configDir, 'identity');
    if (existsSync(identityDir)) {
      state.deviceIdentity = await this.readDirectoryFiles(identityDir, ['.json']);
    }

    // 4. Paired nodes
    const nodesDir = join(configDir, 'nodes');
    if (existsSync(nodesDir)) {
      state.pairedNodes = await this.readDirectoryFiles(nodesDir, ['.json']);
    }

    // 5. Credentials (only if explicitly requested)
    if (this.options.includeCredentials) {
      const credentialsDir = join(configDir, 'credentials');
      if (existsSync(credentialsDir)) {
        state.credentials = await this.readDirectoryFiles(credentialsDir, ['.json']);
        // Also capture WhatsApp session if present
        const whatsappDir = join(credentialsDir, 'whatsapp');
        if (existsSync(whatsappDir)) {
          const waFiles = await this.readDirectoryFiles(whatsappDir, ['.json', '.txt']);
          for (const [name, content] of Object.entries(waFiles)) {
            state.credentials![`whatsapp/${name}`] = content;
          }
        }
      }
    } else {
      this.warnings.push('Credentials excluded (use --include-credentials to include)');
    }

    // 6. Channel state (telegram offsets, etc.)
    const telegramDir = join(configDir, 'telegram');
    if (existsSync(telegramDir)) {
      state.channelState = await this.readDirectoryFiles(telegramDir, ['.json']);
    }

    // 7. Memory databases (SQLite files)
    if (this.options.includeMemoryDatabases) {
      const memoryDir = join(configDir, 'memory');
      if (existsSync(memoryDir)) {
        state.memoryDatabases = await this.indexMemoryDatabases(memoryDir);
      }
    } else {
      this.warnings.push('Memory databases excluded (use --include-memory-dbs to include)');
    }

    return state;
  }

  private async readDirectoryFiles(dir: string, extensions: string[]): Promise<Record<string, string>> {
    const files: Record<string, string> = {};
    try {
      const entries = await readdir(dir);
      for (const entry of entries) {
        const ext = extname(entry).toLowerCase();
        if (!extensions.includes(ext)) continue;
        
        const filePath = join(dir, entry);
        const fileStat = await stat(filePath).catch(() => null);
        if (!fileStat?.isFile()) continue;
        if (fileStat.size > MAX_TEXT_FILE_SIZE) {
          this.warnings.push(`Skipped ${entry} (too large: ${(fileStat.size / 1024 / 1024).toFixed(1)}MB)`);
          continue;
        }

        try {
          files[entry] = await readFile(filePath, 'utf-8');
        } catch { /* skip unreadable */ }
      }
    } catch { /* directory not readable */ }
    return files;
  }

  private async indexMemoryDatabases(memoryDir: string): Promise<MemoryDatabaseEntry[]> {
    const databases: MemoryDatabaseEntry[] = [];
    try {
      const entries = await readdir(memoryDir);
      for (const entry of entries) {
        if (!entry.endsWith('.sqlite')) continue;
        
        const filePath = join(memoryDir, entry);
        const fileStat = await stat(filePath).catch(() => null);
        if (!fileStat?.isFile()) continue;

        if (fileStat.size > MAX_BINARY_FILE_SIZE) {
          this.warnings.push(`Memory DB ${entry} too large (${(fileStat.size / 1024 / 1024).toFixed(1)}MB > 100MB limit)`);
          continue;
        }

        // Extract agent ID from filename (e.g., "main.sqlite" -> "main")
        const agentId = entry.replace('.sqlite', '');

        // Compute checksum
        const buffer = await readFile(filePath);
        const checksum = computeChecksum(buffer);

        databases.push({
          agentId,
          archivePath: `memory-dbs/${entry}`,
          sourcePath: filePath,
          size: fileStat.size,
          checksum,
        });
      }
    } catch { /* memory dir not readable */ }
    return databases;
  }

  private redactSensitiveData(jsonContent: string): string {
    try {
      const obj = JSON.parse(jsonContent);
      const redacted = this.redactObject(obj);
      return JSON.stringify(redacted, null, 2);
    } catch {
      // If not valid JSON, do simple regex replacement
      let content = jsonContent;
      for (const field of SENSITIVE_CONFIG_FIELDS) {
        // Match "apiKey": "value" patterns
        const regex = new RegExp(`("${field}"\\s*:\\s*)"[^"]*"`, 'gi');
        content = content.replace(regex, '$1"[REDACTED]"');
      }
      return content;
    }
  }

  private redactObject(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.redactObject(item));
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_CONFIG_FIELDS.some(field => 
        lowerKey.includes(field.toLowerCase())
      );
      
      if (isSensitive && typeof value === 'string' && value.length > 0) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.redactObject(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private async restoreOpenClawState(state: OpenClawState): Promise<void> {
    const configDir = this.findOpenClawConfigDir() ?? join(homedir(), '.openclaw');
    
    // Ensure config dir exists
    await mkdir(configDir, { recursive: true });

    // 1. Gateway config
    if (state.gatewayConfig) {
      const configPath = join(configDir, 'openclaw.json');
      await this.backupFile(configPath);
      await writeFile(configPath, state.gatewayConfig, 'utf-8');
      console.log('  ✓ Restored gateway config (review API keys!)');
    }

    // 2. Cron jobs
    if (state.cronJobs) {
      const cronDir = join(configDir, 'cron');
      await mkdir(cronDir, { recursive: true });
      const cronPath = join(cronDir, 'jobs.json');
      await this.backupFile(cronPath);
      await writeFile(cronPath, state.cronJobs, 'utf-8');
      console.log('  ✓ Restored cron jobs');
    }

    // 3. Device identity
    if (state.deviceIdentity) {
      const identityDir = join(configDir, 'identity');
      await mkdir(identityDir, { recursive: true });
      for (const [filename, content] of Object.entries(state.deviceIdentity)) {
        const filePath = join(identityDir, filename);
        await this.backupFile(filePath);
        await writeFile(filePath, content, 'utf-8');
      }
      console.log('  ✓ Restored device identity');
    }

    // 4. Paired nodes
    if (state.pairedNodes) {
      const nodesDir = join(configDir, 'nodes');
      await mkdir(nodesDir, { recursive: true });
      for (const [filename, content] of Object.entries(state.pairedNodes)) {
        const filePath = join(nodesDir, filename);
        await this.backupFile(filePath);
        await writeFile(filePath, content, 'utf-8');
      }
      console.log('  ✓ Restored paired nodes');
    }

    // 5. Credentials (if present)
    if (state.credentials) {
      const credentialsDir = join(configDir, 'credentials');
      await mkdir(credentialsDir, { recursive: true });
      for (const [filename, content] of Object.entries(state.credentials)) {
        const filePath = join(credentialsDir, filename);
        await mkdir(dirname(filePath), { recursive: true });
        await this.backupFile(filePath);
        await writeFile(filePath, content, 'utf-8');
      }
      console.log('  ✓ Restored credentials');
    }

    // 6. Channel state
    if (state.channelState) {
      const telegramDir = join(configDir, 'telegram');
      await mkdir(telegramDir, { recursive: true });
      for (const [filename, content] of Object.entries(state.channelState)) {
        const filePath = join(telegramDir, filename);
        await this.backupFile(filePath);
        await writeFile(filePath, content, 'utf-8');
      }
      console.log('  ✓ Restored channel state');
    }

    // 7. Memory databases (need special binary handling in snapshot.ts)
    if (state.memoryDatabases?.length) {
      console.log(`  ℹ ${state.memoryDatabases.length} memory database(s) indexed (restore via binary extract)`);
    }
  }

  // ─── Private helpers ─────────────────────────────────────

  private isBinary(filePath: string): boolean {
    const ext = extname(filePath).toLowerCase();
    const base = filePath.split('/').pop() ?? '';
    return BINARY_EXTENSIONS.has(ext) || BINARY_EXTENSIONS.has(`.${base}`);
  }

  private async checkFileSize(filePath: string): Promise<boolean> {
    try {
      const s = await stat(filePath);
      if (s.size > MAX_TEXT_FILE_SIZE) {
        this.warnings.push(`Skipped ${filePath} (${(s.size / 1024 / 1024).toFixed(1)}MB > 1MB limit)`);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  private async safeReadFile(filePath: string): Promise<string | null> {
    if (this.isBinary(filePath)) {
      return null;
    }
    if (!(await this.checkFileSize(filePath))) {
      return null;
    }
    try {
      return await readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  private async readIdentity(): Promise<string> {
    const parts: string[] = [];
    for (const file of IDENTITY_FILES) {
      const path = join(this.workspaceDir, file);
      if (existsSync(path)) {
        const content = await this.safeReadFile(path);
        if (content !== null) {
          parts.push(`--- ${file} ---\n${content}`);
        }
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
        const content = await this.safeReadFile(path);
        if (content !== null) {
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
    }

    // Read memory directory (recursively, flat output)
    for (const dir of MEMORY_DIRS) {
      const dirPath = join(this.workspaceDir, dir);
      if (existsSync(dirPath)) {
        const memFiles = await this.walkDir(dirPath, ['.md', '.json', '.txt']);
        for (const filePath of memFiles) {
          const content = await this.safeReadFile(filePath);
          if (content !== null) {
            const relPath = `${dir}/${relative(dirPath, filePath)}`;
            const fileStat = await stat(filePath);
            entries.push({
              id: `file:${relPath}`,
              content,
              source: relPath,
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
    const conversations: ConversationMeta[] = [];

    // Look for conversation logs in ~/.openclaw/agents/*/sessions/*.jsonl
    // Also check legacy paths: ~/.moltbot, ~/.clawdbot
    const configDir = this.findOpenClawConfigDir();
    if (!configDir) return conversations;

    const agentsDir = join(configDir, 'agents');
    if (!existsSync(agentsDir)) return conversations;

    try {
      const agents = await readdir(agentsDir);
      
      // Filter to specific agent if requested
      const targetAgents = this.options.agentId 
        ? agents.filter(a => a === this.options.agentId)
        : agents;

      for (const agent of targetAgents) {
        const sessionsDir = join(agentsDir, agent, 'sessions');
        if (!existsSync(sessionsDir)) continue;

        const sessionFiles = await readdir(sessionsDir);
        for (const sessionFile of sessionFiles) {
          if (!sessionFile.endsWith('.jsonl')) continue;

          const sessionPath = join(sessionsDir, sessionFile);
          const sessionId = sessionFile.replace('.jsonl', '');

          try {
            const fileStat = await stat(sessionPath);

            // Count lines (messages) without loading full content
            let messageCount = 0;
            if (fileStat.size <= MAX_TEXT_FILE_SIZE) {
              const content = await readFile(sessionPath, 'utf-8');
              messageCount = content.split('\n').filter(l => l.trim()).length;
            } else {
              this.warnings.push(`Conversation ${sessionId} too large for content (${(fileStat.size / 1024 / 1024).toFixed(1)}MB), capturing metadata only`);
            }

            conversations.push({
              id: `${agent}/${sessionId}`,
              title: `${agent} session ${sessionId.slice(0, 8)}`,
              createdAt: fileStat.birthtime.toISOString(),
              updatedAt: fileStat.mtime.toISOString(),
              messageCount,
              path: `conversations/${agent}/${sessionFile}`,
            });
          } catch {
            // Skip unreadable session files
          }
        }
      }
    } catch {
      // Agents directory not readable
    }

    return conversations;
  }

  private async readSkills(): Promise<SkillEntry[]> {
    const skills: SkillEntry[] = [];
    const skillsDir = join(this.workspaceDir, 'skills');
    if (!existsSync(skillsDir)) return skills;

    try {
      const skillDirs = await readdir(skillsDir);
      for (const skillName of skillDirs) {
        const skillPath = join(skillsDir, skillName);
        const s = await stat(skillPath).catch(() => null);
        if (!s?.isDirectory()) continue;

        const entry: SkillEntry = { name: skillName, files: {} };

        // Read SKILL.md
        const skillMdPath = join(skillPath, 'SKILL.md');
        if (existsSync(skillMdPath)) {
          const content = await this.safeReadFile(skillMdPath);
          if (content !== null) {
            entry.skillMd = content;
            entry.files['SKILL.md'] = content;
          }
        }

        // Read config files in skill root
        const skillFiles = await readdir(skillPath).catch(() => []);
        for (const f of skillFiles) {
          if (SKIP_DIRS.has(f)) continue;
          const fPath = join(skillPath, f);
          const fStat = await stat(fPath).catch(() => null);
          if (!fStat?.isFile()) continue;
          if (this.isBinary(fPath)) continue;

          const ext = extname(f).toLowerCase();
          const captureExts = new Set(['.json', '.yaml', '.yml', '.toml', '.md', '.txt', '.sh', '.py', '.ts', '.js', '.env']);
          if (!captureExts.has(ext)) continue;

          const content = await this.safeReadFile(fPath);
          if (content !== null) {
            entry.files[f] = content;
          }
        }

        // Read scripts/ subdirectory
        const scriptsDir = join(skillPath, 'scripts');
        if (existsSync(scriptsDir)) {
          const scriptFiles = await this.walkDir(scriptsDir, ['.sh', '.py', '.ts', '.js', '.rb']);
          for (const sf of scriptFiles) {
            const content = await this.safeReadFile(sf);
            if (content !== null) {
              const relPath = `scripts/${relative(scriptsDir, sf)}`;
              entry.files[relPath] = content;
            }
          }
        }

        if (Object.keys(entry.files).length > 0 || entry.skillMd) {
          skills.push(entry);
        }
      }
    } catch {
      // skills directory not readable
    }

    return skills;
  }

  private async readScripts(): Promise<ScriptEntry[]> {
    const scripts: ScriptEntry[] = [];
    const scriptsDir = join(this.workspaceDir, 'personal-scripts');
    if (!existsSync(scriptsDir)) return scripts;

    try {
      const allFiles = await this.walkDir(scriptsDir);
      for (const filePath of allFiles) {
        const content = await this.safeReadFile(filePath);
        if (content !== null) {
          const relPath = `personal-scripts/${relative(scriptsDir, filePath)}`;
          const isCronWrapper = filePath.includes('cron-wrappers');
          scripts.push({ path: relPath, content, isCronWrapper });
        }
      }
    } catch {
      // personal-scripts not readable
    }

    return scripts;
  }

  private async readExtensions(): Promise<ExtensionEntry[]> {
    const extensions: ExtensionEntry[] = [];
    const extDir = join(this.workspaceDir, 'extensions');
    if (!existsSync(extDir)) return extensions;

    try {
      const extDirs = await readdir(extDir);
      for (const extName of extDirs) {
        const extPath = join(extDir, extName);
        const s = await stat(extPath).catch(() => null);
        if (!s?.isDirectory()) continue;

        const entry: ExtensionEntry = { name: extName, configs: {} };

        const configExts = new Set(['.json', '.yaml', '.yml', '.toml', '.md', '.env', '.env.example']);
        const files = await readdir(extPath).catch(() => []);
        for (const f of files) {
          if (SKIP_DIRS.has(f)) continue;
          const fPath = join(extPath, f);
          const fStat = await stat(fPath).catch(() => null);
          if (!fStat?.isFile()) continue;

          const ext = extname(f).toLowerCase();
          if (configExts.has(ext) || f === 'package.json' || f === 'README.md' || f === 'SKILL.md') {
            const content = await this.safeReadFile(fPath);
            if (content !== null) {
              entry.configs[f] = content;
            }
          }
        }

        if (Object.keys(entry.configs).length > 0) {
          extensions.push(entry);
        }
      }
    } catch {
      // extensions directory not readable
    }

    return extensions;
  }

  private async readConfigFiles(): Promise<Record<string, unknown> | undefined> {
    const configs: Record<string, string> = {};

    for (const file of CONFIG_FILES) {
      const filePath = join(this.workspaceDir, file);
      if (existsSync(filePath)) {
        const content = await this.safeReadFile(filePath);
        if (content !== null) {
          configs[file] = content;
        }
      }
    }

    const agentConfigPath = join(this.workspaceDir, '.savestate', 'agent-config.json');
    if (existsSync(agentConfigPath)) {
      const content = await this.safeReadFile(agentConfigPath);
      if (content !== null) {
        configs['.savestate/agent-config.json'] = content;
      }
    }

    return Object.keys(configs).length > 0 ? configs : undefined;
  }

  private async buildKnowledgeIndex(
    skills: SkillEntry[],
    scripts: ScriptEntry[],
  ): Promise<KnowledgeDocument[]> {
    const docs: KnowledgeDocument[] = [];

    for (const skill of skills) {
      if (skill.skillMd) {
        const buf = Buffer.from(skill.skillMd, 'utf-8');
        docs.push({
          id: `skill:${skill.name}`,
          filename: `skills/${skill.name}/SKILL.md`,
          mimeType: 'text/markdown',
          path: `knowledge/skills/${skill.name}/SKILL.md`,
          size: buf.length,
          checksum: computeChecksum(buf),
        });
      }
    }

    for (const script of scripts) {
      const buf = Buffer.from(script.content, 'utf-8');
      docs.push({
        id: `script:${script.path}`,
        filename: script.path,
        mimeType: 'text/plain',
        path: `knowledge/${script.path}`,
        size: buf.length,
        checksum: computeChecksum(buf),
      });
    }

    return docs;
  }

  private async readTraceData(): Promise<Snapshot['trace'] | undefined> {
    try {
      const traceStore = new TraceStore({ cwd: this.workspaceDir });
      return await traceStore.readSnapshotTrace();
    } catch (err) {
      this.warnings.push(
        `Failed to read trace ledger: ${err instanceof Error ? err.message : String(err)}`,
      );
      return undefined;
    }
  }

  private async walkDir(dir: string, extensions?: string[]): Promise<string[]> {
    const results: string[] = [];
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith('.')) continue;

      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = await this.walkDir(fullPath, extensions);
        results.push(...sub);
      } else if (entry.isFile()) {
        if (this.isBinary(fullPath)) continue;
        if (extensions) {
          const ext = extname(entry.name).toLowerCase();
          if (!extensions.includes(ext)) continue;
        }
        results.push(fullPath);
      }
    }

    return results;
  }

  // ─── Restore helpers ──────────────────────────────────────

  private async restoreIdentity(personality: string): Promise<void> {
    const files = this.parsePersonality(personality);

    for (const [filename, content] of files) {
      const targetPath = join(this.workspaceDir, filename);
      await this.backupFile(targetPath);
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, content, 'utf-8');
    }
  }

  private parsePersonality(personality: string): Map<string, string> {
    const files = new Map<string, string>();
    const regex = /^--- (.+?) ---$/gm;
    const matches = [...personality.matchAll(regex)];

    for (let i = 0; i < matches.length; i++) {
      const filename = matches[i][1];
      const startIdx = matches[i].index! + matches[i][0].length + 1;
      const endIdx = i + 1 < matches.length ? matches[i + 1].index! : personality.length;

      let content = personality.slice(startIdx, endIdx);
      content = content.replace(/\n\n$/, '\n');
      if (!content.endsWith('\n')) content += '\n';

      files.set(filename, content);
    }

    return files;
  }

  private async restoreMemory(entries: MemoryEntry[]): Promise<void> {
    for (const entry of entries) {
      const targetPath = join(this.workspaceDir, entry.source);
      await this.backupFile(targetPath);
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, entry.content, 'utf-8');
    }
  }

  private async restoreSkills(skills: SkillEntry[]): Promise<void> {
    for (const skill of skills) {
      const skillDir = join(this.workspaceDir, 'skills', skill.name);
      await mkdir(skillDir, { recursive: true });

      for (const [relPath, content] of Object.entries(skill.files)) {
        const targetPath = join(skillDir, relPath);
        await this.backupFile(targetPath);
        await mkdir(dirname(targetPath), { recursive: true });
        await writeFile(targetPath, content, 'utf-8');
      }
    }
  }

  private async restoreScripts(scripts: ScriptEntry[]): Promise<void> {
    for (const script of scripts) {
      const targetPath = join(this.workspaceDir, script.path);
      await this.backupFile(targetPath);
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, script.content, 'utf-8');
    }
  }

  private async restoreExtensions(extensions: ExtensionEntry[]): Promise<void> {
    for (const ext of extensions) {
      const extDir = join(this.workspaceDir, 'extensions', ext.name);
      await mkdir(extDir, { recursive: true });

      for (const [filename, content] of Object.entries(ext.configs)) {
        const targetPath = join(extDir, filename);
        await this.backupFile(targetPath);
        await writeFile(targetPath, content, 'utf-8');
      }
    }
  }

  private async restoreConfigFiles(configs: Record<string, unknown>): Promise<void> {
    for (const [file, value] of Object.entries(configs)) {
      if (typeof value !== 'string') continue;
      const targetPath = join(this.workspaceDir, file);
      await this.backupFile(targetPath);
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, value, 'utf-8');
    }
  }

  private async backupFile(filePath: string): Promise<void> {
    if (existsSync(filePath)) {
      const backupPath = filePath + '.bak';
      try {
        await rename(filePath, backupPath);
      } catch {
        // If rename fails, continue without backup
      }
    }
  }
}
