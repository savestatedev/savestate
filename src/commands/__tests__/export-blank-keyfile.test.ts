import { randomBytes } from 'node:crypto';
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

describe('savestate export blank keyfile', () => {
  let testDir: string;
  const originalEnv = process.env.SAVESTATE_PASSPHRASE;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-blank-keyfile-${Date.now()}`);
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

  it('registers --keyfile on export and container export', () => {
    const program = new Command();
    registerContainerCommands(program);
    const exportCmd = program.commands.find((command) => command.name() === 'export');
    const container = program.commands.find((command) => command.name() === 'container');
    const containerExport = container?.commands.find((command) => command.name() === 'export');
    expect(exportCmd?.options.find((option) => option.long === '--keyfile')).toBeDefined();
    expect(containerExport?.options.find((option) => option.long === '--keyfile')).toBeDefined();
  });

  it('rejects a 0-byte keyfile before encrypting', async () => {
    process.env.SAVESTATE_PASSPHRASE = 'synthetic-env-pass';
    const filePath = join(testDir, 'empty-keyfile.savestate');
    const emptyKeyfilePath = join(testDir, 'empty.key');
    await fs.writeFile(emptyKeyfilePath, '');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      keyfile: emptyKeyfilePath,
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false });
    await expect(fs.access(filePath)).rejects.toThrow();
    expect(error.mock.calls.flat().join('\n')).toMatch(/keyfile/i);
    expect(error.mock.calls.flat().join('\n')).toMatch(/contents/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Encrypting agent state');
    error.mockRestore();
    log.mockRestore();
  });

  it('rejects a whitespace-only keyfile before encrypting', async () => {
    const filePath = join(testDir, 'whitespace-keyfile.savestate');
    const whitespaceKeyfilePath = join(testDir, 'whitespace.key');
    await fs.writeFile(whitespaceKeyfilePath, '   \n');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      keyfile: whitespaceKeyfilePath,
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false });
    await expect(fs.access(filePath)).rejects.toThrow();
    expect(error.mock.calls.flat().join('\n')).toMatch(/keyfile/i);
    expect(error.mock.calls.flat().join('\n')).toMatch(/contents/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Encrypting agent state');
    error.mockRestore();
    log.mockRestore();
  });

  it('still exports a non-empty keyfile', async () => {
    const filePath = join(testDir, 'valid-keyfile.savestate');
    const keyfilePath = join(testDir, 'synthetic.key');
    await fs.writeFile(keyfilePath, randomBytes(32));
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      keyfile: keyfilePath,
    });

    const written = await fs.readFile(filePath);
    const manifest = readManifest(written);

    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(written.subarray(0, 8).toString('ascii')).toBe('SAVESTAT');
    expect(manifest.agentId).toBe('fixture-agent');
    log.mockRestore();
  });

  it('keeps the current prompt or env path when --keyfile is omitted', async () => {
    process.env.SAVESTATE_PASSPHRASE = 'synthetic-passphrase';
    const filePath = join(testDir, 'omitted-keyfile.savestate');
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
