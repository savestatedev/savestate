import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { exportState, importState, registerContainerCommands } from '../container.js';

describe('savestate import file target path', () => {
  let testDir: string;
  let filePath: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-file-target-${Date.now()}`);
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

  it('rejects a file target path before restoring agent state', async () => {
    const targetFile = join(testDir, 'not-a-directory.txt');
    await fs.writeFile(targetFile, 'existing file');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      target: targetFile,
    });

    expect(result).toBeUndefined();
    expect(await fs.readFile(targetFile, 'utf-8')).toBe('existing file');
    expect(error.mock.calls.flat().join('\n')).toMatch(/target path/i);
    expect(error.mock.calls.flat().join('\n')).toMatch(/file/i);
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

  it('keeps the current restore path when --target is omitted', async () => {
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
    expect(result?.target).toBeUndefined();
    expect(log.mock.calls.flat().join('\n')).toContain('Successfully restored');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Wrote agent state');
    log.mockRestore();
  });
});
