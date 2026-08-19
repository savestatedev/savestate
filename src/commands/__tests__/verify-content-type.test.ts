import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { formatVerifyContentType, verifyContainer } from '../verify.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate verify content type', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-ctype-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('returns the payload content type after a valid checksum comparison', async () => {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'], tools: [] }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest = {
      formatVersion: 1,
      created: '2026-08-18T08:00:00.000Z',
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
    const manifestBuffer = Buffer.from(JSON.stringify(manifest));
    const manifestLength = Buffer.alloc(4);
    manifestLength.writeUInt32LE(manifestBuffer.length, 0);
    const filePath = join(testDir, 'valid.savestate');
    await writeFile(
      filePath,
      Buffer.concat([createMagicHeader(), manifestLength, manifestBuffer, encryptedState]),
    );

    const result = await verifyContainer(filePath, { passphrase });

    expect(result.status).toBe('valid');
    expect(result.contentType).toBe('application/json');
    expect(formatVerifyContentType(result.contentType!)).toBe('   Content-Type: application/json');
  });

  it('omits a content type when the passphrase is wrong', async () => {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'] }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest = {
      formatVersion: 1,
      created: '2026-08-18T08:00:00.000Z',
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
    const manifestBuffer = Buffer.from(JSON.stringify(manifest));
    const manifestLength = Buffer.alloc(4);
    manifestLength.writeUInt32LE(manifestBuffer.length, 0);
    const filePath = join(testDir, 'wrong-pass.savestate');
    await writeFile(
      filePath,
      Buffer.concat([createMagicHeader(), manifestLength, manifestBuffer, encryptedState]),
    );

    const result = await verifyContainer(filePath, { passphrase: 'wrong-pass' });

    expect(result.status).toBe('wrong_password');
    expect(result.contentType).toBeUndefined();
  });

  it('prints a Content-Type line for a known type', () => {
    expect(formatVerifyContentType('application/json')).toBe('   Content-Type: application/json');
    expect(formatVerifyContentType('application/json')).not.toContain('Agent:');
  });
});
