import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { exportState, importState, registerContainerCommands } from '../container.js';

describe('savestate import blank keyfile', () => {
  let testDir: string;
  let passphraseFilePath: string;
  let keyfilePath: string;
  let keyfileContainerPath: string;
  const originalEnv = process.env.SAVESTATE_PASSPHRASE;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-blank-keyfile-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    passphraseFilePath = join(testDir, 'passphrase-fixture.savestate');
    const passphraseExported = await exportState({
      agent: 'fixture-agent',
      out: passphraseFilePath,
      passphrase: 'synthetic-passphrase',
    });
    expect(passphraseExported.written).toBe(true);

    keyfilePath = join(testDir, 'synthetic.key');
    await fs.writeFile(keyfilePath, randomBytes(32));
    keyfileContainerPath = join(testDir, 'keyfile-fixture.savestate');
    const keyfileExported = await exportState({
      agent: 'fixture-agent',
      out: keyfileContainerPath,
      keyfile: keyfilePath,
    });
    expect(keyfileExported.written).toBe(true);
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

  it('rejects a 0-byte keyfile before decrypting', async () => {
    process.env.SAVESTATE_PASSPHRASE = 'synthetic-env-pass';
    const emptyKeyfilePath = join(testDir, 'empty.key');
    await fs.writeFile(emptyKeyfilePath, '');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: passphraseFilePath,
      keyfile: emptyKeyfilePath,
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat().join('\n')).toMatch(/keyfile/i);
    expect(error.mock.calls.flat().join('\n')).toMatch(/contents/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Decrypting agent state');
    expect(log.mock.calls.flat().join('\n')).not.toContain('incorrect passphrase');
    error.mockRestore();
    log.mockRestore();
  });

  it('rejects a whitespace-only keyfile before decrypting', async () => {
    const whitespaceKeyfilePath = join(testDir, 'whitespace.key');
    await fs.writeFile(whitespaceKeyfilePath, '   \n');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: passphraseFilePath,
      keyfile: whitespaceKeyfilePath,
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat().join('\n')).toMatch(/keyfile/i);
    expect(error.mock.calls.flat().join('\n')).toMatch(/contents/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Decrypting agent state');
    expect(log.mock.calls.flat().join('\n')).not.toContain('incorrect passphrase');
    error.mockRestore();
    log.mockRestore();
  });

  it('still imports a non-empty keyfile', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: keyfileContainerPath,
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
      in: passphraseFilePath,
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
