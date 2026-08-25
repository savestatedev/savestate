import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { formatImportInput, importState } from '../container.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate import input corrupted output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-input-corrupted-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(fileName: string): Promise<string> {
    const passphrase = 'synthetic-passphrase';
    const plaintext = Buffer.from(JSON.stringify({
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-08-25T05:00:00.000Z',
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
    }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      created: '2026-08-25T05:00:00.000Z',
      agentId: 'fixture-agent',
      payloads: [
        {
          name: 'agent_state',
          contentType: 'application/json',
          byteLength: plaintext.length,
          sha256: 'a'.repeat(64),
        },
      ],
    };
    const manifestBuffer = Buffer.from(JSON.stringify(manifest));
    const manifestLength = Buffer.alloc(4);
    manifestLength.writeUInt32LE(manifestBuffer.length, 0);
    const filePath = join(testDir, fileName);
    await fs.writeFile(
      filePath,
      Buffer.concat([createMagicHeader(1), manifestLength, manifestBuffer, encryptedState]),
    );
    return filePath;
  }

  it('formats the input path on its own line', () => {
    expect(formatImportInput('/tmp/agent.savestate')).toBe('  Input: /tmp/agent.savestate');
    expect(formatImportInput('/tmp/agent.savestate')).not.toContain('Agent:');
  });

  it('prints the input path when the file is corrupted', async () => {
    const filePath = await writeContainer('corrupted-input.savestate');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? ''}`);
    }) as typeof process.exit);

    await expect(
      importState({
        in: filePath,
        passphrase: 'synthetic-passphrase',
      }),
    ).rejects.toThrow(/process\.exit:1/);

    expect(error.mock.calls.flat()).toContain(formatImportInput(filePath));
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.startsWith('  Input:'))).toBe(false);
    error.mockRestore();
    log.mockRestore();
    exit.mockRestore();
  });

  it('omits an input line when the file is not a SaveState container', async () => {
    const filePath = join(testDir, 'not-a-container.bin');
    await fs.writeFile(filePath, Buffer.from('not-a-savestate-file'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? ''}`);
    }) as typeof process.exit);

    await expect(
      importState({
        in: filePath,
        passphrase: 'synthetic-passphrase',
      }),
    ).rejects.toThrow(/process\.exit:1/);

    expect(error.mock.calls.flat().some((line) => typeof line === 'string' && line.includes('Input:'))).toBe(false);
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.includes('Input:'))).toBe(false);
    error.mockRestore();
    log.mockRestore();
    exit.mockRestore();
  });
});
