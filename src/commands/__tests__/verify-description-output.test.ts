import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { formatVerifyDescription, formatVerifyResult, verifyContainer } from '../verify.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate verify description output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-description-output-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(fileName: string, description?: string): Promise<string> {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'], tools: [] }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      created: '2026-08-23T14:00:00.000Z',
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
    if (description !== undefined) {
      manifest.description = description;
    }
    const manifestBuffer = Buffer.from(JSON.stringify(manifest));
    const manifestLength = Buffer.alloc(4);
    manifestLength.writeUInt32LE(manifestBuffer.length, 0);
    const filePath = join(testDir, fileName);
    await writeFile(
      filePath,
      Buffer.concat([createMagicHeader(), manifestLength, manifestBuffer, encryptedState]),
    );
    return filePath;
  }

  it('formats the description on its own line', () => {
    expect(formatVerifyDescription('Labeled verify fixture')).toBe('   Description: Labeled verify fixture');
    expect(formatVerifyDescription('Labeled verify fixture')).not.toContain('Agent:');
  });

  it('returns and prints the description after a valid checksum comparison', async () => {
    const filePath = await writeContainer('valid.savestate', 'Labeled verify fixture');
    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('valid');
    expect(result.manifest?.description).toBe('Labeled verify fixture');
    expect(formatVerifyDescription(result.manifest!.description!)).toBe('   Description: Labeled verify fixture');
    expect(formatVerifyResult(result, false)).toContain('   Description: Labeled verify fixture');
  });

  it('omits a description line when the manifest has none or the file is invalid', async () => {
    const unlabeledPath = await writeContainer('unlabeled.savestate');
    const unlabeled = await verifyContainer(unlabeledPath, { passphrase: 'synthetic-verify-pass' });
    const invalidPath = join(testDir, 'not-a-container.bin');
    await writeFile(invalidPath, Buffer.from('not-a-savestate-file'));
    const invalid = await verifyContainer(invalidPath, { passphrase: 'synthetic-verify-pass' });

    expect(unlabeled.status).toBe('valid');
    expect(unlabeled.manifest?.description).toBeUndefined();
    expect(formatVerifyResult(unlabeled, false)).not.toContain('Description:');
    expect(invalid.status).toBe('invalid_format');
    expect(invalid.manifest).toBeUndefined();
    expect(formatVerifyResult(invalid, false)).not.toContain('Description:');
  });
});
