import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState, importState, registerContainerCommands } from '../container.js';

describe('savestate import overwrite guard', () => {
  let testDir: string;
  let filePath: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-overwrite-${Date.now()}`);
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

  it('registers --force on import commands', () => {
    const program = new Command();
    registerContainerCommands(program);
    const importCmd = program.commands.find((command) => command.name() === 'import');
    const containerImport = program.commands
      .find((command) => command.name() === 'container')
      ?.commands.find((command) => command.name() === 'import');
    expect(importCmd?.options.some((option) => option.long === '--force')).toBe(true);
    expect(containerImport?.options.some((option) => option.long === '--force')).toBe(true);
  });

  it('refuses to replace an existing target file without --force', async () => {
    const targetDir = join(testDir, 'keep');
    const writtenPath = join(targetDir, 'agent_state.json');
    await fs.mkdir(targetDir);
    await fs.writeFile(writtenPath, 'original-synthetic-state');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      target: targetDir,
    });

    expect(result).toBeUndefined();
    expect(await fs.readFile(writtenPath, 'utf-8')).toBe('original-synthetic-state');
    expect(error.mock.calls.flat().join('\n')).toContain('already exists');
    expect(error.mock.calls.flat().join('\n')).toContain('--force');
    expect(error.mock.calls.flat().join('\n')).toContain(writtenPath);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Wrote agent state');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Decrypting agent state');
    error.mockRestore();
    log.mockRestore();
  });

  it('overwrites an existing target file when --force is set', async () => {
    const targetDir = join(testDir, 'replace');
    const writtenPath = join(targetDir, 'agent_state.json');
    await fs.mkdir(targetDir);
    await fs.writeFile(writtenPath, 'original-synthetic-state');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      target: targetDir,
      force: true,
    });

    expect(result).toMatchObject({
      dryRun: false,
      restored: true,
      agentId: 'fixture-agent',
      target: writtenPath,
    });
    const written = await fs.readFile(writtenPath, 'utf-8');
    expect(written).toContain('fixture-agent');
    expect(written).not.toBe('original-synthetic-state');
    expect(log.mock.calls.flat().join('\n')).toContain('Wrote agent state');
    log.mockRestore();
  });

  it('still previews an existing target file on dry-run without --force', async () => {
    const targetDir = join(testDir, 'dry-keep');
    const writtenPath = join(targetDir, 'agent_state.json');
    await fs.mkdir(targetDir);
    await fs.writeFile(writtenPath, 'original-synthetic-state');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      target: targetDir,
      dryRun: true,
    });

    expect(result).toMatchObject({
      dryRun: true,
      restored: false,
      agentId: 'fixture-agent',
      target: writtenPath,
    });
    expect(await fs.readFile(writtenPath, 'utf-8')).toBe('original-synthetic-state');
    expect(log.mock.calls.flat().join('\n')).toContain('DRY RUN');
    log.mockRestore();
  });

  it('still imports when the target file does not exist', async () => {
    const targetDir = join(testDir, 'fresh');
    const writtenPath = join(targetDir, 'agent_state.json');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      target: targetDir,
    });

    expect(result).toMatchObject({
      dryRun: false,
      restored: true,
      agentId: 'fixture-agent',
      target: writtenPath,
    });
    await expect(fs.readFile(writtenPath, 'utf-8')).resolves.toContain('fixture-agent');
    log.mockRestore();
  });
});
