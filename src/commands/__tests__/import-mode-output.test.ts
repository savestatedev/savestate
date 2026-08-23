import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { exportState, formatImportMode, importState } from '../container.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate import mode output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-mode-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(fileName: string): Promise<string> {
    const passphrase = 'synthetic-passphrase';
    const plaintext = Buffer.from(JSON.stringify({
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-08-23T07:00:00.000Z',
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
    }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      created: '2026-08-23T07:00:00.000Z',
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
    await fs.writeFile(
      filePath,
      Buffer.concat([createMagicHeader(1), manifestLength, manifestBuffer, encryptedState]),
    );
    return filePath;
  }

  it('formats the restore mode on its own line', () => {
    expect(formatImportMode('replace')).toBe('  Mode: replace');
    expect(formatImportMode('merge')).toBe('  Mode: merge');
    expect(formatImportMode('replace')).not.toContain('Agent:');
  });

  it('returns and prints replace mode on a successful import', async () => {
    const filePath = await writeContainer('with-replace-mode.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toMatchObject({
      restored: true,
      agentId: 'fixture-agent',
      mode: 'replace',
    });
    expect(log.mock.calls.flat()).toContain('  Mode: replace');
    log.mockRestore();
  });

  it('prints merge mode when import is requested with merge', async () => {
    const filePath = await writeContainer('with-merge-mode.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      merge: true,
    });

    expect(result).toMatchObject({
      restored: true,
      mode: 'merge',
    });
    expect(log.mock.calls.flat()).toContain('  Mode: merge');
    log.mockRestore();
  });

  it('prints the restore mode on dry-run and after a real export', async () => {
    const packed = await writeContainer('dry-run-mode.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const preview = await importState({
      in: packed,
      passphrase: 'synthetic-passphrase',
      dryRun: true,
    });
    const exported = join(testDir, 'exported.savestate');
    await exportState({
      agent: 'fixture-agent',
      out: exported,
      passphrase: 'synthetic-passphrase',
    });
    const fromExport = await importState({
      in: exported,
      passphrase: 'synthetic-passphrase',
    });

    expect(preview).toMatchObject({
      dryRun: true,
      restored: false,
      mode: 'replace',
    });
    expect(fromExport).toMatchObject({ mode: 'replace' });
    expect(log.mock.calls.flat()).toContain('  Mode: replace');
    expect(log.mock.calls.filter((call) => call[0] === '  Mode: replace').length).toBeGreaterThan(1);
    log.mockRestore();
  });

  it('omits a restore mode when import does not restore', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await importState({
      in: '',
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toBeUndefined();
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.startsWith('  Mode: '))).toBe(false);
    error.mockRestore();
    log.mockRestore();
  });
});
