import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
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

describe('savestate verify directory keyfile', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-directory-keyfile-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(
    fileName: string,
    keySource: { passphrase?: string; keyfile?: string },
  ): Promise<string> {
    const plaintext = Buffer.from(JSON.stringify({
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-08-26T00:00:00.000Z',
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
    }));
    const encryptedState = await encrypt(plaintext, keySource);
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

  it('rejects a directory keyfile before decrypting', async () => {
    const filePath = await writeContainer('directory-keyfile.savestate', {
      passphrase: 'synthetic-verify-pass',
    });
    const keyfileDir = join(testDir, 'keyfile-dir');
    await mkdir(keyfileDir);

    const result = await verifyContainer(filePath, { keyfile: keyfileDir });
    const output = formatVerifyResult(result, false);

    expect(result.status).toBe('invalid_format');
    expect(result.message).toMatch(/keyfile/i);
    expect(result.message).toMatch(/directory/i);
    expect(result.checksum).toBeUndefined();
    expect(output).toMatch(/keyfile/i);
    expect(output).toMatch(/directory/i);
    expect(output).not.toContain('Checksum:');
    expect(output).not.toContain('State file is valid');
  });

  it('still verifies a keyfile path that is a regular file', async () => {
    const keyfilePath = join(testDir, 'synthetic.key');
    await writeFile(keyfilePath, randomBytes(32));
    const filePath = await writeContainer('valid-keyfile.savestate', { keyfile: keyfilePath });

    const result = await verifyContainer(filePath, { keyfile: keyfilePath });

    expect(result.status).toBe('valid');
    expect(result.manifest?.agentId).toBe('fixture-agent');
    expect(formatVerifyResult(result, false)).toContain('State file is valid');
  });

  it('keeps the current passphrase path when keyfile is omitted', async () => {
    const filePath = await writeContainer('omitted-keyfile.savestate', {
      passphrase: 'synthetic-verify-pass',
    });

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('valid');
    expect(result.manifest?.agentId).toBe('fixture-agent');
  });
});
