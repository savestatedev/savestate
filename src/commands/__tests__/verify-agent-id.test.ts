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

describe('savestate verify agentId', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-agent-id-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(
    fileName: string,
    agentId: unknown,
  ): Promise<string> {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'] }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const actualHash = createHash('sha256').update(plaintext).digest('hex');
    const manifest = {
      formatVersion: 1,
      created: '2026-08-18T22:01:00.000Z',
      agentId,
      payloads: [
        {
          name: 'agent_state',
          contentType: 'application/json',
          byteLength: plaintext.length,
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

  it('rejects a container whose agentId is a number', async () => {
    const filePath = await writeContainer('agent-id-number.savestate', 123);

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('corrupted');
    expect(result.message).toMatch(/agentId/i);
    expect(result.manifest).toBeUndefined();
  });

  it('rejects a container whose agentId is an object', async () => {
    const filePath = await writeContainer('agent-id-object.savestate', { id: 'demo-agent' });

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('corrupted');
    expect(result.message).toMatch(/agentId/i);
    expect(result.manifest).toBeUndefined();
  });

  it('still verifies a valid container with a string agentId', async () => {
    const filePath = await writeContainer('valid-agent-id.savestate', 'demo-agent');

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('valid');
    expect(result.manifest?.agentId).toBe('demo-agent');
  });

  it('does not treat a wrong passphrase as an agentId failure', async () => {
    const filePath = await writeContainer('wrong-pass.savestate', 'demo-agent');

    const result = await verifyContainer(filePath, { passphrase: 'wrong-pass' });

    expect(result.status).toBe('wrong_password');
    expect(result.message).not.toMatch(/agentId/i);
  });
});
