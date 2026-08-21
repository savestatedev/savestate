import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { decrypt } from '../../container/crypto.js';
import {
  exportState,
  parseIncludePaths,
  registerContainerCommands,
} from '../container.js';

async function readExportedState(path: string, passphrase: string): Promise<Record<string, unknown>> {
  const fileBuffer = await fs.readFile(path);
  const manifestLength = fileBuffer.readUInt32LE(16);
  const encryptedState = fileBuffer.subarray(20 + manifestLength);
  const decrypted = await decrypt(encryptedState, { passphrase });
  return JSON.parse(decrypted.toString()) as Record<string, unknown>;
}

describe('savestate export --include conversation_history', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-conversation-history-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists conversation_history in --include help', () => {
    const program = new Command();
    registerContainerCommands(program);
    const exportCmd = program.commands.find((command) => command.name() === 'export');
    const include = exportCmd?.options.find((option) => option.long === '--include');
    expect(include?.description).toContain('conversation_history');
  });

  it('parses conversation_history as an include path', () => {
    expect(parseIncludePaths('conversation_history')).toEqual({
      components: {
        personality: false,
        memory: false,
        tools: false,
        preferences: false,
        conversation_history: true,
      },
    });
  });

  it('packs conversation_history into a synthetic container', async () => {
    const filePath = join(testDir, 'conversation-history.savestate');
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message?: unknown) => {
      if (typeof message === 'string') {
        lines.push(message);
      }
    });

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
      include: 'conversation_history',
    });

    const state = await readExportedState(filePath, 'synthetic-passphrase');
    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(lines).toContain('Including paths: conversation_history');
    expect(state).toHaveProperty('conversation_history');
    expect(state).not.toHaveProperty('personality');
    expect(state).not.toHaveProperty('memory');
    expect(state).not.toHaveProperty('tools');
    expect(state).not.toHaveProperty('preferences');
  });
});
