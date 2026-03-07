/**
 * Tests for savestate verify command
 * Issue #155: State file integrity verification
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash, randomBytes } from 'crypto';
import { encrypt } from '../../container/crypto.js';
import { verifyContainer, VerifyResult } from '../verify.js';

/**
 * Create a proper 16-byte magic header per spec
 */
function createMagicHeader(version: number = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');  // 8 bytes
  header.writeUInt8(version, 8);         // version at byte 8
  return header;
}

describe('verifyContainer', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-verify-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a valid .savestate file
   */
  async function createValidContainer(
    filePath: string,
    passphrase: string,
    agentState: object = { test: 'data' }
  ): Promise<void> {
    const plaintext = Buffer.from(JSON.stringify(agentState));
    const encryptedState = await encrypt(plaintext, { passphrase });
    
    const manifest = {
      formatVersion: 1,
      created: new Date().toISOString(),
      agentId: 'test-agent',
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
    const magicHeader = createMagicHeader(1);
    const manifestLength = Buffer.alloc(4);
    manifestLength.writeUInt32LE(manifestBuffer.length, 0);

    const finalBuffer = Buffer.concat([
      magicHeader,
      manifestLength,
      manifestBuffer,
      encryptedState,
    ]);

    await fs.writeFile(filePath, finalBuffer);
  }

  it('should verify a valid container', async () => {
    const filePath = join(testDir, 'valid.savestate');
    const passphrase = 'test-passphrase-123';

    await createValidContainer(filePath, passphrase, {
      identity: { name: 'TestAgent' },
      memories: [],
    });

    const result = await verifyContainer(filePath, { passphrase });

    expect(result.status).toBe('valid');
    expect(result.manifest).toBeDefined();
    expect(result.manifest?.agentId).toBe('test-agent');
  });

  it('should detect wrong password', async () => {
    const filePath = join(testDir, 'wrong-pass.savestate');
    const passphrase = 'correct-password';

    await createValidContainer(filePath, passphrase);

    const result = await verifyContainer(filePath, { passphrase: 'wrong-password' });

    expect(result.status).toBe('wrong_password');
    expect(result.manifest).toBeDefined();
    expect(result.manifest?.agentId).toBe('test-agent');
  });

  it('should detect missing file', async () => {
    const result = await verifyContainer(
      join(testDir, 'nonexistent.savestate'),
      { passphrase: 'any' }
    );

    expect(result.status).toBe('invalid_format');
    expect(result.message).toContain('File not found');
  });

  it('should detect invalid magic header', async () => {
    const filePath = join(testDir, 'bad-magic.savestate');
    
    // Write garbage data
    await fs.writeFile(filePath, Buffer.from('NOT A SAVESTATE FILE AT ALL'));

    const result = await verifyContainer(filePath, { passphrase: 'any' });

    expect(result.status).toBe('invalid_format');
    expect(result.message).toContain('magic header');
  });

  it('should detect corrupted manifest', async () => {
    const filePath = join(testDir, 'bad-manifest.savestate');
    
    // Create file with valid header but corrupted manifest
    const magicHeader = createMagicHeader(1);
    const manifestLength = Buffer.alloc(4);
    manifestLength.writeUInt32LE(100, 0); // claim 100 bytes
    const corruptedManifest = Buffer.from('not valid json{{{{');
    const padding = Buffer.alloc(82); // pad to claimed length

    await fs.writeFile(filePath, Buffer.concat([
      magicHeader,
      manifestLength,
      corruptedManifest,
      padding,
    ]));

    const result = await verifyContainer(filePath, { passphrase: 'any' });

    expect(result.status).toBe('corrupted');
    expect(result.message).toContain('manifest');
  });

  it('should detect checksum mismatch (tampered file)', async () => {
    const filePath = join(testDir, 'tampered.savestate');
    const passphrase = 'test-pass';

    // First create a valid container
    await createValidContainer(filePath, passphrase, { original: 'data' });

    // Read it and tamper with the encrypted payload
    const fileBuffer = await fs.readFile(filePath);
    const manifestLength = fileBuffer.readUInt32LE(16);
    const manifestEnd = 20 + manifestLength;
    
    // Flip some bits in the encrypted section (beyond auth tag area for GCM)
    // This should cause either decryption failure or checksum mismatch
    const tamperedBuffer = Buffer.from(fileBuffer);
    if (tamperedBuffer.length > manifestEnd + 50) {
      tamperedBuffer[manifestEnd + 50] ^= 0xFF;
    }

    await fs.writeFile(filePath, tamperedBuffer);

    const result = await verifyContainer(filePath, { passphrase });

    // GCM auth tag will catch most tampering as wrong_password (decryption fails)
    // or corrupted if we somehow get past decryption
    expect(['wrong_password', 'corrupted']).toContain(result.status);
  });

  it('should handle truncated file', async () => {
    const filePath = join(testDir, 'truncated.savestate');
    
    // Write just part of the magic header (too short)
    await fs.writeFile(filePath, Buffer.from('SAVESTAT'));

    const result = await verifyContainer(filePath, { passphrase: 'any' });

    expect(result.status).toBe('invalid_format');
    expect(result.message).toContain('too small');
  });

  it('should handle unsupported version', async () => {
    const filePath = join(testDir, 'future-version.savestate');
    
    // Create header with version 99
    const header = createMagicHeader(99);
    const manifestLength = Buffer.alloc(4);
    manifestLength.writeUInt32LE(2, 0);
    
    await fs.writeFile(filePath, Buffer.concat([header, manifestLength, Buffer.from('{}')]));

    const result = await verifyContainer(filePath, { passphrase: 'any' });

    expect(result.status).toBe('invalid_format');
    expect(result.message).toContain('version');
  });

  it('should verify with keyfile', async () => {
    const filePath = join(testDir, 'keyfile-test.savestate');
    const keyfilePath = join(testDir, 'test.key');
    
    // Create a random keyfile
    const keyfileContent = randomBytes(32);
    await fs.writeFile(keyfilePath, keyfileContent);

    // Create container encrypted with keyfile
    const plaintext = Buffer.from(JSON.stringify({ keyfile: 'test' }));
    const encryptedState = await encrypt(plaintext, { keyfile: keyfilePath });
    
    const manifest = {
      formatVersion: 1,
      created: new Date().toISOString(),
      agentId: 'keyfile-agent',
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
    const magicHeader = createMagicHeader(1);
    const manifestLengthBuf = Buffer.alloc(4);
    manifestLengthBuf.writeUInt32LE(manifestBuffer.length, 0);

    await fs.writeFile(
      filePath,
      Buffer.concat([magicHeader, manifestLengthBuf, manifestBuffer, encryptedState])
    );

    const result = await verifyContainer(filePath, { keyfile: keyfilePath });

    expect(result.status).toBe('valid');
    expect(result.manifest?.agentId).toBe('keyfile-agent');
  });
});
