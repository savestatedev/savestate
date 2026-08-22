import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { unlistedPackedComponent, verifyContainer } from '../verify.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate verify unlisted packed path', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-unlisted-packed-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(
    fileName: string,
    state: Record<string, unknown>,
    components?: unknown,
  ): Promise<string> {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify(state));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      created: '2026-08-22T03:10:00.000Z',
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
    if (components !== undefined) {
      manifest.components = components;
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

  it('reports a packed path that is absent from the components list', () => {
    expect(unlistedPackedComponent(['memory'], ['memory', 'tools'])).toBe('tools');
    expect(unlistedPackedComponent(['memory'], ['memory'])).toBeUndefined();
  });

  it('rejects a container whose packed state includes an unlisted path', async () => {
    const filePath = await writeContainer(
      'unlisted-packed.savestate',
      {
        agentId: 'demo-agent',
        version: 1,
        exportedAt: '2026-08-22T03:10:00.000Z',
        memory: { facts: ['synthetic'] },
        tools: { enabled: [] },
      },
      ['memory'],
    );

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('corrupted');
    expect(result.message).toBe('Invalid manifest: packed path not listed: tools');
    expect(result.manifest).toBeUndefined();
  });

  it('accepts a matching components list and still verifies older files without them', async () => {
    const matching = await writeContainer(
      'matching-components.savestate',
      {
        agentId: 'demo-agent',
        version: 1,
        exportedAt: '2026-08-22T03:10:00.000Z',
        memory: { facts: ['synthetic'] },
      },
      ['memory'],
    );
    const legacy = await writeContainer(
      'no-components.savestate',
      {
        agentId: 'demo-agent',
        version: 1,
        exportedAt: '2026-08-22T03:10:00.000Z',
        memory: { facts: ['synthetic'] },
      },
    );

    const valid = await verifyContainer(matching, { passphrase: 'synthetic-verify-pass' });
    const older = await verifyContainer(legacy, { passphrase: 'synthetic-verify-pass' });

    expect(valid.status).toBe('valid');
    expect(valid.components).toEqual(['memory']);
    expect(older.status).toBe('valid');
    expect(older.components).toEqual(['memory']);
  });
});
