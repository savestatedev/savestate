import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { verifyContainer } from '../verify.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate verify missing key derivation', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-missing-key-derivation-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(
    fileName: string,
    encryption?: unknown,
  ): Promise<string> {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'] }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const actualHash = createHash('sha256').update(plaintext).digest('hex');
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      created: '2026-08-20T01:30:00.000Z',
      agentId: 'demo-agent',
      payloads: [
        {
          name: 'agent_state',
          contentType: 'application/json',
          byteLength: plaintext.length,
          sha256: actualHash,
        },
      ],
    };
    if (arguments.length > 1) {
      manifest.encryption = encryption;
    }
    const manifestBuffer = Buffer.from(JSON.stringify(manifest));
    const manifestLength = Buffer.alloc(4);
    manifestLength.writeUInt32LE(manifestBuffer.length, 0);
    const filePath = join(testDir, fileName);
    await writeFile(
      filePath,
      Buffer.concat([createMagicHeader(1), manifestLength, manifestBuffer, encryptedState]),
    );
    return filePath;
  }

  it('rejects a container whose encryption object omits key derivation', async () => {
    const filePath = await writeContainer('missing-key-derivation.savestate', {
      algorithm: 'AES-256-GCM',
    });

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('corrupted');
    expect(result.message).toMatch(/key derivation/i);
    expect(result.message).not.toMatch(/agent/i);
    expect(result.message).not.toMatch(/checksum/i);
    expect(result.message).not.toMatch(/algorithm/i);
    expect(result.manifest).toBeUndefined();
  });

  it('still verifies a valid container that omits encryption', async () => {
    const filePath = await writeContainer('omitted-encryption.savestate');

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('valid');
    expect(result.manifest?.agentId).toBe('demo-agent');
  });

  it('still verifies a valid container whose key derivation is present', async () => {
    const filePath = await writeContainer('present-key-derivation.savestate', {
      algorithm: 'AES-256-GCM',
      keyDerivation: 'Argon2id',
    });

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('valid');
    expect(result.manifest?.agentId).toBe('demo-agent');
    expect(result.keyDerivation).toBe('Argon2id');
  });

  it('does not treat a wrong passphrase as a missing key derivation', async () => {
    const filePath = await writeContainer('wrong-pass.savestate', {
      algorithm: 'AES-256-GCM',
      keyDerivation: 'Argon2id',
    });

    const result = await verifyContainer(filePath, { passphrase: 'wrong-pass' });

    expect(result.status).toBe('wrong_password');
    expect(result.message).not.toMatch(/key derivation/i);
  });
});
