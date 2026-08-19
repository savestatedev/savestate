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

describe('savestate verify payloads array', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-payloads-array-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(
    fileName: string,
    payloads: unknown,
  ): Promise<string> {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'] }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const actualHash = createHash('sha256').update(plaintext).digest('hex');
    const manifest = {
      formatVersion: 1,
      created: '2026-08-18T20:54:00.000Z',
      agentId: 'demo-agent',
      payloads,
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

  function validPayloads() {
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'] }));
    return [
      {
        name: 'agent_state',
        contentType: 'application/json',
        byteLength: plaintext.length,
        sha256: createHash('sha256').update(plaintext).digest('hex'),
      },
    ];
  }

  it('rejects a container whose payloads field is an object', async () => {
    const filePath = await writeContainer('object-payloads.savestate', {
      name: 'agent_state',
      contentType: 'application/json',
      byteLength: 16,
      sha256: 'abc',
    });

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('corrupted');
    expect(result.message).toMatch(/payloads/i);
    expect(result.manifest).toBeUndefined();
  });

  it('rejects a container whose payloads field is a string', async () => {
    const filePath = await writeContainer('string-payloads.savestate', 'agent_state');

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('corrupted');
    expect(result.message).toMatch(/payloads/i);
    expect(result.manifest).toBeUndefined();
  });

  it('still verifies a valid container with an array of payloads', async () => {
    const filePath = await writeContainer('valid-payloads.savestate', validPayloads());

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('valid');
    expect(result.manifest?.agentId).toBe('demo-agent');
  });

  it('does not treat a wrong passphrase as a payloads-array failure', async () => {
    const filePath = await writeContainer('wrong-pass.savestate', validPayloads());

    const result = await verifyContainer(filePath, { passphrase: 'wrong-pass' });

    expect(result.status).toBe('wrong_password');
    expect(result.message).not.toMatch(/payloads must be an array/i);
  });
});
