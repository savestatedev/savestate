import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { decrypt } from '../../container/crypto.js';
import { applyExcludePaths, exportState, registerContainerCommands } from '../container.js';

async function readExportedState(path: string, passphrase: string): Promise<Record<string, unknown>> {
  const fileBuffer = await fs.readFile(path);
  const manifestLength = fileBuffer.readUInt32LE(16);
  const encryptedState = fileBuffer.subarray(20 + manifestLength);
  const decrypted = await decrypt(encryptedState, { passphrase });
  return JSON.parse(decrypted.toString()) as Record<string, unknown>;
}

describe('savestate export --exclude', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-exclude-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('registers --exclude on export commands', () => {
    const program = new Command();
    registerContainerCommands(program);
    const exportCmd = program.commands.find((command) => command.name() === 'export');
    const containerExport = program.commands
      .find((command) => command.name() === 'container')
      ?.commands.find((command) => command.name() === 'export');
    expect(exportCmd?.options.some((option) => option.long === '--exclude')).toBe(true);
    expect(containerExport?.options.some((option) => option.long === '--exclude')).toBe(true);
  });

  it('rejects an unknown exclude path before writing a container', async () => {
    const filePath = join(testDir, 'unknown-exclude.savestate');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(applyExcludePaths(
      { personality: true, memory: true, tools: true, preferences: true, conversation_history: true },
      'secrets',
    )).toEqual({
      error: 'Error: Unknown exclude path: secrets. Allowed: personality, memory, tools, preferences, conversation_history.',
    });

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
      exclude: 'secrets',
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false });
    await expect(fs.access(filePath)).rejects.toThrow();
    expect(error.mock.calls.flat().join('\n')).toMatch(/unknown exclude path/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully exported');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Encrypting agent state');
    error.mockRestore();
    log.mockRestore();
  });

  it('omits excluded paths from a synthetic container', async () => {
    const filePath = join(testDir, 'exclude-personality.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
      exclude: 'personality',
    });

    const state = await readExportedState(filePath, 'synthetic-passphrase');
    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(log.mock.calls.flat()).toContain('Including paths: memory, tools, preferences, conversation_history');
    expect(state).not.toHaveProperty('personality');
    expect(state).toHaveProperty('memory');
    expect(state).toHaveProperty('tools');
    expect(state).toHaveProperty('preferences');
    expect(state).toHaveProperty('conversation_history');
    log.mockRestore();
  });
});
