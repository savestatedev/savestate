import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WindsurfAdapter } from '../windsurf.js';

describe('WindsurfAdapter', () => {
  let projectDir: string;
  let homeDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), 'savestate-windsurf-project-'));
    homeDir = await mkdtemp(join(tmpdir(), 'savestate-windsurf-home-'));
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
    it('returns false when no Windsurf markers exist', async () => {
      const adapter = new WindsurfAdapter(projectDir);
      expect(await adapter.detect()).toBe(false);
    });

    it('returns true when ~/.codeium/windsurf/ exists', async () => {
      await mkdir(join(homeDir, '.codeium', 'windsurf'), { recursive: true });
      const adapter = new WindsurfAdapter(projectDir);
      expect(await adapter.detect()).toBe(true);
    });

    it('returns true when project .windsurf/ exists', async () => {
      await mkdir(join(projectDir, '.windsurf'), { recursive: true });
      const adapter = new WindsurfAdapter(projectDir);
      expect(await adapter.detect()).toBe(true);
    });

    it('returns true when project .windsurfrules exists', async () => {
      await writeFile(join(projectDir, '.windsurfrules'), 'legacy rules', 'utf-8');
      const adapter = new WindsurfAdapter(projectDir);
      expect(await adapter.detect()).toBe(true);
    });
  });

  describe('extract()', () => {
    it('captures global_rules.md into identity.personality with marker', async () => {
      await mkdir(join(homeDir, '.codeium', 'windsurf', 'memories'), { recursive: true });
      await writeFile(
        join(homeDir, '.codeium', 'windsurf', 'memories', 'global_rules.md'),
        'Always prefer TypeScript.\n',
        'utf-8',
      );

      const adapter = new WindsurfAdapter(projectDir);
      const snapshot = await adapter.extract();

      expect(snapshot.identity.personality).toBeDefined();
      expect(snapshot.identity.personality).toContain(
        '--- ~/.codeium/windsurf/memories/global_rules.md ---',
      );
      expect(snapshot.identity.personality).toContain('Always prefer TypeScript.');
    });

    it('captures global mcp_config.json into identity.tools with global scope', async () => {
      await mkdir(join(homeDir, '.codeium', 'windsurf'), { recursive: true });
      await writeFile(
        join(homeDir, '.codeium', 'windsurf', 'mcp_config.json'),
        JSON.stringify({
          mcpServers: {
            'global-server': { command: 'node', args: ['g.js'] },
            other: { command: 'node' },
          },
        }),
        'utf-8',
      );

      const adapter = new WindsurfAdapter(projectDir);
      const snapshot = await adapter.extract();

      const tools = snapshot.identity.tools ?? [];
      const names = tools.map(t => t.name).sort();
      expect(names).toEqual(['global-server', 'other']);
      expect(tools.every(t => t.type === 'mcp')).toBe(true);
      expect(tools.every(t => (t.config as { scope: string }).scope === 'global')).toBe(true);
    });

    it('captures .windsurf/rules/*.md files as skills', async () => {
      const rulesDir = join(projectDir, '.windsurf', 'rules');
      await mkdir(rulesDir, { recursive: true });
      await writeFile(join(rulesDir, 'typescript.md'), '# TS rules\nUse strict mode.', 'utf-8');
      await writeFile(join(rulesDir, 'testing.md'), '# Test rules\nUse vitest.', 'utf-8');
      // Should be ignored
      await writeFile(join(rulesDir, 'README.txt'), 'ignored', 'utf-8');

      const adapter = new WindsurfAdapter(projectDir);
      const snapshot = await adapter.extract();

      const skills = snapshot.identity.skills ?? [];
      const names = skills.map(s => s.name).sort();
      expect(names).toEqual(['testing.md', 'typescript.md']);
      const ts = skills.find(s => s.name === 'typescript.md');
      expect(ts!.skillMd).toContain('Use strict mode.');
      expect(ts!.files['typescript.md']).toContain('Use strict mode.');
    });

    it('captures legacy .windsurfrules into identity.scripts', async () => {
      await writeFile(
        join(projectDir, '.windsurfrules'),
        '# Legacy single-file rules\nBe concise.',
        'utf-8',
      );

      const adapter = new WindsurfAdapter(projectDir);
      const snapshot = await adapter.extract();

      const scripts = snapshot.identity.scripts ?? [];
      expect(scripts).toHaveLength(1);
      expect(scripts[0]!.path).toBe('.windsurfrules');
      expect(scripts[0]!.content).toContain('Be concise.');
      expect(scripts[0]!.isCronWrapper).toBe(false);
    });

    it('produces a valid manifest with windsurf adapter id', async () => {
      await mkdir(join(homeDir, '.codeium', 'windsurf'), { recursive: true });
      const adapter = new WindsurfAdapter(projectDir);
      const snapshot = await adapter.extract();

      expect(snapshot.manifest.adapter).toBe('windsurf');
      expect(snapshot.manifest.platform).toBe('windsurf');
      expect(snapshot.platform.name).toBe('Windsurf');
    });
  });

  describe('round-trip', () => {
    it('extracts then restores rules, mcp_config, skills, and legacy rules in a fresh HOME', async () => {
      // Seed source state
      await mkdir(join(homeDir, '.codeium', 'windsurf', 'memories'), { recursive: true });
      await writeFile(
        join(homeDir, '.codeium', 'windsurf', 'memories', 'global_rules.md'),
        'Be concise.\n',
        'utf-8',
      );
      await writeFile(
        join(homeDir, '.codeium', 'windsurf', 'mcp_config.json'),
        JSON.stringify({ mcpServers: { lsp: { command: 'lsp-server' } } }),
        'utf-8',
      );
      const rulesDir = join(projectDir, '.windsurf', 'rules');
      await mkdir(rulesDir, { recursive: true });
      await writeFile(join(rulesDir, 'rust.md'), '# Rust rules', 'utf-8');
      await writeFile(
        join(projectDir, '.windsurfrules'),
        '# Legacy rules\nNo emojis.',
        'utf-8',
      );

      const sourceAdapter = new WindsurfAdapter(projectDir);
      const snapshot = await sourceAdapter.extract();

      // Fresh HOME and project dir for restore
      const freshHome = await mkdtemp(join(tmpdir(), 'savestate-windsurf-fresh-home-'));
      const freshProject = await mkdtemp(join(tmpdir(), 'savestate-windsurf-fresh-project-'));
      process.env.HOME = freshHome;

      try {
        const restoreAdapter = new WindsurfAdapter(freshProject);
        await restoreAdapter.restore(snapshot);

        const restoredRules = await readFile(
          join(freshHome, '.codeium', 'windsurf', 'memories', 'global_rules.md'),
          'utf-8',
        );
        expect(restoredRules).toBe('Be concise.\n');

        const restoredGlobalMcp = JSON.parse(
          await readFile(
            join(freshHome, '.codeium', 'windsurf', 'mcp_config.json'),
            'utf-8',
          ),
        );
        expect(restoredGlobalMcp.mcpServers.lsp.command).toBe('lsp-server');
        // scope key should not be persisted back into mcp_config.json
        expect(restoredGlobalMcp.mcpServers.lsp.scope).toBeUndefined();

        const restoredSkill = await readFile(
          join(freshProject, '.windsurf', 'rules', 'rust.md'),
          'utf-8',
        );
        expect(restoredSkill).toBe('# Rust rules');

        const restoredLegacy = await readFile(
          join(freshProject, '.windsurfrules'),
          'utf-8',
        );
        expect(restoredLegacy).toContain('No emojis.');
      } finally {
        await rm(freshHome, { recursive: true, force: true });
        await rm(freshProject, { recursive: true, force: true });
      }
    });
  });
});
