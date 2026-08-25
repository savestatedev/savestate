import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { formatImportExcluded, importState } from '../container.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate import excluded wrong-password output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-excluded-wrong-pass-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(fileName: string, excluded?: unknown): Promise<string> {
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
          sha256: createHash('sha256').update(plaintext).digest('hex'),
        },
      ],
    };
    if (excluded !== undefined) {
      manifest.excluded = excluded;
    }
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

  it('formats excluded paths on their own line', () => {
    expect(formatImportExcluded(['personality'])).toBe('  Excluded: personality');
    expect(formatImportExcluded(['personality', 'tools'])).toBe('  Excluded: personality, tools');
    expect(formatImportExcluded(['personality'])).not.toContain('Agent:');
  });

  it('prints excluded paths when the passphrase is wrong', async () => {
    const filePath = await writeContainer('wrong-pass-excluded.savestate', ['personality']);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'wrong-pass',
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat()).toContain('  Excluded: personality');
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.startsWith('  Excluded:'))).toBe(false);
    error.mockRestore();
    log.mockRestore();
  });

  it('omits the excluded line when the passphrase is wrong and the archive has none', async () => {
    const filePath = await writeContainer('wrong-pass-missing-excluded.savestate');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'wrong-pass',
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat().some((line) => typeof line === 'string' && line.includes('Excluded:'))).toBe(false);
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.includes('Excluded:'))).toBe(false);
    error.mockRestore();
    log.mockRestore();
  });

  it('omits an excluded line when the file is not a SaveState container', async () => {
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

    expect(error.mock.calls.flat().some((line) => typeof line === 'string' && line.includes('Excluded:'))).toBe(false);
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.includes('Excluded:'))).toBe(false);
    error.mockRestore();
    log.mockRestore();
    exit.mockRestore();
  });
});
