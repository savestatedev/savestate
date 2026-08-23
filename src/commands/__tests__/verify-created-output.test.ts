import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { formatVerifyCreated, formatVerifyResult, verifyContainer } from '../verify.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate verify created output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-created-output-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('formats the created timestamp on its own line', () => {
    expect(formatVerifyCreated('2026-08-23T11:00:00.000Z')).toBe('   Created: 2026-08-23T11:00:00.000Z');
    expect(formatVerifyCreated('2026-08-23T11:00:00.000Z')).not.toContain('Agent:');
  });

  it('returns and prints the created timestamp after a valid checksum comparison', async () => {
    const passphrase = 'synthetic-verify-pass';
    const created = '2026-08-23T11:00:00.000Z';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'], tools: [] }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest = {
      formatVersion: 1,
      created,
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
    expect(result.manifest?.created).toBe(created);
    expect(formatVerifyCreated(result.manifest!.created)).toBe(`   Created: ${created}`);
    expect(formatVerifyResult(result, false)).toContain(`   Created: ${created}`);
  });

  it('prints the created timestamp when the passphrase is wrong', async () => {
    const passphrase = 'synthetic-verify-pass';
    const created = '2026-08-23T11:00:00.000Z';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'] }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest = {
      formatVersion: 1,
      created,
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
    expect(result.manifest?.created).toBe(created);
    expect(formatVerifyResult(result, false)).toContain(`   Created: ${created}`);
  });

  it('prints the created timestamp when the file is corrupted', async () => {
    const passphrase = 'synthetic-verify-pass';
    const created = '2026-08-23T11:00:00.000Z';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'] }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest = {
      formatVersion: 1,
      created,
      agentId: 'demo-agent',
      payloads: [
        {
          name: 'agent_state',
          contentType: 'application/json',
          byteLength: plaintext.length,
          sha256: 'a'.repeat(64),
        },
      ],
    };
    const manifestBuffer = Buffer.from(JSON.stringify(manifest));
    const manifestLength = Buffer.alloc(4);
    manifestLength.writeUInt32LE(manifestBuffer.length, 0);
    const filePath = join(testDir, 'checksum-mismatch.savestate');
    await writeFile(
      filePath,
      Buffer.concat([createMagicHeader(), manifestLength, manifestBuffer, encryptedState]),
    );

    const result = await verifyContainer(filePath, { passphrase });

    expect(result.status).toBe('corrupted');
    expect(result.manifest?.created).toBe(created);
    expect(formatVerifyResult(result, false)).toContain(`   Created: ${created}`);
  });

  it('omits a created line when the file is not a SaveState container', async () => {
    const filePath = join(testDir, 'not-a-container.bin');
    await writeFile(filePath, Buffer.from('not-a-savestate-file'));

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('invalid_format');
    expect(result.manifest).toBeUndefined();
    expect(formatVerifyResult(result, false)).not.toContain('Created:');
  });
});
