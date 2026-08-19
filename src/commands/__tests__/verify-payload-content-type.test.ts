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

describe('savestate verify payload content type', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-payload-content-type-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(
    fileName: string,
    contentType: string | undefined,
  ): Promise<string> {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'] }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const payload: Record<string, unknown> = {
      name: 'agent_state',
      byteLength: plaintext.length,
      sha256: createHash('sha256').update(plaintext).digest('hex'),
    };
    if (contentType !== undefined) {
      payload.contentType = contentType;
    }
    const manifest = {
      formatVersion: 1,
      created: '2026-08-18T14:00:00.000Z',
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

  it('rejects a container whose payload content type is missing', async () => {
    const filePath = await writeContainer('missing-content-type.savestate', undefined);

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('corrupted');
    expect(result.message).toMatch(/content type/i);
    expect(result.manifest).toBeUndefined();
  });

  it('rejects a container whose payload content type is empty', async () => {
    const filePath = await writeContainer('empty-content-type.savestate', '   ');

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('corrupted');
    expect(result.message).toMatch(/content type/i);
    expect(result.manifest).toBeUndefined();
  });

  it('still verifies a valid container with a payload content type', async () => {
    const filePath = await writeContainer('valid-content-type.savestate', 'application/json');

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('valid');
    expect(result.manifest?.agentId).toBe('demo-agent');
  });

  it('does not treat a wrong passphrase as a content-type failure', async () => {
    const filePath = await writeContainer('wrong-pass.savestate', 'application/json');

    const result = await verifyContainer(filePath, { passphrase: 'wrong-pass' });

    expect(result.status).toBe('wrong_password');
    expect(result.message).not.toMatch(/content type/i);
  });
});
