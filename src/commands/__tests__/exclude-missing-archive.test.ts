import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { applyImportExclude, importState } from '../container.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate --exclude of a path not packed in the archive', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-exclude-missing-archive-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function createContainer(
    filePath: string,
    passphrase: string,
    components?: string[],
  ): Promise<void> {
    const agentState: Record<string, unknown> = {
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-08-21T23:00:00.000Z',
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
    };
    const plaintext = Buffer.from(JSON.stringify(agentState));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      created: '2026-08-21T23:00:00.000Z',
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
    if (components !== undefined) {
      manifest.components = components;
    }
    const manifestBuffer = Buffer.from(JSON.stringify(manifest));
    const manifestLength = Buffer.alloc(4);
    manifestLength.writeUInt32LE(manifestBuffer.length, 0);
    await fs.writeFile(
      filePath,
      Buffer.concat([createMagicHeader(1), manifestLength, manifestBuffer, encryptedState]),
    );
  }

  it('rejects an exclude path that is not in the packed state', () => {
    expect(applyImportExclude({ memory: { facts: ['synthetic'] }, tools: { enabled: [] } }, 'personality')).toEqual({
      error: 'Error: Exclude path not in archive: personality.',
    });
    expect(applyImportExclude({ memory: { facts: ['synthetic'] }, tools: { enabled: [] } }, 'memory')).toEqual({
      state: {
        tools: { enabled: [] },
      },
      components: ['tools'],
    });
  });

  it('rejects import when --exclude names a path absent from manifest components', async () => {
    const filePath = join(testDir, 'missing-manifest-exclude.savestate');
    await createContainer(filePath, 'synthetic-passphrase', ['memory', 'tools']);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      exclude: 'personality',
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat().join('\n')).toMatch(/exclude path not in archive/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Decrypting agent state');
    error.mockRestore();
    log.mockRestore();
  });

  it('rejects import when a legacy archive lacks the requested exclude path', async () => {
    const filePath = join(testDir, 'missing-legacy-exclude.savestate');
    await createContainer(filePath, 'synthetic-passphrase');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      exclude: 'personality',
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat().join('\n')).toMatch(/exclude path not in archive/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    error.mockRestore();
    log.mockRestore();
  });

  it('still restores when a packed exclude path leaves remaining components', async () => {
    const filePath = join(testDir, 'packed-exclude.savestate');
    const targetDir = join(testDir, 'restored');
    await createContainer(filePath, 'synthetic-passphrase', ['memory', 'tools']);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      exclude: 'memory',
      target: targetDir,
    });

    expect(result).toMatchObject({
      restored: true,
      agentId: 'fixture-agent',
      components: ['tools'],
    });
    expect(log.mock.calls.flat()).toContain('Including paths: tools');
    log.mockRestore();
  });
});
