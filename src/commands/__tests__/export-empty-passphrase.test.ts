import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { exportState, registerContainerCommands } from '../container.js';

function readManifest(file: Buffer): { agentId?: string } {
  const manifestLength = file.readUInt32LE(16);
  return JSON.parse(file.subarray(20, 20 + manifestLength).toString('utf-8'));
}

describe('savestate export empty passphrase', () => {
  let testDir: string;
  const originalEnv = process.env.SAVESTATE_PASSPHRASE;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-empty-passphrase-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
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

  it('registers --passphrase on export and container export', () => {
    const program = new Command();
    registerContainerCommands(program);
    const exportCmd = program.commands.find((command) => command.name() === 'export');
    const container = program.commands.find((command) => command.name() === 'container');
    const containerExport = container?.commands.find((command) => command.name() === 'export');
    expect(exportCmd?.options.find((option) => option.long === '--passphrase')).toBeDefined();
    expect(containerExport?.options.find((option) => option.long === '--passphrase')).toBeDefined();
  });

  it('rejects an empty passphrase before writing a file', async () => {
    process.env.SAVESTATE_PASSPHRASE = 'synthetic-env-pass';
    const filePath = join(testDir, 'empty-passphrase.savestate');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: '',
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false });
    await expect(fs.access(filePath)).rejects.toThrow();
    expect(error.mock.calls.flat().join('\n')).toMatch(/passphrase/i);
    error.mockRestore();
  });

  it('rejects a whitespace-only passphrase before writing a file', async () => {
    const filePath = join(testDir, 'whitespace-passphrase.savestate');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: '   ',
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false });
    await expect(fs.access(filePath)).rejects.toThrow();
    expect(error.mock.calls.flat().join('\n')).toMatch(/passphrase/i);
    error.mockRestore();
  });

  it('still exports a non-empty passphrase', async () => {
    const filePath = join(testDir, 'valid-passphrase.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    const written = await fs.readFile(filePath);
    const manifest = readManifest(written);

    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(written.subarray(0, 8).toString('ascii')).toBe('SAVESTAT');
    expect(manifest.agentId).toBe('fixture-agent');
    log.mockRestore();
  });

  it('keeps the current prompt or env path when --passphrase is omitted', async () => {
    process.env.SAVESTATE_PASSPHRASE = 'synthetic-passphrase';
    const filePath = join(testDir, 'omitted-passphrase.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
    });

    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    await expect(fs.access(filePath)).resolves.toBeUndefined();
    log.mockRestore();
  });
});
