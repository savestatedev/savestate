import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  exportState,
  importState,
  registerContainerCommands,
  reportContainerProgress,
} from '../container.js';

const fixtureRoot = join(
  fileURLToPath(new URL('.', import.meta.url)),
  'fixtures-container-progress',
);

describe('savestate export/import progress', () => {
  beforeAll(async () => {
    await fs.mkdir(fixtureRoot, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(fixtureRoot, { recursive: true, force: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers progress help on export and import commands', () => {
    const program = new Command();
    registerContainerCommands(program);
    const exportCmd = program.commands.find((command) => command.name() === 'export');
    const importCmd = program.commands.find((command) => command.name() === 'import');
    const container = program.commands.find((command) => command.name() === 'container');
    const containerExport = container?.commands.find((command) => command.name() === 'export');
    const containerImport = container?.commands.find((command) => command.name() === 'import');
    const help = 'byte-size progress';
    expect(exportCmd?.description()).toContain(help);
    expect(importCmd?.description()).toContain(help);
    expect(containerExport?.description()).toContain(help);
    expect(containerImport?.description()).toContain(help);
  });

  it('formats a phase with an optional byte size', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(reportContainerProgress('Encrypting agent state', 128)).toBe(
      'Encrypting agent state (128 bytes)',
    );
    expect(reportContainerProgress('Restoring agent fixture-agent')).toBe(
      'Restoring agent fixture-agent',
    );
    expect(log).toHaveBeenCalledWith('Encrypting agent state (128 bytes)');
  });

  it('prints encrypt and write byte sizes during export', async () => {
    const out = join(fixtureRoot, 'progress-export.savestate');
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message?: unknown) => {
      if (typeof message === 'string') {
        lines.push(message);
      }
    });

    await exportState({
      agent: 'fixture-agent',
      out,
      passphrase: 'synthetic-passphrase',
    });

    const file = await fs.stat(out);
    expect(lines.some((line) => line.startsWith('Encrypting agent state (') && line.endsWith(' bytes)'))).toBe(true);
    expect(lines).toContain(`Writing ${out} (${file.size} bytes)`);
    expect(file.size).toBeGreaterThan(0);
  });

  it('prints read, decrypt, verify, and restore progress during import', async () => {
    const out = join(fixtureRoot, 'progress-import.savestate');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await exportState({
      agent: 'fixture-agent',
      out,
      passphrase: 'synthetic-passphrase',
    });

    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message?: unknown) => {
      if (typeof message === 'string') {
        lines.push(message);
      }
    });

    await importState({
      in: out,
      passphrase: 'synthetic-passphrase',
    });

    const file = await fs.stat(out);
    expect(lines).toContain(`Reading ${out} (${file.size} bytes)`);
    expect(lines.some((line) => line.startsWith('Decrypting agent state (') && line.endsWith(' bytes)'))).toBe(true);
    expect(lines.some((line) => line.startsWith('Verifying integrity (') && line.endsWith(' bytes)'))).toBe(true);
    expect(lines).toContain('Restoring agent fixture-agent');
  });
});
