import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { exportState, importState, registerContainerCommands } from '../container.js';

describe('savestate import missing target directory', () => {
  let testDir: string;
  let filePath: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-missing-target-dir-${Date.now()}`);
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

  it('registers --target on import and container import', () => {
    const program = new Command();
    registerContainerCommands(program);
    const importCmd = program.commands.find((command) => command.name() === 'import');
    const container = program.commands.find((command) => command.name() === 'container');
    const containerImport = container?.commands.find((command) => command.name() === 'import');
    expect(importCmd?.options.find((option) => option.long === '--target')).toBeDefined();
    expect(containerImport?.options.find((option) => option.long === '--target')).toBeDefined();
  });

  it('rejects a missing target directory before restoring agent state', async () => {
    const missingParent = join(testDir, 'does-not-exist');
    const targetDir = join(missingParent, 'nested');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      target: targetDir,
    });

    expect(result).toBeUndefined();
    await expect(fs.access(join(targetDir, 'agent_state.json'))).rejects.toThrow();
    await expect(fs.access(missingParent)).rejects.toThrow();
    expect(error.mock.calls.flat().join('\n')).toMatch(/target directory/i);
    expect(error.mock.calls.flat().join('\n')).toMatch(/not found/i);
    expect(error.mock.calls.flat().join('\n')).toContain(dirname(targetDir));
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Wrote agent state');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Decrypting agent state');
    error.mockRestore();
    log.mockRestore();
  });

  it('still imports a target whose parent directory exists', async () => {
    const targetDir = join(testDir, 'restored');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      target: targetDir,
    });

    const writtenPath = join(targetDir, 'agent_state.json');
    expect(result).toMatchObject({
      dryRun: false,
      restored: true,
      agentId: 'fixture-agent',
      target: writtenPath,
    });
    await expect(fs.readFile(writtenPath, 'utf-8')).resolves.toContain('fixture-agent');
    expect(log.mock.calls.flat().join('\n')).toContain(writtenPath);
    log.mockRestore();
  });
});
