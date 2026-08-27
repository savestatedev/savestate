import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState, registerContainerCommands } from '../container.js';

describe('savestate export --dry-run', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-dry-run-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('registers --dry-run on export commands', () => {
    const program = new Command();
    registerContainerCommands(program);
    const exportCmd = program.commands.find((command) => command.name() === 'export');
    const containerExport = program.commands
      .find((command) => command.name() === 'container')
      ?.commands.find((command) => command.name() === 'export');
    expect(exportCmd?.options.some((option) => option.long === '--dry-run')).toBe(true);
    expect(containerExport?.options.some((option) => option.long === '--dry-run')).toBe(true);
  });

  it('encrypts and previews without writing', async () => {
    const filePath = join(testDir, 'preview.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
      dryRun: true,
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false, dryRun: true });
    await expect(fs.access(filePath)).rejects.toThrow();
    expect(log.mock.calls.flat().join('\n')).toContain('DRY RUN');
    expect(log.mock.calls.flat().join('\n')).toContain('  Agent: fixture-agent');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully exported');
    expect(log.mock.calls.flat().join('\n')).not.toContain(`Writing ${filePath}`);
    log.mockRestore();
  });

  it('still previews an existing output file on dry-run without --force', async () => {
    const filePath = join(testDir, 'keep.savestate');
    await fs.writeFile(filePath, 'original-synthetic-container');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
      dryRun: true,
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false, dryRun: true });
    expect(await fs.readFile(filePath, 'utf-8')).toBe('original-synthetic-container');
    expect(log.mock.calls.flat().join('\n')).toContain('DRY RUN');
    expect(error.mock.calls.flat().join('\n')).not.toContain('already exists');
    log.mockRestore();
    error.mockRestore();
  });

  it('still exports when --dry-run is omitted', async () => {
    const filePath = join(testDir, 'written.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    const written = await fs.readFile(filePath);
    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(written.subarray(0, 8).toString('ascii')).toBe('SAVESTAT');
    expect(log.mock.calls.flat().join('\n')).toContain('Successfully exported');
    expect(log.mock.calls.flat().join('\n')).not.toContain('DRY RUN');
    log.mockRestore();
  });
});
