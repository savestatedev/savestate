import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { formatVerifyResult, verifyContainer } from '../verify.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate verify directory input path', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-directory-input-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
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

  it('rejects a directory input path before reading', async () => {
    const dirPath = join(testDir, 'input-dir');
    await mkdir(dirPath);

    const result = await verifyContainer(dirPath, { passphrase: 'synthetic-verify-pass' });
    const output = formatVerifyResult(result, false);

    expect(result.status).toBe('invalid_format');
    expect(result.message).toMatch(/directory/i);
    expect(result.message).toContain(dirPath);
    expect(result.checksum).toBeUndefined();
    expect(result.input).toBeUndefined();
    expect(output).toMatch(/directory/i);
    expect(output).not.toContain('Checksum:');
    expect(output).not.toContain('Input:');
    expect(output).not.toContain('State file is valid');
    expect(output).not.toMatch(/Failed to read file/i);
  });

  it('still verifies a non-directory input path', async () => {
    const filePath = await writeContainer('valid-input.savestate', 'synthetic-verify-pass');

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('valid');
    expect(result.manifest?.agentId).toBe('fixture-agent');
    expect(result.input).toBe(filePath);
    expect(formatVerifyResult(result, false)).toContain('State file is valid');
  });

  it('still reports a missing non-directory path as not found', async () => {
    const missingPath = join(testDir, 'does-not-exist.savestate');

    const result = await verifyContainer(missingPath, { passphrase: 'synthetic-verify-pass' });
    const output = formatVerifyResult(result, false);

    expect(result.status).toBe('invalid_format');
    expect(result.message).toMatch(/not found/i);
    expect(output).toMatch(/not found/i);
    expect(result.message).not.toMatch(/is a directory/i);
    expect(output).not.toMatch(/is a directory/i);
  });
});
