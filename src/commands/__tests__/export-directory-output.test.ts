import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState, registerContainerCommands } from '../container.js';

function readManifest(file: Buffer): { agentId?: string } {
  const manifestLength = file.readUInt32LE(16);
  return JSON.parse(file.subarray(20, 20 + manifestLength).toString('utf-8'));
}

describe('savestate export directory output path', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-directory-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('registers --output / --out on export commands', () => {
    const program = new Command();
    registerContainerCommands(program);
    const exportCmd = program.commands.find((command) => command.name() === 'export');
    const containerExport = program.commands
      .find((command) => command.name() === 'container')
      ?.commands.find((command) => command.name() === 'export');
    expect(exportCmd?.options.some((option) => option.long === '--output')).toBe(true);
    expect(containerExport?.options.some((option) => option.long === '--out')).toBe(true);
  });

  it('rejects a directory output path before writing a container', async () => {
    const dirPath = join(testDir, 'output-dir');
    await fs.mkdir(dirPath);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: dirPath,
      passphrase: 'synthetic-passphrase',
    });

    const listing = await fs.readdir(dirPath);
    expect(result).toEqual({ written: false, out: dirPath, overwritten: false });
    expect(listing).toEqual([]);
    expect(error.mock.calls.flat().join('\n')).toMatch(/directory/i);
    expect(error.mock.calls.flat().join('\n')).not.toContain('--force');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully exported');
    error.mockRestore();
    log.mockRestore();
  });

  it('does not overwrite a directory when --force is set', async () => {
    const dirPath = join(testDir, 'forced-dir');
    await fs.mkdir(dirPath);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: dirPath,
      passphrase: 'synthetic-passphrase',
      force: true,
    });

    const listing = await fs.readdir(dirPath);
    expect(result).toEqual({ written: false, out: dirPath, overwritten: false });
    expect(listing).toEqual([]);
    expect(error.mock.calls.flat().join('\n')).toMatch(/directory/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully exported');
    error.mockRestore();
    log.mockRestore();
  });

  it('still exports a non-directory output path', async () => {
    const filePath = join(testDir, 'valid-output.savestate');
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
});
