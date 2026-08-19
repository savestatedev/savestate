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

describe('savestate verify payload byte length number', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-payload-byte-length-number-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(
    fileName: string,
    extraByteLength: unknown,
  ): Promise<string> {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'] }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const actualHash = createHash('sha256').update(plaintext).digest('hex');
    const manifest = {
      formatVersion: 1,
      created: '2026-08-18T20:01:00.000Z',
      agentId: 'demo-agent',
      payloads: [
        {
          name: 'agent_state',
          contentType: 'application/json',
          byteLength: plaintext.length,
          sha256: actualHash,
        },
        {
          name: 'memory',
          contentType: 'application/json',
          byteLength: extraByteLength,
          sha256: actualHash,
        },
      ],
    };
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

  it('rejects a container whose payload byte length is not a number', async () => {
    const filePath = await writeContainer('string-byte-length.savestate', '156');

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('corrupted');
    expect(result.message).toMatch(/payload byte length/i);
    expect(result.manifest).toBeUndefined();
  });

  it('still verifies a valid container with a numeric payload byte length of zero', async () => {
    const filePath = await writeContainer('zero-byte-length.savestate', 0);

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('valid');
    expect(result.manifest?.agentId).toBe('demo-agent');
  });

  it('still verifies a valid container with numeric payload byte lengths', async () => {
    const filePath = await writeContainer(
      'valid-byte-length.savestate',
      Buffer.from(JSON.stringify({ memory: ['demo'] })).length,
    );

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('valid');
    expect(result.manifest?.agentId).toBe('demo-agent');
  });

  it('does not treat a wrong passphrase as a byte-length number failure', async () => {
    const filePath = await writeContainer(
      'wrong-pass.savestate',
      Buffer.from(JSON.stringify({ memory: ['demo'] })).length,
    );

    const result = await verifyContainer(filePath, { passphrase: 'wrong-pass' });

    expect(result.status).toBe('wrong_password');
    expect(result.message).not.toMatch(/payload byte length/i);
  });
});
