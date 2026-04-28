/**
 * Windsurf Adapter
 *
 * Community-tier adapter for the Windsurf AI-first IDE (from Codeium).
 * Captures user-level config plus per-project rules so a developer's
 * Windsurf setup is portable across machines and shareable between
 * projects.
 *
 * What we capture:
 *   - ~/.codeium/windsurf/mcp_config.json — global MCP servers → identity.tools
 *   - ~/.codeium/windsurf/memories/global_rules.md — global rules → identity.personality
 *   - <project>/.windsurfrules — legacy single-file project rules → identity.scripts
 *   - <project>/.windsurf/rules/*.md — multi-file project rules → identity.skills
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
  ScriptEntry,
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

/** Marker prefix for global rules content in personality */
const GLOBAL_RULES_MARKER = '--- ~/.codeium/windsurf/memories/global_rules.md ---';

export class WindsurfAdapter implements Adapter {
  readonly id = 'windsurf';
  readonly name = 'Windsurf';
  readonly platform = 'windsurf';
  readonly version = '0.1.0';

  private readonly projectDir: string;
  private warnings: string[] = [];

  constructor(projectDir?: string) {
    this.projectDir = projectDir ?? process.cwd();
  }

  async detect(): Promise<boolean> {
    // User-level marker
    if (existsSync(join(homedir(), '.codeium', 'windsurf'))) {
      return true;
    }
    // Project-level markers
    if (existsSync(join(this.projectDir, '.windsurf'))) {
      return true;
    }
    if (existsSync(join(this.projectDir, '.windsurfrules'))) {
      return true;
    }
    return false;
  }

  async extract(): Promise<Snapshot> {
    this.warnings = [];

    const personality = await this.readGlobalRules();
    const tools = await this.readMcpServers();
    const skills = await this.readProjectRules();
    const scripts = await this.readLegacyRules();
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
        scripts,
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
            description: 'Restore ~/.codeium/windsurf/mcp_config.json and global_rules.md',
            target: '~/.codeium/windsurf/',
          },
          {
            type: 'file',
            description: 'Restore project .windsurf/rules/*.md and .windsurfrules',
            target: '.windsurf/',
          },
        ],
        manualSteps: [
          'Windsurf chat history (globalStorage SQLite) is not yet restored — coming in v0.2',
          'Restart Windsurf after restore so MCP servers reload',
        ],
      },
    };

    return snapshot;
  }

  async restore(snapshot: Snapshot): Promise<void> {

    if (snapshot.identity.personality) {
      await this.restoreGlobalRules(snapshot.identity.personality);
    }
    if (snapshot.identity.tools && snapshot.identity.tools.length > 0) {
      await this.restoreMcpServers(snapshot.identity.tools);
    }
    if (snapshot.identity.skills && snapshot.identity.skills.length > 0) {
      await this.restoreProjectRules(snapshot.identity.skills);
    }
    if (snapshot.identity.scripts && snapshot.identity.scripts.length > 0) {
      await this.restoreLegacyRules(snapshot.identity.scripts);
    }
  }

  async identify(): Promise<PlatformMeta> {
    return {
      name: 'Windsurf',
      version: 'unknown',
      exportMethod: 'direct-file-access',
      apiVersion: `root:${this.projectDir}`,
    };
  }

  // ─── Private: Reading ─────────────────────────────────────

  /**
   * Read global_rules.md — wrapped with a marker so restoreGlobalRules
   * can split it back out cleanly.
   */
  private async readGlobalRules(): Promise<string | undefined> {
    const globalRules = join(homedir(), '.codeium', 'windsurf', 'memories', 'global_rules.md');
    if (!existsSync(globalRules)) return undefined;
    const content = await this.safeReadFile(globalRules);
    if (content === null) return undefined;
    return `${GLOBAL_RULES_MARKER}\n${content}`;
  }

  /**
   * Read mcp_config.json — global only. Recorded with `config.scope = 'global'`.
   */
  private async readMcpServers(): Promise<ToolConfig[]> {
    const globalPath = join(homedir(), '.codeium', 'windsurf', 'mcp_config.json');

    const merged = new Map<string, ToolConfig>();

    for (const [scope, path] of [
      ['global', globalPath],
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
   * Read .windsurf/rules/*.md as skills (one skill per file).
   */
  private async readProjectRules(): Promise<SkillEntry[]> {
    const skills: SkillEntry[] = [];
    const rulesDir = join(this.projectDir, '.windsurf', 'rules');
    if (!existsSync(rulesDir)) return skills;

    const entries = await readdir(rulesDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (extname(entry.name).toLowerCase() !== '.md') continue;

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
   * Read legacy single-file .windsurfrules into a script entry.
   */
  private async readLegacyRules(): Promise<ScriptEntry[]> {
    const filePath = join(this.projectDir, '.windsurfrules');
    if (!existsSync(filePath)) return [];
    const content = await this.safeReadFile(filePath);
    if (content === null) return [];
    return [
      {
        path: '.windsurfrules',
        content,
        isCronWrapper: false,
      },
    ];
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
   * Also records the existence of Windsurf's globalStorage SQLite databases
   * on macOS so v2 can parse chat history.
   *
   * TODO(v2): parse `~/Library/Application Support/Windsurf/User/globalStorage/<extension-id>/state.vscdb`
   *           SQLite to extract chat history into snapshot.conversations.
   */
  private async buildFileManifest(): Promise<FileManifestEntry[]> {
    const manifest: FileManifestEntry[] = [];
    await this.walkForManifest(this.projectDir, '', manifest, 0);

    // Record globalStorage SQLite databases (path + size only)
    const gsRoot = join(
      homedir(),
      'Library',
      'Application Support',
      'Windsurf',
      'User',
      'globalStorage',
    );
    if (existsSync(gsRoot)) {
      const gsEntries = await readdir(gsRoot, { withFileTypes: true }).catch(() => []);
      for (const ext of gsEntries) {
        if (!ext.isDirectory()) continue;
        const dbPath = join(gsRoot, ext.name, 'state.vscdb');
        try {
          const s = await stat(dbPath);
          manifest.push({
            path: `~/Library/Application Support/Windsurf/User/globalStorage/${ext.name}/state.vscdb`,
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
      if (entry.name.startsWith('.') && depth === 0 && entry.name !== '.windsurf') continue;

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
   * Restore global_rules.md to ~/.codeium/windsurf/memories/global_rules.md.
   * Strips the marker line if present.
   */
  private async restoreGlobalRules(personality: string): Promise<void> {
    let content = personality;
    if (content.startsWith(GLOBAL_RULES_MARKER)) {
      content = content.slice(GLOBAL_RULES_MARKER.length);
      if (content.startsWith('\n')) content = content.slice(1);
    }
    const targetPath = join(homedir(), '.codeium', 'windsurf', 'memories', 'global_rules.md');
    await this.backupFile(targetPath);
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, 'utf-8');
  }

  /**
   * Restore MCP servers to the global mcp_config.json.
   */
  private async restoreMcpServers(tools: ToolConfig[]): Promise<void> {
    const globalServers: Record<string, Record<string, unknown>> = {};

    for (const tool of tools) {
      if (tool.type !== 'mcp') continue;
      const { scope, ...rest } = tool.config as { scope?: string } & Record<string, unknown>;
      void scope;
      globalServers[tool.name] = rest;
    }

    if (Object.keys(globalServers).length > 0) {
      const targetPath = join(homedir(), '.codeium', 'windsurf', 'mcp_config.json');
      await this.backupFile(targetPath);
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, JSON.stringify({ mcpServers: globalServers }, null, 2), 'utf-8');
    }
  }

  /**
   * Restore .windsurf/rules/*.md skill files.
   */
  private async restoreProjectRules(skills: SkillEntry[]): Promise<void> {
    const rulesDir = join(this.projectDir, '.windsurf', 'rules');
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

  /**
   * Restore legacy .windsurfrules at the project root.
   */
  private async restoreLegacyRules(scripts: ScriptEntry[]): Promise<void> {
    for (const script of scripts) {
      if (script.path !== '.windsurfrules') continue;
      const targetPath = join(this.projectDir, '.windsurfrules');
      await this.backupFile(targetPath);
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, script.content, 'utf-8');
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
