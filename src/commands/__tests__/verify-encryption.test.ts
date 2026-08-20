import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { formatVerifyEncryption, verifyContainer } from '../verify.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate verify encryption algorithm', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-enc-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('returns the manifest encryption algorithm after a valid checksum comparison', async () => {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'], tools: [] }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest = {
      formatVersion: 1,
      created: '2026-08-18T09:00:00.000Z',
      agentId: 'demo-agent',
      encryption: {
        algorithm: 'AES-256-GCM',
        keyDerivation: 'Argon2id',
      },
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
    const filePath = join(testDir, 'valid.savestate');
    await writeFile(
      filePath,
      Buffer.concat([createMagicHeader(), manifestLength, manifestBuffer, encryptedState]),
    );

    const result = await verifyContainer(filePath, { passphrase });

    expect(result.status).toBe('valid');
    expect(result.encryptionAlgorithm).toBe('AES-256-GCM');
    expect(formatVerifyEncryption(result.encryptionAlgorithm!)).toBe('   Encryption: AES-256-GCM');
  });

  it('falls back to AES-256-GCM when the manifest omits encryption metadata', async () => {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'] }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest = {
      formatVersion: 1,
      created: '2026-08-18T09:00:00.000Z',
      agentId: 'demo-agent',
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
    const filePath = join(testDir, 'no-enc-meta.savestate');
    await writeFile(
      filePath,
      Buffer.concat([createMagicHeader(), manifestLength, manifestBuffer, encryptedState]),
    );

    const result = await verifyContainer(filePath, { passphrase });

    expect(result.status).toBe('valid');
    expect(result.encryptionAlgorithm).toBe('AES-256-GCM');
  });

  it('omits an encryption algorithm when the passphrase is wrong', async () => {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'] }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest = {
      formatVersion: 1,
      created: '2026-08-18T09:00:00.000Z',
      agentId: 'demo-agent',
      encryption: {
        algorithm: 'AES-256-GCM',
        keyDerivation: 'Argon2id',
      },
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
    const filePath = join(testDir, 'wrong-pass.savestate');
    await writeFile(
      filePath,
      Buffer.concat([createMagicHeader(), manifestLength, manifestBuffer, encryptedState]),
    );

    const result = await verifyContainer(filePath, { passphrase: 'wrong-pass' });

    expect(result.status).toBe('wrong_password');
    expect(result.encryptionAlgorithm).toBeUndefined();
  });

  it('prints an Encryption line for a known algorithm', () => {
    expect(formatVerifyEncryption('AES-256-GCM')).toBe('   Encryption: AES-256-GCM');
    expect(formatVerifyEncryption('AES-256-GCM')).not.toContain('Agent:');
  });
});
