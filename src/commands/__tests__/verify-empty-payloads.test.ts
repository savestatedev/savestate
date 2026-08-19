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

describe('savestate verify empty payloads', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-empty-payloads-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(
    name: string,
    payloads: Array<Record<string, unknown>>,
  ): Promise<string> {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'] }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest = {
      formatVersion: 1,
      created: '2026-08-18T12:00:00.000Z',
      agentId: 'demo-agent',
      payloads,
    };
    const manifestBuffer = Buffer.from(JSON.stringify(manifest));
    const manifestLength = Buffer.alloc(4);
    manifestLength.writeUInt32LE(manifestBuffer.length, 0);
    const filePath = join(testDir, name);
    await writeFile(
      filePath,
      Buffer.concat([createMagicHeader(1), manifestLength, manifestBuffer, encryptedState]),
    );
    return filePath;
  }

  it('rejects a container whose payloads array is empty', async () => {
    const filePath = await writeContainer('empty-payloads.savestate', []);

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('corrupted');
    expect(result.message).toMatch(/payloads/i);
    expect(result.message).not.toMatch(/agent_state/i);
    expect(result.manifest).toBeUndefined();
  });

  it('still verifies a valid container with one payload', async () => {
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'] }));
    const filePath = await writeContainer('valid-payloads.savestate', [
      {
        name: 'agent_state',
        contentType: 'application/json',
        byteLength: plaintext.length,
        sha256: createHash('sha256').update(plaintext).digest('hex'),
      },
    ]);

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('valid');
    expect(result.manifest?.agentId).toBe('demo-agent');
  });

  it('does not treat a wrong passphrase as an empty-payloads failure', async () => {
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'] }));
    const filePath = await writeContainer('wrong-pass.savestate', [
      {
        name: 'agent_state',
        contentType: 'application/json',
        byteLength: plaintext.length,
        sha256: createHash('sha256').update(plaintext).digest('hex'),
      },
    ]);

    const result = await verifyContainer(filePath, { passphrase: 'wrong-pass' });

    expect(result.status).toBe('wrong_password');
    expect(result.message).not.toMatch(/payloads must contain/i);
  });
});
