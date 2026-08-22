import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { packedExcludedPath, verifyContainer } from '../verify.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate verify packed excluded membership', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-excluded-packed-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(fileName: string, excluded?: unknown): Promise<string> {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({
      agentId: 'demo-agent',
      version: 1,
      exportedAt: '2026-08-22T03:00:00.000Z',
      memory: { facts: ['synthetic'] },
    }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      created: '2026-08-22T03:00:00.000Z',
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
    if (excluded !== undefined) {
      manifest.excluded = excluded;
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

  it('reports an excluded path that is still present in packed state', () => {
    expect(packedExcludedPath(['memory', 'personality'], ['memory'])).toBe('memory');
    expect(packedExcludedPath(['personality'], ['memory'])).toBeUndefined();
  });

  it('rejects a container whose excluded list includes a packed path', async () => {
    const filePath = await writeContainer('excluded-packed.savestate', ['memory']);

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('corrupted');
    expect(result.message).toBe('Invalid manifest: excluded path is packed: memory');
    expect(result.manifest).toBeUndefined();
  });

  it('accepts a matching excluded list and still verifies older files without them', async () => {
    const matching = await writeContainer('matching-excluded.savestate', ['personality']);
    const legacy = await writeContainer('no-excluded.savestate');

    const valid = await verifyContainer(matching, { passphrase: 'synthetic-verify-pass' });
    const older = await verifyContainer(legacy, { passphrase: 'synthetic-verify-pass' });

    expect(valid.status).toBe('valid');
    expect(valid.components).toEqual(['memory']);
    expect(older.status).toBe('valid');
    expect(older.components).toEqual(['memory']);
  });
});
