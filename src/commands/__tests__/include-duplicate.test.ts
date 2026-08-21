import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { importState, parseIncludePaths } from '../container.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate --include duplicate paths', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-include-duplicate-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function createValidContainer(filePath: string, passphrase: string): Promise<void> {
    const agentState = {
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-08-21T18:00:00.000Z',
      personality: { name: 'fixture-agent' },
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
    };
    const plaintext = Buffer.from(JSON.stringify(agentState));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest = {
      formatVersion: 1,
      created: '2026-08-21T18:00:00.000Z',
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
    await fs.writeFile(
      filePath,
      Buffer.concat([createMagicHeader(1), manifestLength, manifestBuffer, encryptedState]),
    );
  }

  it('rejects a repeated include path', () => {
    expect(parseIncludePaths('memory,memory')).toEqual({
      error: 'Error: Duplicate include path: memory.',
    });
    expect(parseIncludePaths('memory, tools, memory')).toEqual({
      error: 'Error: Duplicate include path: memory.',
    });
  });

  it('still accepts unique include paths', () => {
    expect(parseIncludePaths('memory,tools')).toEqual({
      components: {
        personality: false,
        memory: true,
        tools: true,
        preferences: false,
        conversation_history: false,
      },
    });
  });

  it('rejects a duplicate include path before restoring', async () => {
    const filePath = join(testDir, 'duplicate-include.savestate');
    await createValidContainer(filePath, 'synthetic-passphrase');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      include: 'memory,memory',
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat().join('\n')).toMatch(/duplicate include path/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Decrypting agent state');
    error.mockRestore();
    log.mockRestore();
  });
});
