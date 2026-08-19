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

describe('savestate verify payload byte length mismatch', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-payload-byte-length-mismatch-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(
    fileName: string,
    agentStateByteLength: number,
    extraPayloads: Array<Record<string, unknown>> = [],
  ): Promise<string> {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'] }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const actualHash = createHash('sha256').update(plaintext).digest('hex');
    const manifest = {
      formatVersion: 1,
      created: '2026-08-19T18:01:00.000Z',
      agentId: 'demo-agent',
      payloads: [
        {
          name: 'agent_state',
          contentType: 'application/json',
          byteLength: agentStateByteLength,
          sha256: actualHash,
        },
        ...extraPayloads,
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

  it('rejects a container whose agent_state byte length does not match', async () => {
    const filePath = await writeContainer('mismatched-byte-length.savestate', 99);

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('corrupted');
    expect(result.message).toMatch(/payload byte length 99 does not match/i);
    expect(result.manifest).toBeUndefined();
  });

  it('still verifies a valid container whose agent_state byte length matches', async () => {
    const plaintextLength = Buffer.from(JSON.stringify({ memory: ['demo'] })).length;
    const filePath = await writeContainer('matching-byte-length.savestate', plaintextLength);

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('valid');
    expect(result.manifest?.agentId).toBe('demo-agent');
  });

  it('still verifies a valid container with a second payload of a different byte length', async () => {
    const plaintextLength = Buffer.from(JSON.stringify({ memory: ['demo'] })).length;
    const filePath = await writeContainer('second-payload-byte-length.savestate', plaintextLength, [
      {
        name: 'personality',
        contentType: 'application/json',
        byteLength: 0,
        sha256: 'b'.repeat(64),
      },
    ]);

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('valid');
    expect(result.manifest?.agentId).toBe('demo-agent');
  });

  it('does not treat a wrong passphrase as a byte-length mismatch', async () => {
    const plaintextLength = Buffer.from(JSON.stringify({ memory: ['demo'] })).length;
    const filePath = await writeContainer('wrong-pass.savestate', plaintextLength);

    const result = await verifyContainer(filePath, { passphrase: 'wrong-pass' });

    expect(result.status).toBe('wrong_password');
    expect(result.message).not.toMatch(/payload byte length/i);
  });
});
