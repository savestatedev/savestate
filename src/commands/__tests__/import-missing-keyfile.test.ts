import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { exportState, importState, registerContainerCommands } from '../container.js';

describe('savestate import missing keyfile', () => {
  let testDir: string;
  let filePath: string;
  const originalEnv = process.env.SAVESTATE_PASSPHRASE;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-missing-keyfile-${Date.now()}`);
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

  it('registers --keyfile on import and container import', () => {
    const program = new Command();
    registerContainerCommands(program);
    const importCmd = program.commands.find((command) => command.name() === 'import');
    const container = program.commands.find((command) => command.name() === 'container');
    const containerImport = container?.commands.find((command) => command.name() === 'import');
    expect(importCmd?.options.find((option) => option.long === '--keyfile')).toBeDefined();
    expect(containerImport?.options.find((option) => option.long === '--keyfile')).toBeDefined();
  });

  it('rejects a missing keyfile before restoring agent state', async () => {
    process.env.SAVESTATE_PASSPHRASE = 'synthetic-env-pass';
    const missingKeyfile = join(testDir, 'does-not-exist.key');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      keyfile: missingKeyfile,
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat().join('\n')).toMatch(/keyfile/i);
    expect(error.mock.calls.flat().join('\n')).toMatch(/not found/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Decrypting agent state');
    error.mockRestore();
    log.mockRestore();
  });

  it('still imports a keyfile path that exists', async () => {
    const keyfilePath = join(testDir, 'synthetic.key');
    const keyfileExport = join(testDir, 'keyfile-fixture.savestate');
    await fs.writeFile(keyfilePath, randomBytes(32));
    const exported = await exportState({
      agent: 'fixture-agent',
      out: keyfileExport,
      keyfile: keyfilePath,
    });
    expect(exported.written).toBe(true);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: keyfileExport,
      keyfile: keyfilePath,
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

  it('keeps the current prompt or env path when --keyfile is omitted', async () => {
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
