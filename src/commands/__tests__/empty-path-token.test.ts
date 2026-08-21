import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import {
  applyExcludePaths,
  applyImportExclude,
  applyImportInclude,
  exportState,
  importState,
  parseIncludePaths,
} from '../container.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate empty include/exclude path tokens', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-empty-path-token-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function createValidContainer(filePath: string, passphrase: string): Promise<void> {
    const agentState = {
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-08-21T20:00:00.000Z',
      personality: { name: 'fixture-agent' },
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
    };
    const plaintext = Buffer.from(JSON.stringify(agentState));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest = {
      formatVersion: 1,
      created: '2026-08-21T20:00:00.000Z',
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

  it('rejects an empty include path token', () => {
    expect(parseIncludePaths('memory,,tools')).toEqual({
      error: 'Error: --include path must not be empty.',
    });
    expect(parseIncludePaths('memory,')).toEqual({
      error: 'Error: --include path must not be empty.',
    });
    expect(applyImportInclude({ memory: { facts: [] } }, 'memory,,tools')).toEqual({
      error: 'Error: --include path must not be empty.',
    });
  });

  it('rejects an empty exclude path token', () => {
    const all = {
      personality: true,
      memory: true,
      tools: true,
      preferences: true,
      conversation_history: true,
    };
    expect(applyExcludePaths(all, 'memory,,personality')).toEqual({
      error: 'Error: --exclude path must not be empty.',
    });
    expect(applyExcludePaths(all, 'memory,')).toEqual({
      error: 'Error: --exclude path must not be empty.',
    });
    expect(applyImportExclude({ memory: { facts: [] } }, 'memory,')).toEqual({
      error: 'Error: --exclude path must not be empty.',
    });
  });

  it('does not write a container for an empty include path token', async () => {
    const filePath = join(testDir, 'empty-include.savestate');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? ''}`);
    }) as typeof process.exit);

    await expect(
      exportState({
        agent: 'fixture-agent',
        out: filePath,
        passphrase: 'synthetic-passphrase',
        include: 'memory,',
      }),
    ).rejects.toThrow(/process\.exit:1/);

    await expect(fs.access(filePath)).rejects.toThrow();
    expect(error.mock.calls.flat().join('\n')).toMatch(/include path must not be empty/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully exported');
    error.mockRestore();
    log.mockRestore();
    exit.mockRestore();
  });

  it('does not write a container for an empty exclude path token', async () => {
    const filePath = join(testDir, 'empty-exclude.savestate');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
      exclude: 'memory,',
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false });
    await expect(fs.access(filePath)).rejects.toThrow();
    expect(error.mock.calls.flat().join('\n')).toMatch(/exclude path must not be empty/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully exported');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Encrypting agent state');
    error.mockRestore();
    log.mockRestore();
  });

  it('rejects an empty include path token before restoring', async () => {
    const filePath = join(testDir, 'import-empty-include.savestate');
    await createValidContainer(filePath, 'synthetic-passphrase');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      include: 'memory,,tools',
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat().join('\n')).toMatch(/include path must not be empty/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Decrypting agent state');
    error.mockRestore();
    log.mockRestore();
  });

  it('rejects an empty exclude path token before restoring', async () => {
    const filePath = join(testDir, 'import-empty-exclude.savestate');
    await createValidContainer(filePath, 'synthetic-passphrase');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      exclude: 'memory,',
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat().join('\n')).toMatch(/exclude path must not be empty/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Decrypting agent state');
    error.mockRestore();
    log.mockRestore();
  });
});
