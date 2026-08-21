import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { applyExcludePaths, exportState, importState, parseIncludePaths } from '../container.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate --exclude of an unselected include path', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-exclude-unselected-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function createValidContainer(filePath: string, passphrase: string): Promise<void> {
    const agentState = {
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-08-21T21:00:00.000Z',
      personality: { name: 'fixture-agent' },
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
    };
    const plaintext = Buffer.from(JSON.stringify(agentState));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest = {
      formatVersion: 1,
      created: '2026-08-21T21:00:00.000Z',
      agentId: 'fixture-agent',
      payloads: [
        {
          name: 'agent_state',
          contentType: 'application/json',
          byteLength: plaintext.length,
          sha256: createHash('sha256').update(plaintext).digest('hex'),
        },
      ],
    };
    const manifestBuffer = Buffer.from(JSON.stringify(manifest));
    const manifestLength = Buffer.alloc(4);
    manifestLength.writeUInt32LE(manifestBuffer.length, 0);
    await fs.writeFile(
      filePath,
      Buffer.concat([createMagicHeader(1), manifestLength, manifestBuffer, encryptedState]),
    );
  }

  it('rejects an exclude path that is not in the include set', () => {
    const included = parseIncludePaths('memory,tools');
    expect(included).toEqual({
      components: {
        personality: false,
        memory: true,
        tools: true,
        preferences: false,
        conversation_history: false,
      },
    });
    if ('error' in included) {
      throw new Error(included.error);
    }

    expect(applyExcludePaths(included.components, 'personality')).toEqual({
      error: 'Error: Exclude path not selected: personality.',
    });
    expect(applyExcludePaths(included.components, 'memory')).toEqual({
      components: {
        personality: false,
        memory: false,
        tools: true,
        preferences: false,
        conversation_history: false,
      },
    });
  });

  it('rejects export when --exclude names a path outside --include', async () => {
    const filePath = join(testDir, 'unselected-exclude.savestate');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
      include: 'memory,tools',
      exclude: 'personality',
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false });
    await expect(fs.access(filePath)).rejects.toThrow();
    expect(error.mock.calls.flat().join('\n')).toMatch(/exclude path not selected/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully exported');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Encrypting agent state');
    error.mockRestore();
    log.mockRestore();
  });

  it('rejects import when --exclude names a path outside --include', async () => {
    const filePath = join(testDir, 'unselected-import.savestate');
    await createValidContainer(filePath, 'synthetic-passphrase');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      include: 'memory,tools',
      exclude: 'personality',
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat().join('\n')).toMatch(/exclude path not selected/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Decrypting agent state');
    error.mockRestore();
    log.mockRestore();
  });
});
