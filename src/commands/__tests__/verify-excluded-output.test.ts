import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { formatVerifyExcluded, formatVerifyResult, verifyContainer } from '../verify.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate verify excluded output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-excluded-output-'));
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
      created: '2026-08-22T05:00:00.000Z',
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

  it('formats excluded paths on their own line', () => {
    expect(formatVerifyExcluded(['personality'])).toBe('   Excluded: personality');
    expect(formatVerifyExcluded(['personality', 'tools'])).toBe('   Excluded: personality, tools');
    expect(formatVerifyExcluded(['personality'])).not.toContain('Agent:');
  });

  it('returns and prints excluded paths when the manifest lists them', async () => {
    const filePath = await writeContainer('with-excluded.savestate', ['personality']);

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('valid');
    expect(result.excluded).toEqual(['personality']);
    expect(formatVerifyResult(result, false)).toContain('Excluded: personality');
    expect(JSON.parse(formatVerifyResult(result, true)).excluded).toEqual(['personality']);
  });

  it('omits excluded from valid output when the archive has none', async () => {
    const filePath = await writeContainer('no-excluded.savestate');

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('valid');
    expect(result.excluded).toBeUndefined();
    expect(formatVerifyResult(result, false)).not.toContain('Excluded:');
    expect(JSON.parse(formatVerifyResult(result, true)).excluded).toBeUndefined();
  });

  it('prints excluded paths when the passphrase is wrong', async () => {
    const filePath = await writeContainer('wrong-pass-excluded.savestate', ['personality']);
    const result = await verifyContainer(filePath, { passphrase: 'wrong-pass' });

    expect(result.status).toBe('wrong_password');
    expect(result.excluded).toEqual(['personality']);
    expect(formatVerifyResult(result, false)).toContain('   Excluded: personality');
  });

  it('omits excluded when the passphrase is wrong and the archive has none', async () => {
    const filePath = await writeContainer('wrong-pass-no-excluded.savestate');
    const result = await verifyContainer(filePath, { passphrase: 'wrong-pass' });

    expect(result.status).toBe('wrong_password');
    expect(result.excluded).toBeUndefined();
    expect(formatVerifyResult(result, false)).not.toContain('Excluded:');
  });

  it('prints excluded paths when the file is corrupted', async () => {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'], tools: { enabled: [] } }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest = {
      formatVersion: 1,
      created: '2026-08-24T08:00:00.000Z',
      agentId: 'demo-agent',
      excluded: ['personality'],
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
    const filePath = join(testDir, 'corrupted-excluded.savestate');
    await writeFile(
      filePath,
      Buffer.concat([createMagicHeader(1), manifestLength, manifestBuffer, encryptedState]),
    );

    const result = await verifyContainer(filePath, { passphrase });

    expect(result.status).toBe('corrupted');
    expect(result.excluded).toEqual(['personality']);
    expect(formatVerifyResult(result, false)).toContain('   Excluded: personality');
  });

  it('omits excluded when the file is corrupted and the archive has none', async () => {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'], tools: { enabled: [] } }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest = {
      formatVersion: 1,
      created: '2026-08-24T08:00:00.000Z',
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
    const filePath = join(testDir, 'corrupted-no-excluded.savestate');
    await writeFile(
      filePath,
      Buffer.concat([createMagicHeader(1), manifestLength, manifestBuffer, encryptedState]),
    );

    const result = await verifyContainer(filePath, { passphrase });

    expect(result.status).toBe('corrupted');
    expect(result.excluded).toBeUndefined();
    expect(formatVerifyResult(result, false)).not.toContain('Excluded:');
  });

  it('omits an excluded line when the file is not a SaveState container', async () => {
    const filePath = join(testDir, 'not-a-container.bin');
    await writeFile(filePath, Buffer.from('not-a-savestate-file'));

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('invalid_format');
    expect(result.excluded).toBeUndefined();
    expect(formatVerifyResult(result, false)).not.toContain('Excluded:');
  });
});
