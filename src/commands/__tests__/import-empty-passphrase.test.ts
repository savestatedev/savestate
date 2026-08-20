import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { exportState, importState, registerContainerCommands } from '../container.js';

describe('savestate import empty passphrase', () => {
  let testDir: string;
  let filePath: string;
  const originalEnv = process.env.SAVESTATE_PASSPHRASE;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-empty-passphrase-${Date.now()}`);
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

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SAVESTATE_PASSPHRASE;
    } else {
      process.env.SAVESTATE_PASSPHRASE = originalEnv;
    }
  });

  it('registers --passphrase on import and container import', () => {
    const program = new Command();
    registerContainerCommands(program);
    const importCmd = program.commands.find((command) => command.name() === 'import');
    const container = program.commands.find((command) => command.name() === 'container');
    const containerImport = container?.commands.find((command) => command.name() === 'import');
    expect(importCmd?.options.find((option) => option.long === '--passphrase')).toBeDefined();
    expect(containerImport?.options.find((option) => option.long === '--passphrase')).toBeDefined();
  });

  it('rejects an empty passphrase before decrypting', async () => {
    process.env.SAVESTATE_PASSPHRASE = 'synthetic-env-pass';
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: '',
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat().join('\n')).toMatch(/passphrase/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Decrypting agent state');
    error.mockRestore();
    log.mockRestore();
  });

  it('rejects a whitespace-only passphrase before decrypting', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: '   ',
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat().join('\n')).toMatch(/passphrase/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Decrypting agent state');
    error.mockRestore();
    log.mockRestore();
  });

  it('still imports a non-empty passphrase', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      dryRun: true,
    });

    expect(result).toMatchObject({
      dryRun: true,
      restored: false,
      agentId: 'fixture-agent',
    });
    expect(log.mock.calls.flat().join('\n')).toContain('DRY RUN');
    log.mockRestore();
  });

  it('keeps the current prompt or env path when --passphrase is omitted', async () => {
    process.env.SAVESTATE_PASSPHRASE = 'synthetic-passphrase';
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      dryRun: true,
    });

    expect(result).toMatchObject({
      dryRun: true,
      restored: false,
      agentId: 'fixture-agent',
    });
    log.mockRestore();
  });
});
