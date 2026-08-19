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

describe('savestate verify missing formatVersion', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-missing-format-version-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(
    fileName: string,
    includeFormatVersion = true,
  ): Promise<string> {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'] }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const actualHash = createHash('sha256').update(plaintext).digest('hex');
    const manifest: Record<string, unknown> = {
      created: '2026-08-19T09:14:00.000Z',
      agentId: 'demo-agent',
      payloads: [
        {
          name: 'agent_state',
          contentType: 'application/json',
          byteLength: plaintext.length,
          sha256: actualHash,
        },
      ],
    };
    if (includeFormatVersion) {
      manifest.formatVersion = 1;
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

  it('rejects a container whose formatVersion is missing', async () => {
    const filePath = await writeContainer('missing-format-version.savestate', false);

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('corrupted');
    expect(result.message).toMatch(/formatVersion/i);
    expect(result.manifest).toBeUndefined();
  });

  it('still verifies a valid container with formatVersion 1', async () => {
    const filePath = await writeContainer('valid-format-version.savestate', true);

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('valid');
    expect(result.manifest?.agentId).toBe('demo-agent');
    expect(result.manifest?.formatVersion).toBe(1);
  });

  it('still names formatVersion when the rest of the structure is present', async () => {
    const filePath = await writeContainer('named-missing-format-version.savestate', false);

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('corrupted');
    expect(result.message).not.toBe('Invalid manifest structure');
    expect(result.message).toMatch(/formatVersion/i);
  });

  it('does not treat a wrong passphrase as a formatVersion failure', async () => {
    const filePath = await writeContainer('wrong-pass.savestate', true);

    const result = await verifyContainer(filePath, { passphrase: 'wrong-pass' });

    expect(result.status).toBe('wrong_password');
    expect(result.message).not.toMatch(/formatVersion/i);
  });
});
