import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { decrypt } from '../../container/crypto.js';
import { exportState, importState, registerContainerCommands } from '../container.js';

const fixtureRoot = join(
  fileURLToPath(new URL('.', import.meta.url)),
  'fixtures-passphrase-prompt',
);

describe('savestate export/import passphrase prompt', () => {
  const originalEnv = process.env.SAVESTATE_PASSPHRASE;

  beforeAll(async () => {
    await fs.mkdir(fixtureRoot, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(fixtureRoot, { recursive: true, force: true });
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SAVESTATE_PASSPHRASE;
    } else {
      process.env.SAVESTATE_PASSPHRASE = originalEnv;
    }
    vi.restoreAllMocks();
  });

  it('registers passphrase fallback help on export and import commands', () => {
    const program = new Command();
    registerContainerCommands(program);
    const exportCmd = program.commands.find((command) => command.name() === 'export');
    const importCmd = program.commands.find((command) => command.name() === 'import');
    const container = program.commands.find((command) => command.name() === 'container');
    const containerExport = container?.commands.find((command) => command.name() === 'export');
    const containerImport = container?.commands.find((command) => command.name() === 'import');
    const help = 'SAVESTATE_PASSPHRASE / prompt';
    expect(exportCmd?.options.find((option) => option.long === '--passphrase')?.description).toContain(help);
    expect(importCmd?.options.find((option) => option.long === '--passphrase')?.description).toContain(help);
    expect(containerExport?.options.find((option) => option.long === '--passphrase')?.description).toContain(help);
    expect(containerImport?.options.find((option) => option.long === '--passphrase')?.description).toContain(help);
  });

  it('exports with SAVESTATE_PASSPHRASE when key flags are omitted', async () => {
    process.env.SAVESTATE_PASSPHRASE = 'synthetic-passphrase';
    const out = join(fixtureRoot, 'env-export.savestate');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out,
    });

    expect(result).toEqual({ written: true, out, overwritten: false });
    const fileBuffer = await fs.readFile(out);
    const magic = fileBuffer.subarray(0, 8).toString('ascii');
    expect(magic).toBe('SAVESTAT');
    const manifestLength = fileBuffer.readUInt32LE(16);
    const encryptedState = fileBuffer.subarray(20 + manifestLength);
    const decrypted = await decrypt(encryptedState, { passphrase: 'synthetic-passphrase' });
    expect(JSON.parse(decrypted.toString()).agentId).toBe('fixture-agent');
  });

  it('keeps an explicit --passphrase ahead of SAVESTATE_PASSPHRASE', async () => {
    process.env.SAVESTATE_PASSPHRASE = 'env-pass-word';
    const out = join(fixtureRoot, 'flag-export.savestate');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await exportState({
      agent: 'fixture-agent',
      out,
      passphrase: 'flag-pass-word',
    });

    const fileBuffer = await fs.readFile(out);
    const manifestLength = fileBuffer.readUInt32LE(16);
    const encryptedState = fileBuffer.subarray(20 + manifestLength);
    await expect(decrypt(encryptedState, { passphrase: 'flag-pass-word' })).resolves.toBeInstanceOf(Buffer);
    await expect(decrypt(encryptedState, { passphrase: 'env-pass-word' })).rejects.toThrow();
  });

  it('imports with SAVESTATE_PASSPHRASE when key flags are omitted', async () => {
    const out = join(fixtureRoot, 'roundtrip.savestate');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await exportState({
      agent: 'fixture-agent',
      out,
      passphrase: 'synthetic-passphrase',
    });

    process.env.SAVESTATE_PASSPHRASE = 'synthetic-passphrase';
    await importState({ in: out });
    expect(true).toBe(true);
  });

  it('fails without writing when no passphrase is available', async () => {
    delete process.env.SAVESTATE_PASSPHRASE;
    const out = join(fixtureRoot, 'missing.savestate');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as never);

    await expect(exportState({ agent: 'fixture-agent', out })).rejects.toThrow('process.exit:1');
    expect(exit).toHaveBeenCalledWith(1);
    await expect(fs.stat(out)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
