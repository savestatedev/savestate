import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { formatVerifyResult, verifyContainer } from '../verify.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate verify empty passphrase', () => {
  let testDir: string;
  const originalEnv = process.env.SAVESTATE_PASSPHRASE;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-empty-passphrase-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SAVESTATE_PASSPHRASE;
    } else {
      process.env.SAVESTATE_PASSPHRASE = originalEnv;
    }
  });

  async function writeContainer(fileName: string, passphrase: string): Promise<string> {
    const plaintext = Buffer.from(JSON.stringify({
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-08-26T00:00:00.000Z',
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
    }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest = {
      formatVersion: 1,
      created: '2026-08-26T00:00:00.000Z',
      agentId: 'fixture-agent',
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
    const filePath = join(testDir, fileName);
    await writeFile(
      filePath,
      Buffer.concat([createMagicHeader(1), manifestLength, manifestBuffer, encryptedState]),
    );
    return filePath;
  }

  it('rejects an empty passphrase before decrypting', async () => {
    process.env.SAVESTATE_PASSPHRASE = 'synthetic-env-pass';
    const filePath = await writeContainer('empty-passphrase.savestate', 'synthetic-verify-pass');

    const result = await verifyContainer(filePath, { passphrase: '' });
    const output = formatVerifyResult(result, false);

    expect(result.status).toBe('invalid_format');
    expect(result.message).toMatch(/passphrase/i);
    expect(result.message).toMatch(/empty/i);
    expect(result.checksum).toBeUndefined();
    expect(output).toMatch(/passphrase/i);
    expect(output).toMatch(/empty/i);
    expect(output).not.toContain('Checksum:');
    expect(output).not.toContain('State file is valid');
    expect(output).not.toContain('incorrect passphrase');
  });

  it('rejects a whitespace-only passphrase before decrypting', async () => {
    const filePath = await writeContainer('whitespace-passphrase.savestate', 'synthetic-verify-pass');

    const result = await verifyContainer(filePath, { passphrase: '   ' });
    const output = formatVerifyResult(result, false);

    expect(result.status).toBe('invalid_format');
    expect(result.message).toMatch(/passphrase/i);
    expect(result.message).toMatch(/empty/i);
    expect(result.checksum).toBeUndefined();
    expect(output).toMatch(/passphrase/i);
    expect(output).toMatch(/empty/i);
    expect(output).not.toContain('Checksum:');
    expect(output).not.toContain('State file is valid');
    expect(output).not.toContain('incorrect passphrase');
  });

  it('still verifies a non-empty passphrase', async () => {
    const filePath = await writeContainer('valid-passphrase.savestate', 'synthetic-verify-pass');

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('valid');
    expect(result.manifest?.agentId).toBe('fixture-agent');
    expect(formatVerifyResult(result, false)).toContain('State file is valid');
  });

  it('still attempts decrypt when the passphrase is non-empty but wrong', async () => {
    const filePath = await writeContainer('wrong-passphrase.savestate', 'synthetic-verify-pass');

    const result = await verifyContainer(filePath, { passphrase: 'wrong-passphrase' });
    const output = formatVerifyResult(result, false);

    expect(result.status).toBe('wrong_password');
    expect(result.message).toMatch(/incorrect passphrase/i);
    expect(output).toContain('Wrong password');
    expect(output).not.toMatch(/must not be empty/i);
  });
});
