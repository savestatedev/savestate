import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { exportState, importState, registerContainerCommands } from '../container.js';

describe('savestate import missing input path', () => {
  let testDir: string;
  let filePath: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-missing-input-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    filePath = join(testDir, 'fixture.savestate');
    const exported = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });
    expect(exported.written).toBe(true);
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('registers import and container import commands', () => {
    const program = new Command();
    registerContainerCommands(program);
    const importCmd = program.commands.find((command) => command.name() === 'import');
    const container = program.commands.find((command) => command.name() === 'container');
    const containerImport = container?.commands.find((command) => command.name() === 'import');
    expect(importCmd).toBeDefined();
    expect(containerImport).toBeDefined();
  });

  it('rejects a missing input path before restoring agent state', async () => {
    const missingPath = join(testDir, 'does-not-exist.savestate');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: missingPath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat().join('\n')).toMatch(/input path/i);
    expect(error.mock.calls.flat().join('\n')).toMatch(/not found/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Decrypting agent state');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Reading');
    error.mockRestore();
    log.mockRestore();
  });

  it('still imports an input path that exists', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toMatchObject({
      dryRun: false,
      restored: true,
      agentId: 'fixture-agent',
    });
    expect(log.mock.calls.flat().join('\n')).toContain('Successfully restored');
    log.mockRestore();
  });
});
