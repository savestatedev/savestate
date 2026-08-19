import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState, registerContainerCommands } from '../container.js';

describe('savestate export overwrite guard', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-overwrite-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('registers --force on export commands', () => {
    const program = new Command();
    registerContainerCommands(program);
    const exportCmd = program.commands.find((command) => command.name() === 'export');
    const containerExport = program.commands
      .find((command) => command.name() === 'container')
      ?.commands.find((command) => command.name() === 'export');
    expect(exportCmd?.options.some((option) => option.long === '--force')).toBe(true);
    expect(containerExport?.options.some((option) => option.long === '--force')).toBe(true);
  });

  it('refuses to replace an existing file without --force', async () => {
    const filePath = join(testDir, 'keep.savestate');
    await fs.writeFile(filePath, 'original-synthetic-container');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false });
    expect(await fs.readFile(filePath, 'utf-8')).toBe('original-synthetic-container');
    expect(error.mock.calls.flat().join('\n')).toContain('already exists');
    expect(error.mock.calls.flat().join('\n')).toContain('--force');
    error.mockRestore();
  });

  it('overwrites an existing file when --force is set', async () => {
    const filePath = join(testDir, 'replace.savestate');
    await fs.writeFile(filePath, 'original-synthetic-container');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
      force: true,
    });

    const written = await fs.readFile(filePath);
    expect(result).toEqual({ written: true, out: filePath, overwritten: true });
    expect(written.subarray(0, 8).toString('ascii')).toBe('SAVESTAT');
    expect(written.toString('utf-8')).not.toBe('original-synthetic-container');
    expect(log.mock.calls.flat().join('\n')).toContain('Successfully exported');
    log.mockRestore();
  });
});
