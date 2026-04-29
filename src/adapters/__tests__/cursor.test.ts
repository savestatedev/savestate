import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CursorAdapter } from '../cursor.js';

describe('CursorAdapter', () => {
  let projectDir: string;
  let homeDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), 'savestate-cursor-project-'));
    homeDir = await mkdtemp(join(tmpdir(), 'savestate-cursor-home-'));
    originalHome = process.env.HOME;
    process.env.HOME = homeDir;
  });

  afterEach(async () => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    await rm(projectDir, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });

  describe('detect()', () => {
    it('returns false when no .cursor markers exist', async () => {
      const adapter = new CursorAdapter(projectDir);
      expect(await adapter.detect()).toBe(false);
    });

    it('returns true when ~/.cursor/ exists', async () => {
      await mkdir(join(homeDir, '.cursor'), { recursive: true });
      const adapter = new CursorAdapter(projectDir);
      expect(await adapter.detect()).toBe(true);
    });

    it('returns true when project .cursor/ exists', async () => {
      await mkdir(join(projectDir, '.cursor'), { recursive: true });
      const adapter = new CursorAdapter(projectDir);
      expect(await adapter.detect()).toBe(true);
    });
  });

  describe('extract()', () => {
    it('captures composer-rules into identity.personality', async () => {
      await mkdir(join(homeDir, '.cursor'), { recursive: true });
      await writeFile(
        join(homeDir, '.cursor', 'composer-rules'),
        'Always prefer TypeScript.\n',
        'utf-8',
      );

      const adapter = new CursorAdapter(projectDir);
      const snapshot = await adapter.extract();

      expect(snapshot.identity.personality).toBeDefined();
      expect(snapshot.identity.personality).toContain('Always prefer TypeScript.');
    });

    it('merges global and project mcp.json into identity.tools', async () => {
      await mkdir(join(homeDir, '.cursor'), { recursive: true });
      await writeFile(
        join(homeDir, '.cursor', 'mcp.json'),
        JSON.stringify({
          mcpServers: {
            'global-server': { command: 'node', args: ['g.js'] },
            shared: { command: 'global' },
          },
        }),
        'utf-8',
      );
      await mkdir(join(projectDir, '.cursor'), { recursive: true });
      await writeFile(
        join(projectDir, '.cursor', 'mcp.json'),
        JSON.stringify({
          mcpServers: {
            'project-server': { command: 'node', args: ['p.js'] },
            shared: { command: 'project' },
          },
        }),
        'utf-8',
      );

      const adapter = new CursorAdapter(projectDir);
      const snapshot = await adapter.extract();

      const tools = snapshot.identity.tools ?? [];
      const names = tools.map(t => t.name).sort();
      expect(names).toEqual(['global-server', 'project-server', 'shared']);
      expect(tools.every(t => t.type === 'mcp')).toBe(true);

      const shared = tools.find(t => t.name === 'shared');
      // Project should override global for the same name
      expect((shared!.config as { command: string }).command).toBe('project');
      expect((shared!.config as { scope: string }).scope).toBe('project');

      const global = tools.find(t => t.name === 'global-server');
      expect((global!.config as { scope: string }).scope).toBe('global');
    });

    it('captures .cursor/rules/*.mdc files as skills', async () => {
      const rulesDir = join(projectDir, '.cursor', 'rules');
      await mkdir(rulesDir, { recursive: true });
      await writeFile(join(rulesDir, 'typescript.mdc'), '# TS rules\nUse strict mode.', 'utf-8');
      await writeFile(join(rulesDir, 'testing.mdc'), '# Test rules\nUse vitest.', 'utf-8');
      // Should be ignored
      await writeFile(join(rulesDir, 'README.txt'), 'ignored', 'utf-8');

      const adapter = new CursorAdapter(projectDir);
      const snapshot = await adapter.extract();

      const skills = snapshot.identity.skills ?? [];
      const names = skills.map(s => s.name).sort();
      expect(names).toEqual(['testing.mdc', 'typescript.mdc']);
      const ts = skills.find(s => s.name === 'typescript.mdc');
      expect(ts!.skillMd).toContain('Use strict mode.');
      expect(ts!.files['typescript.mdc']).toContain('Use strict mode.');
    });

    it('produces a valid manifest with cursor adapter id', async () => {
      await mkdir(join(homeDir, '.cursor'), { recursive: true });
      const adapter = new CursorAdapter(projectDir);
      const snapshot = await adapter.extract();

      expect(snapshot.manifest.adapter).toBe('cursor');
      expect(snapshot.manifest.platform).toBe('cursor');
      expect(snapshot.platform.name).toBe('Cursor');
    });
  });

  describe('round-trip', () => {
    it('extracts then restores composer-rules, mcp.json, and rules into a fresh HOME', async () => {
      // Seed source state
      await mkdir(join(homeDir, '.cursor'), { recursive: true });
      await writeFile(
        join(homeDir, '.cursor', 'composer-rules'),
        'Be concise.\n',
        'utf-8',
      );
      await writeFile(
        join(homeDir, '.cursor', 'mcp.json'),
        JSON.stringify({ mcpServers: { lsp: { command: 'lsp-server' } } }),
        'utf-8',
      );
      const rulesDir = join(projectDir, '.cursor', 'rules');
      await mkdir(rulesDir, { recursive: true });
      await writeFile(join(rulesDir, 'rust.mdc'), '# Rust rules', 'utf-8');
      await mkdir(join(projectDir, '.cursor'), { recursive: true });
      await writeFile(
        join(projectDir, '.cursor', 'mcp.json'),
        JSON.stringify({ mcpServers: { db: { command: 'db-mcp' } } }),
        'utf-8',
      );

      const sourceAdapter = new CursorAdapter(projectDir);
      const snapshot = await sourceAdapter.extract();

      // Fresh HOME and project dir for restore
      const freshHome = await mkdtemp(join(tmpdir(), 'savestate-cursor-fresh-home-'));
      const freshProject = await mkdtemp(join(tmpdir(), 'savestate-cursor-fresh-project-'));
      process.env.HOME = freshHome;

      try {
        const restoreAdapter = new CursorAdapter(freshProject);
        await restoreAdapter.restore(snapshot);

        const restoredRules = await readFile(
          join(freshHome, '.cursor', 'composer-rules'),
          'utf-8',
        );
        expect(restoredRules).toContain('Be concise.');

        const restoredGlobalMcp = JSON.parse(
          await readFile(join(freshHome, '.cursor', 'mcp.json'), 'utf-8'),
        );
        expect(restoredGlobalMcp.mcpServers.lsp.command).toBe('lsp-server');

        const restoredProjectMcp = JSON.parse(
          await readFile(join(freshProject, '.cursor', 'mcp.json'), 'utf-8'),
        );
        expect(restoredProjectMcp.mcpServers.db.command).toBe('db-mcp');

        const restoredRule = await readFile(
          join(freshProject, '.cursor', 'rules', 'rust.mdc'),
          'utf-8',
        );
        expect(restoredRule).toBe('# Rust rules');
      } finally {
        await rm(freshHome, { recursive: true, force: true });
        await rm(freshProject, { recursive: true, force: true });
      }
    });
  });

  describe('chat history (v2)', () => {
    it('extracts conversations from a stub workspaceStorage state.vscdb', async () => {
      const wsHash = join(homeDir, 'fake-ws', 'aaa111');
      await mkdir(wsHash, { recursive: true });
      const dbPath = join(wsHash, 'state.vscdb');

      const Database = (await import('better-sqlite3')).default;
      const db = new Database(dbPath);
      db.exec('CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value TEXT)');
      db.prepare('INSERT INTO ItemTable VALUES (?, ?)').run(
        'composer.sessions',
        JSON.stringify({
          id: 'sess-1',
          title: 'cocktail thread',
          messages: [
            { role: 'user', content: 'recommend a cocktail' },
            { role: 'assistant', content: 'try a negroni' },
          ],
        }),
      );
      db.close();

      class TestCursor extends CursorAdapter {
        protected getWorkspaceDbs(): string[] {
          return [dbPath];
        }
      }

      const adapter = new TestCursor(projectDir);
      const snap = await adapter.extract();
      expect(snap.conversations.total).toBe(1);
      expect(snap.conversations.conversations[0].title).toBe('cocktail thread');
      expect(snap.conversations.conversations[0].messageCount).toBe(2);
    });

    it('returns 0 conversations when no DBs are present', async () => {
      class TestCursor extends CursorAdapter {
        protected getWorkspaceDbs(): string[] {
          return [];
        }
      }
      const adapter = new TestCursor(projectDir);
      const snap = await adapter.extract();
      expect(snap.conversations.total).toBe(0);
    });
  });
});
