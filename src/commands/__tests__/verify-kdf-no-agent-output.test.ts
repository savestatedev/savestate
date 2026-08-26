import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { formatVerifyKeyDerivation, formatVerifyResult, verifyContainer } from '../verify.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate verify kdf no-agent output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-kdf-no-agent-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(fileName: string): Promise<string> {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-08-26T00:00:00.000Z',
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
    }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      created: '2026-08-26T00:00:00.000Z',
      agentId: 'fixture-agent',
      encryption: {
        algorithm: 'AES-256-GCM',
        keyDerivation: 'Argon2id',
      },
      payloads: [
        {
          name: 'other_payload',
          contentType: 'application/json',
          byteLength: plaintext.length,
          sha256: 'a'.repeat(64),
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

  it('formats the key derivation on its own line', () => {
    expect(formatVerifyKeyDerivation('Argon2id')).toBe('   Key derivation: Argon2id');
    expect(formatVerifyKeyDerivation('Argon2id')).not.toContain('Agent:');
  });

  it('prints the key derivation when the container has no agent state', async () => {
    const filePath = await writeContainer('no-agent-kdf.savestate');
    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('corrupted');
    expect(result.message).toContain('missing agent_state');
    expect(result.keyDerivation).toBe('Argon2id');
    expect(formatVerifyResult(result, false)).toContain('   Key derivation: Argon2id');
  });

  it('omits a key derivation line when the file is not a SaveState container', async () => {
    const filePath = join(testDir, 'not-a-container.bin');
    await writeFile(filePath, Buffer.from('not-a-savestate-file'));

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('invalid_format');
    expect(result.keyDerivation).toBeUndefined();
    expect(formatVerifyResult(result, false)).not.toContain('Key derivation:');
  });
});
