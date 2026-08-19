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

describe('savestate verify duplicate payload names', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-duplicate-payload-names-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(
    fileName: string,
    extraPayloads: Array<Record<string, unknown>> = [],
  ): Promise<string> {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'] }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const actualHash = createHash('sha256').update(plaintext).digest('hex');
    const agentState = {
      name: 'agent_state',
      contentType: 'application/json',
      byteLength: plaintext.length,
      sha256: actualHash,
    };
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      created: '2026-08-19T17:23:00.000Z',
      agentId: 'demo-agent',
      payloads: [agentState, ...extraPayloads],
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

  it('rejects a container whose payload names are duplicated', async () => {
    const filePath = await writeContainer('duplicate-names.savestate', [
      {
        name: 'agent_state',
        contentType: 'application/json',
        byteLength: 4,
        sha256: 'a'.repeat(64),
      },
    ]);

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('corrupted');
    expect(result.message).toMatch(/payload names must be unique/i);
    expect(result.manifest).toBeUndefined();
  });

  it('still verifies a valid container with one payload name', async () => {
    const filePath = await writeContainer('single-name.savestate');

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('valid');
    expect(result.manifest?.agentId).toBe('demo-agent');
  });

  it('still verifies a valid container with two different payload names', async () => {
    const filePath = await writeContainer('distinct-names.savestate', [
      {
        name: 'personality',
        contentType: 'application/json',
        byteLength: 4,
        sha256: 'b'.repeat(64),
      },
    ]);

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('valid');
    expect(result.manifest?.agentId).toBe('demo-agent');
  });

  it('does not treat a wrong passphrase as a duplicate-name failure', async () => {
    const filePath = await writeContainer('wrong-pass.savestate', [
      {
        name: 'personality',
        contentType: 'application/json',
        byteLength: 4,
        sha256: 'b'.repeat(64),
      },
    ]);

    const result = await verifyContainer(filePath, { passphrase: 'wrong-pass' });

    expect(result.status).toBe('wrong_password');
    expect(result.message).not.toMatch(/payload names must be unique/i);
  });
});
