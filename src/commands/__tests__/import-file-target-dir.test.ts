import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { exportState, importState, registerContainerCommands } from '../container.js';

describe('savestate import file target directory', () => {
  let testDir: string;
  let filePath: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-file-target-dir-${Date.now()}`);
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

  it('rejects a file target directory before restoring agent state', async () => {
    const parentFile = join(testDir, 'parent-file');
    await fs.writeFile(parentFile, 'not-a-directory');
    const targetDir = join(parentFile, 'nested');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      target: targetDir,
    });

    expect(result).toBeUndefined();
    await expect(fs.access(join(targetDir, 'agent_state.json'))).rejects.toThrow();
    expect((await fs.stat(parentFile)).isFile()).toBe(true);
    expect(error.mock.calls.flat().join('\n')).toMatch(/target directory/i);
    expect(error.mock.calls.flat().join('\n')).toMatch(/is a file/i);
    expect(error.mock.calls.flat().join('\n')).toContain(dirname(targetDir));
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Wrote agent state');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Decrypting agent state');
    error.mockRestore();
    log.mockRestore();
  });

  it('still imports a directory target path', async () => {
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
