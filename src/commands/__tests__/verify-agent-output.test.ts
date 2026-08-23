import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { formatVerifyAgent, formatVerifyResult, verifyContainer } from '../verify.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate verify agent output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-agent-output-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('formats the agent id on its own line', () => {
    expect(formatVerifyAgent('demo-agent')).toBe('   Agent: demo-agent');
    expect(formatVerifyAgent('demo-agent')).not.toContain('Created:');
  });

  it('returns and prints the agent id after a valid checksum comparison', async () => {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'], tools: [] }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest = {
      formatVersion: 1,
      created: '2026-08-23T11:00:00.000Z',
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
    expect(result.manifest?.agentId).toBe('demo-agent');
    expect(formatVerifyAgent(result.manifest!.agentId)).toBe('   Agent: demo-agent');
    expect(formatVerifyResult(result, false)).toContain('   Agent: demo-agent');
  });

  it('prints the agent id when the passphrase is wrong', async () => {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({ memory: ['demo'] }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest = {
      formatVersion: 1,
      created: '2026-08-23T11:00:00.000Z',
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
    expect(result.manifest?.agentId).toBe('demo-agent');
    expect(formatVerifyResult(result, false)).toContain('   Agent: demo-agent');
  });

  it('omits an agent line when the file is not a SaveState container', async () => {
    const filePath = join(testDir, 'not-a-container.bin');
    await writeFile(filePath, Buffer.from('not-a-savestate-file'));

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('invalid_format');
    expect(result.manifest).toBeUndefined();
    expect(formatVerifyResult(result, false)).not.toContain('Agent:');
  });
});
