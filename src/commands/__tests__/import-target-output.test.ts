import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { exportState, formatImportTarget, importState } from '../container.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate import target output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-target-output-${Date.now()}`);
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

  it('formats the target path on its own line', () => {
    expect(formatImportTarget('/tmp/restored/agent_state.json')).toBe('  Target: /tmp/restored/agent_state.json');
    expect(formatImportTarget('/tmp/restored/agent_state.json')).not.toContain('Mode:');
  });

  it('returns and prints the target path on a successful import', async () => {
    const filePath = await writeContainer('with-target.savestate');
    const targetDir = join(testDir, 'restored');
    const writtenPath = join(targetDir, 'agent_state.json');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      target: targetDir,
    });

    expect(result).toMatchObject({
      restored: true,
      agentId: 'fixture-agent',
      target: writtenPath,
    });
    expect(log.mock.calls.flat()).toContain(formatImportTarget(writtenPath));
    log.mockRestore();
  });

  it('prints the target path on dry-run without writing', async () => {
    const packed = await writeContainer('dry-run-target.savestate');
    const targetDir = join(testDir, 'dry-restored');
    const previewPath = join(resolve(targetDir), 'agent_state.json');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const preview = await importState({
      in: packed,
      passphrase: 'synthetic-passphrase',
      dryRun: true,
      target: targetDir,
    });

    expect(preview).toMatchObject({
      dryRun: true,
      restored: false,
      target: previewPath,
    });
    expect(log.mock.calls.flat()).toContain(formatImportTarget(previewPath));
    await expect(fs.stat(previewPath)).rejects.toMatchObject({ code: 'ENOENT' });
    log.mockRestore();
  });

  it('omits a target path when import does not restore', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await importState({
      in: '',
      passphrase: 'synthetic-passphrase',
      target: join(testDir, 'unused'),
    });

    expect(result).toBeUndefined();
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.startsWith('  Target: '))).toBe(false);
    error.mockRestore();
    log.mockRestore();
  });

  it('omits a target path when --target is not set', async () => {
    const filePath = await writeContainer('no-target.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toMatchObject({ restored: true });
    expect(result?.target).toBeUndefined();
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.startsWith('  Target: '))).toBe(false);
    log.mockRestore();
  });
});
