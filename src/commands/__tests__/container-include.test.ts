import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { decrypt } from '../../container/crypto.js';
import {
  exportState,
  parseIncludePaths,
  registerContainerCommands,
} from '../container.js';

const fixtureRoot = join(
  fileURLToPath(new URL('.', import.meta.url)),
  'fixtures-container-include',
);

async function readExportedState(path: string, passphrase: string): Promise<Record<string, unknown>> {
  const fileBuffer = await fs.readFile(path);
  const manifestLength = fileBuffer.readUInt32LE(16);
  const encryptedState = fileBuffer.subarray(20 + manifestLength);
  const decrypted = await decrypt(encryptedState, { passphrase });
  return JSON.parse(decrypted.toString()) as Record<string, unknown>;
}

describe('savestate export --include', () => {
  beforeAll(async () => {
    await fs.mkdir(fixtureRoot, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(fixtureRoot, { recursive: true, force: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers --include on export commands', () => {
    const program = new Command();
    registerContainerCommands(program);
    const exportCmd = program.commands.find((command) => command.name() === 'export');
    const container = program.commands.find((command) => command.name() === 'container');
    const containerExport = container?.commands.find((command) => command.name() === 'export');
    expect(exportCmd?.options.some((option) => option.long === '--include')).toBe(true);
    expect(containerExport?.options.some((option) => option.long === '--include')).toBe(true);
    expect(exportCmd?.description()).toContain('path selection');
    expect(containerExport?.description()).toContain('path selection');
  });

  it('parses comma-separated include paths', () => {
    expect(parseIncludePaths('memory,personality')).toEqual({
      components: {
        personality: true,
        memory: true,
        tools: false,
        preferences: false,
        conversation_history: false,
      },
    });
  });

  it('rejects an unknown include path', () => {
    expect(parseIncludePaths('memory,secrets')).toEqual({
      error: 'Error: Unknown include path: secrets. Allowed: personality, memory, tools, preferences, conversation_history.',
    });
  });

  it('rejects an empty include list', () => {
    expect(parseIncludePaths(' , ')).toEqual({
      error: 'Error: --include requires at least one path.',
    });
  });

  it('packs only the named paths into a synthetic container', async () => {
    const out = join(fixtureRoot, 'include-memory.savestate');
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
      include: 'memory',
    });

    const state = await readExportedState(out, 'synthetic-passphrase');
    expect(lines).toContain('Including paths: memory');
    expect(state).toHaveProperty('memory');
    expect(state).not.toHaveProperty('personality');
    expect(state).not.toHaveProperty('tools');
    expect(state).not.toHaveProperty('preferences');
    expect(state).not.toHaveProperty('conversation_history');
  });
});
