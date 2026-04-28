/**
 * Cursor Adapter
 *
 * Community-tier adapter for the Cursor AI-first IDE.
 * Captures user-level config plus per-project rules so a developer's
 * Cursor setup is portable across machines and shareable between
 * projects.
 *
 * What we capture:
 *   - ~/.cursor/mcp.json — global MCP servers → identity.tools
 *   - ~/.cursor/composer-rules — global rules → identity.personality
 *   - <project>/.cursor/mcp.json — project MCP servers → identity.tools (merged)
 *   - <project>/.cursor/rules/*.mdc — project rules → identity.skills
 *   - Project files via fileManifest (paths + sizes only)
 *   - SQLite chat history is recorded in the manifest only; v2 will parse it.
 */

import { readFile, writeFile, readdir, stat, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { homedir } from 'node:os';
import type {
  Adapter,
  PlatformMeta,
  Snapshot,
  SkillEntry,
  ToolConfig,
  FileManifestEntry,
} from '../types.js';
import { SAF_VERSION, generateSnapshotId } from '../format.js';

/** Project metadata files to look for */
const PROJECT_META_FILES = [
  'package.json',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  'Gemfile',
  'composer.json',
  'build.gradle',
  'pom.xml',
  'Makefile',
  'CMakeLists.txt',
  'deno.json',
  'deno.jsonc',
  'tsconfig.json',
];

/** Directories to skip during manifest generation */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
  '.venv', 'venv', '.tox', 'target', '.gradle', '.idea', '.vscode',
  'vendor', 'coverage', '.nyc_output', '.cache', '.parcel-cache',
]);

/** Binary extensions to skip */
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.bmp', '.tiff',
  '.mp3', '.mp4', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.webm', '.avi', '.mov', '.mkv',
  '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.o', '.a',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.db', '.sqlite', '.sqlite3', '.vscdb',
]);

/** Maximum file size to capture (1MB) */
const MAX_FILE_SIZE = 1024 * 1024;

/** Maximum depth for file manifest generation */
const MAX_MANIFEST_DEPTH = 6;

/** Marker prefix for global composer-rules content in personality */
const GLOBAL_RULES_MARKER = '--- ~/.cursor/composer-rules ---';

export class CursorAdapter implements Adapter {
  readonly id = 'cursor';
  readonly name = 'Cursor';
  readonly platform = 'cursor';
  readonly version = '0.1.0';

  private readonly projectDir: string;
  private warnings: string[] = [];

  constructor(projectDir?: string) {
    this.projectDir = projectDir ?? process.cwd();
  }

  async detect(): Promise<boolean> {
    // User-level marker
    if (existsSync(join(homedir(), '.cursor'))) {
      return true;
    }
    // Project-level marker
    if (existsSync(join(this.projectDir, '.cursor'))) {
      return true;
    }
    return false;
  }

  async extract(): Promise<Snapshot> {
    this.warnings = [];

    const personality = await this.readComposerRules();
    const tools = await this.readMcpServers();
    const skills = await this.readProjectRules();
    const projectMeta = await this.readProjectMeta();
    const fileManifest = await this.buildFileManifest();

    const snapshotId = generateSnapshotId();
    const now = new Date().toISOString();

    if (this.warnings.length > 0) {
      for (const w of this.warnings) {
        console.warn(`  ⚠ ${w}`);
      }
    }

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
        personality,
        tools,
        skills,
        fileManifest,
        projectMeta,
      },
      memory: {
        core: [],
        knowledge: [],
      },
      conversations: {
        total: 0,
        conversations: [],
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
            description: 'Restore ~/.cursor/mcp.json and ~/.cursor/composer-rules',
            target: '~/.cursor/',
          },
          {
            type: 'file',
            description: 'Restore project .cursor/rules/*.mdc and .cursor/mcp.json',
            target: '.cursor/',
          },
        ],
        manualSteps: [
          'Cursor chat history (workspaceStorage SQLite) is not yet restored — coming in v0.2',
          'Restart Cursor after restore so MCP servers reload',
        ],
      },
    };

    return snapshot;
  }

  async restore(snapshot: Snapshot): Promise<void> {

    if (snapshot.identity.personality) {
      await this.restoreComposerRules(snapshot.identity.personality);
    }
    if (snapshot.identity.tools && snapshot.identity.tools.length > 0) {
      await this.restoreMcpServers(snapshot.identity.tools);
    }
    if (snapshot.identity.skills && snapshot.identity.skills.length > 0) {
      await this.restoreProjectRules(snapshot.identity.skills);
    }
  }

  async identify(): Promise<PlatformMeta> {
    return {
      name: 'Cursor',
      version: 'unknown',
      exportMethod: 'direct-file-access',
      apiVersion: `root:${this.projectDir}`,
    };
  }

  // ─── Private: Reading ─────────────────────────────────────

  /**
   * Read composer-rules — global only for now.
   * Encoded with a marker so restoreComposerRules can split if we ever
   * pick up project-level rules files.
   */
  private async readComposerRules(): Promise<string | undefined> {
    const globalRules = join(homedir(), '.cursor', 'composer-rules');
    if (!existsSync(globalRules)) return undefined;
    const content = await this.safeReadFile(globalRules);
    if (content === null) return undefined;
    return `${GLOBAL_RULES_MARKER}\n${content}`;
  }

  /**
   * Read mcp.json — global + project, merged into ToolConfig entries.
   * Project entries override global entries with the same name.
   */
  private async readMcpServers(): Promise<ToolConfig[]> {
    const globalPath = join(homedir(), '.cursor', 'mcp.json');
    const projectPath = join(this.projectDir, '.cursor', 'mcp.json');

    const merged = new Map<string, ToolConfig>();

    for (const [scope, path] of [
      ['global', globalPath],
      ['project', projectPath],
    ] as const) {
      if (!existsSync(path)) continue;
      const content = await this.safeReadFile(path);
      if (content === null) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        this.warnings.push(`Skipped ${path} (invalid JSON)`);
        continue;
      }
      const servers = (parsed as { mcpServers?: Record<string, Record<string, unknown>> })
        ?.mcpServers;
      if (!servers || typeof servers !== 'object') continue;

      for (const [name, config] of Object.entries(servers)) {
        merged.set(name, {
          name,
          type: 'mcp',
          config: { ...config, scope },
          enabled: true,
        });
      }
    }

    return [...merged.values()];
  }

  /**
   * Read .cursor/rules/*.mdc as skills (one skill per file).
   */
  private async readProjectRules(): Promise<SkillEntry[]> {
    const skills: SkillEntry[] = [];
    const rulesDir = join(this.projectDir, '.cursor', 'rules');
    if (!existsSync(rulesDir)) return skills;

    const entries = await readdir(rulesDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (extname(entry.name).toLowerCase() !== '.mdc') continue;

      const filePath = join(rulesDir, entry.name);
      const content = await this.safeReadFile(filePath);
      if (content === null) continue;

      skills.push({
        name: entry.name,
        skillMd: content,
        files: { [entry.name]: content },
      });
    }

    return skills;
  }

  /**
   * Read project metadata files (package.json, pyproject.toml, etc.)
   */
  private async readProjectMeta(): Promise<Record<string, string>> {
    const meta: Record<string, string> = {};

    for (const file of PROJECT_META_FILES) {
      const filePath = join(this.projectDir, file);
      if (existsSync(filePath)) {
        const content = await this.safeReadFile(filePath);
        if (content !== null) {
          meta[file] = content;
        }
      }
    }

    return meta;
  }

  /**
   * Build a file manifest of the project (paths + sizes, no content).
   * Also records the existence of Cursor's workspaceStorage SQLite databases
   * on macOS so v2 can parse chat history.
   *
   * TODO(v2): parse `~/Library/Application Support/Cursor/User/workspaceStorage/<hash>/state.vscdb`
   *           SQLite to extract Composer chat history into snapshot.conversations.
   */
  private async buildFileManifest(): Promise<FileManifestEntry[]> {
    const manifest: FileManifestEntry[] = [];
    await this.walkForManifest(this.projectDir, '', manifest, 0);

    // Record workspaceStorage SQLite databases (path + size only)
    const wsRoot = join(
      homedir(),
      'Library',
      'Application Support',
      'Cursor',
      'User',
      'workspaceStorage',
    );
    if (existsSync(wsRoot)) {
      const wsEntries = await readdir(wsRoot, { withFileTypes: true }).catch(() => []);
      for (const ws of wsEntries) {
        if (!ws.isDirectory()) continue;
        const dbPath = join(wsRoot, ws.name, 'state.vscdb');
        try {
          const s = await stat(dbPath);
          manifest.push({
            path: `~/Library/Application Support/Cursor/User/workspaceStorage/${ws.name}/state.vscdb`,
            size: s.size,
            modified: s.mtime.toISOString(),
          });
        } catch {
          // Skip missing or unreadable DBs
        }
      }
    }

    return manifest;
  }

  private async walkForManifest(
    dir: string,
    prefix: string,
    manifest: FileManifestEntry[],
    depth: number,
  ): Promise<void> {
    if (depth > MAX_MANIFEST_DEPTH) return;

    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith('.') && depth === 0 && entry.name !== '.cursor') continue;

      const fullPath = join(dir, entry.name);
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await this.walkForManifest(fullPath, relPath, manifest, depth + 1);
      } else if (entry.isFile()) {
        try {
          const s = await stat(fullPath);
          manifest.push({
            path: relPath,
            size: s.size,
            modified: s.mtime.toISOString(),
          });
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  // ─── Private: Restore ─────────────────────────────────────

  /**
   * Restore composer-rules to ~/.cursor/composer-rules.
   * Strips the marker line if present.
   */
  private async restoreComposerRules(personality: string): Promise<void> {
    let content = personality;
    if (content.startsWith(GLOBAL_RULES_MARKER)) {
      content = content.slice(GLOBAL_RULES_MARKER.length);
      if (content.startsWith('\n')) content = content.slice(1);
    }
    const targetPath = join(homedir(), '.cursor', 'composer-rules');
    await this.backupFile(targetPath);
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, 'utf-8');
  }

  /**
   * Restore MCP servers, splitting back into global vs project mcp.json
   * based on the `scope` field we recorded during extract.
   */
  private async restoreMcpServers(tools: ToolConfig[]): Promise<void> {
    const globalServers: Record<string, Record<string, unknown>> = {};
    const projectServers: Record<string, Record<string, unknown>> = {};

    for (const tool of tools) {
      if (tool.type !== 'mcp') continue;
      const { scope, ...rest } = tool.config as { scope?: string } & Record<string, unknown>;
      const target = scope === 'project' ? projectServers : globalServers;
      target[tool.name] = rest;
    }

    if (Object.keys(globalServers).length > 0) {
      const targetPath = join(homedir(), '.cursor', 'mcp.json');
      await this.backupFile(targetPath);
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, JSON.stringify({ mcpServers: globalServers }, null, 2), 'utf-8');
    }
    if (Object.keys(projectServers).length > 0) {
      const targetPath = join(this.projectDir, '.cursor', 'mcp.json');
      await this.backupFile(targetPath);
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, JSON.stringify({ mcpServers: projectServers }, null, 2), 'utf-8');
    }
  }

  /**
   * Restore .cursor/rules/*.mdc skill files.
   */
  private async restoreProjectRules(skills: SkillEntry[]): Promise<void> {
    const rulesDir = join(this.projectDir, '.cursor', 'rules');
    await mkdir(rulesDir, { recursive: true });

    for (const skill of skills) {
      const filename = skill.name;
      const content = skill.skillMd ?? skill.files[filename] ?? '';
      if (!content) continue;
      const targetPath = join(rulesDir, filename);
      await this.backupFile(targetPath);
      await writeFile(targetPath, content, 'utf-8');
    }
  }

  // ─── Private: Utilities ───────────────────────────────────

  private isBinary(filePath: string): boolean {
    const ext = extname(filePath).toLowerCase();
    return BINARY_EXTENSIONS.has(ext);
  }

  private async safeReadFile(filePath: string): Promise<string | null> {
    if (this.isBinary(filePath)) return null;
    try {
      const s = await stat(filePath);
      if (s.size > MAX_FILE_SIZE) {
        this.warnings.push(`Skipped ${filePath} (${(s.size / 1024 / 1024).toFixed(1)}MB > 1MB limit)`);
        return null;
      }
      return await readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  private async backupFile(filePath: string): Promise<void> {
    if (existsSync(filePath)) {
      const backupPath = filePath + '.bak';
      try {
        await rename(filePath, backupPath);
      } catch {
        // Continue without backup
      }
    }
  }
}
