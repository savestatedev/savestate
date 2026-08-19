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

describe('savestate verify payload name', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-payload-name-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(
    fileName: string,
    payloadName: string | undefined,
  ): Promise<string> {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'] }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const payload: Record<string, unknown> = {
      contentType: 'application/json',
      byteLength: plaintext.length,
      sha256: createHash('sha256').update(plaintext).digest('hex'),
    };
    if (payloadName !== undefined) {
      payload.name = payloadName;
    }
    const manifest = {
      formatVersion: 1,
      created: '2026-08-18T13:00:00.000Z',
      agentId: 'demo-agent',
      payloads: [payload],
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

  it('rejects a container whose payload name is missing', async () => {
    const filePath = await writeContainer('missing-name.savestate', undefined);

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('corrupted');
    expect(result.message).toMatch(/payload name/i);
    expect(result.manifest).toBeUndefined();
  });

  it('rejects a container whose payload name is empty', async () => {
    const filePath = await writeContainer('empty-name.savestate', '   ');

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('corrupted');
    expect(result.message).toMatch(/payload name/i);
    expect(result.manifest).toBeUndefined();
  });

  it('still verifies a valid container with a named payload', async () => {
    const filePath = await writeContainer('valid-name.savestate', 'agent_state');

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('valid');
    expect(result.manifest?.agentId).toBe('demo-agent');
  });

  it('does not treat a wrong passphrase as a payload-name failure', async () => {
    const filePath = await writeContainer('wrong-pass.savestate', 'agent_state');

    const result = await verifyContainer(filePath, { passphrase: 'wrong-pass' });

    expect(result.status).toBe('wrong_password');
    expect(result.message).not.toMatch(/payload name/i);
  });
});
