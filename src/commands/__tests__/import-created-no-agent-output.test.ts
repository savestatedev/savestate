import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { formatImportCreated, importState } from '../container.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate import created no-agent output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-created-no-agent-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(fileName: string, created?: unknown): Promise<string> {
    const passphrase = 'synthetic-passphrase';
    const plaintext = Buffer.from(JSON.stringify({
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-08-25T15:00:00.000Z',
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
    }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      agentId: 'fixture-agent',
      payloads: [
        {
          name: 'other_payload',
          contentType: 'application/json',
          byteLength: plaintext.length,
          sha256: 'a'.repeat(64),
        },
      ],
    };
    if (created !== undefined) {
      manifest.created = created;
    }
    const manifestBuffer = Buffer.from(JSON.stringify(manifest));
    const manifestLength = Buffer.alloc(4);
    manifestLength.writeUInt32LE(manifestBuffer.length, 0);
    const filePath = join(testDir, fileName);
    await fs.writeFile(
      filePath,
      Buffer.concat([createMagicHeader(1), manifestLength, manifestBuffer, encryptedState]),
    );
    return filePath;
  }

  it('formats the created timestamp on its own line', () => {
    expect(formatImportCreated('2026-08-25T15:00:00.000Z')).toBe('  Created: 2026-08-25T15:00:00.000Z');
    expect(formatImportCreated('2026-08-25T15:00:00.000Z')).not.toContain('Agent:');
  });

  it('prints the created timestamp when the container has no agent state', async () => {
    const filePath = await writeContainer('no-agent-created.savestate', '2026-08-25T15:00:00.000Z');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? ''}`);
    }) as typeof process.exit);

    await expect(
      importState({
        in: filePath,
        passphrase: 'synthetic-passphrase',
      }),
    ).rejects.toThrow(/process\.exit:1/);

    expect(error.mock.calls.flat()).toContain(formatImportCreated('2026-08-25T15:00:00.000Z'));
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.startsWith('  Created:'))).toBe(false);
    error.mockRestore();
    log.mockRestore();
    exit.mockRestore();
  });

  it('omits the created line when the container has no agent state and created is empty', async () => {
    const filePath = await writeContainer('no-agent-empty-created.savestate', '   ');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? ''}`);
    }) as typeof process.exit);

    await expect(
      importState({
        in: filePath,
        passphrase: 'synthetic-passphrase',
      }),
    ).rejects.toThrow(/process\.exit:1/);

    expect(error.mock.calls.flat().some((line) => typeof line === 'string' && line.includes('Created:'))).toBe(false);
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.includes('Created:'))).toBe(false);
    error.mockRestore();
    log.mockRestore();
    exit.mockRestore();
  });

  it('omits a created line when the file is not a SaveState container', async () => {
    const filePath = join(testDir, 'not-a-container.bin');
    await fs.writeFile(filePath, Buffer.from('not-a-savestate-file'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? ''}`);
    }) as typeof process.exit);

    await expect(
      importState({
        in: filePath,
        passphrase: 'synthetic-passphrase',
      }),
    ).rejects.toThrow(/process\.exit:1/);

    expect(error.mock.calls.flat().some((line) => typeof line === 'string' && line.includes('Created:'))).toBe(false);
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.includes('Created:'))).toBe(false);
    error.mockRestore();
    log.mockRestore();
    exit.mockRestore();
  });
});
