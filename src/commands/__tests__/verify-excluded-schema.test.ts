import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { validateExcludedComponents } from '../container.js';
import { verifyContainer } from '../verify.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate verify excluded schema', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-excluded-schema-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(fileName: string, excluded?: unknown): Promise<string> {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'], tools: { enabled: [] } }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      created: '2026-08-22T02:54:00.000Z',
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

  it('rejects unknown, empty, and duplicate excluded lists', () => {
    expect(validateExcludedComponents('personality')).toEqual({
      error: 'Error: excluded must be an array of known state paths.',
    });
    expect(validateExcludedComponents([])).toEqual({
      error: 'Error: excluded must include at least one path.',
    });
    expect(validateExcludedComponents(['personality', 'secrets'])).toEqual({
      error: 'Error: Unknown excluded path: secrets. Allowed: personality, memory, tools, preferences, conversation_history.',
    });
    expect(validateExcludedComponents(['personality', 'personality'])).toEqual({
      error: 'Error: Duplicate excluded path: personality.',
    });
  });

  it('rejects a container whose excluded list includes an unknown path', async () => {
    const filePath = await writeContainer('unknown-excluded.savestate', ['personality', 'secrets']);

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('corrupted');
    expect(result.message).toMatch(/unknown excluded path/i);
    expect(result.manifest).toBeUndefined();
  });

  it('accepts a container with known excluded paths and still verifies older files without them', async () => {
    expect(validateExcludedComponents(['personality'])).toEqual({
      excluded: ['personality'],
    });

    const withExcluded = await writeContainer('known-excluded.savestate', ['personality']);
    const withoutExcluded = await writeContainer('no-excluded.savestate');

    const valid = await verifyContainer(withExcluded, { passphrase: 'synthetic-verify-pass' });
    const legacy = await verifyContainer(withoutExcluded, { passphrase: 'synthetic-verify-pass' });

    expect(valid.status).toBe('valid');
    expect(legacy.status).toBe('valid');
  });
});
