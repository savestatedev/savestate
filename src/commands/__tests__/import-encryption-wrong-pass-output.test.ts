import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { formatImportEncryption, importState } from '../container.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate import encryption wrong-password output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-encryption-wrong-pass-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(fileName: string, encryption?: unknown): Promise<string> {
    const passphrase = 'synthetic-passphrase';
    const plaintext = Buffer.from(JSON.stringify({
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-08-24T18:00:00.000Z',
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
    }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      created: '2026-08-24T18:00:00.000Z',
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
    if (encryption !== undefined) {
      manifest.encryption = encryption;
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

  it('formats the encryption algorithm on its own line', () => {
    expect(formatImportEncryption('AES-256-GCM')).toBe('  Encryption: AES-256-GCM');
    expect(formatImportEncryption('AES-256-GCM')).not.toContain('Agent:');
  });

  it('prints the encryption algorithm when the passphrase is wrong', async () => {
    const filePath = await writeContainer('wrong-pass-encryption.savestate', {
      algorithm: 'AES-256-GCM',
      keyDerivation: 'Argon2id',
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'wrong-pass',
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat()).toContain('  Encryption: AES-256-GCM');
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.startsWith('  Encryption:'))).toBe(false);
    error.mockRestore();
    log.mockRestore();
  });

  it('omits the encryption line when the passphrase is wrong and algorithm is empty', async () => {
    const filePath = await writeContainer('wrong-pass-empty-encryption.savestate', {
      algorithm: '   ',
      keyDerivation: 'Argon2id',
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'wrong-pass',
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat().some((line) => typeof line === 'string' && line.includes('Encryption:'))).toBe(false);
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.includes('Encryption:'))).toBe(false);
    error.mockRestore();
    log.mockRestore();
  });

  it('omits an encryption line when the file is not a SaveState container', async () => {
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

    expect(error.mock.calls.flat().some((line) => typeof line === 'string' && line.includes('Encryption:'))).toBe(false);
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.includes('Encryption:'))).toBe(false);
    error.mockRestore();
    log.mockRestore();
    exit.mockRestore();
  });
});
