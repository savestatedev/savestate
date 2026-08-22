import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { exportState, formatImportSize, importState } from '../container.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate import size output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-size-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(fileName: string): Promise<{ filePath: string; payloadBytes: number }> {
    const passphrase = 'synthetic-passphrase';
    const plaintext = Buffer.from(JSON.stringify({
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-08-22T16:00:00.000Z',
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
    }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      created: '2026-08-22T16:00:00.000Z',
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
    return { filePath, payloadBytes: plaintext.length };
  }

  it('formats the size on its own line', () => {
    expect(formatImportSize(42)).toBe('  Size: 42 bytes');
    expect(formatImportSize(42)).not.toContain('Agent:');
  });

  it('returns and prints the decrypted payload length on a successful import', async () => {
    const { filePath, payloadBytes } = await writeContainer('with-size.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toMatchObject({
      restored: true,
      agentId: 'fixture-agent',
      payloadBytes,
    });
    expect(log.mock.calls.flat()).toContain(`  Size: ${payloadBytes} bytes`);
    log.mockRestore();
  });

  it('prints the size on dry-run and after a real export', async () => {
    const packed = await writeContainer('dry-run-size.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const preview = await importState({
      in: packed.filePath,
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
      payloadBytes: packed.payloadBytes,
    });
    expect(fromExport?.payloadBytes).toEqual(expect.any(Number));
    expect(fromExport!.payloadBytes).toBeGreaterThan(0);
    expect(log.mock.calls.flat()).toContain(`  Size: ${packed.payloadBytes} bytes`);
    expect(log.mock.calls.filter((call) => typeof call[0] === 'string' && call[0].startsWith('  Size: ')).length).toBeGreaterThan(1);
    log.mockRestore();
  });
});
