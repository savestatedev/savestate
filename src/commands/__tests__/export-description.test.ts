import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState, registerContainerCommands } from '../container.js';

function readManifest(file: Buffer): {
  description?: string;
  encryption?: { algorithm?: string; keyDerivation?: string };
} {
  const manifestLength = file.readUInt32LE(16);
  return JSON.parse(file.subarray(20, 20 + manifestLength).toString('utf-8'));
}

describe('savestate export optional description', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-description-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('registers --description on export commands', () => {
    const program = new Command();
    registerContainerCommands(program);
    const exportCmd = program.commands.find((command) => command.name() === 'export');
    const containerExport = program.commands
      .find((command) => command.name() === 'container')
      ?.commands.find((command) => command.name() === 'export');
    expect(exportCmd?.options.some((option) => option.long === '--description')).toBe(true);
    expect(containerExport?.options.some((option) => option.long === '--description')).toBe(true);
  });

  it('writes a supplied description on a synthetic export', async () => {
    const filePath = join(testDir, 'with-description.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
      description: 'Synthetic labeled export',
    });

    const written = await fs.readFile(filePath);
    const manifest = readManifest(written);

    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(written.subarray(0, 8).toString('ascii')).toBe('SAVESTAT');
    expect(manifest.description).toBe('Synthetic labeled export');
    expect(manifest.encryption).toEqual({
      algorithm: 'AES-256-GCM',
      keyDerivation: 'Argon2id',
    });
    log.mockRestore();
  });

  it('omits description when the flag is not supplied', async () => {
    const filePath = join(testDir, 'without-description.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    const written = await fs.readFile(filePath);
    const manifest = readManifest(written);

    expect(manifest.description).toBeUndefined();
    expect(manifest.encryption).toEqual({
      algorithm: 'AES-256-GCM',
      keyDerivation: 'Argon2id',
    });
    log.mockRestore();
  });
});
