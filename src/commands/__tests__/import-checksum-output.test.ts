import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { exportState, formatImportChecksum, importState } from '../container.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate import checksum output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-checksum-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(fileName: string): Promise<{ filePath: string; checksum: string }> {
    const passphrase = 'synthetic-passphrase';
    const plaintext = Buffer.from(JSON.stringify({
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-08-22T15:00:00.000Z',
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
    }));
    const checksum = createHash('sha256').update(plaintext).digest('hex');
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      created: '2026-08-22T15:00:00.000Z',
      agentId: 'fixture-agent',
      payloads: [
        {
          name: 'agent_state',
          contentType: 'application/json',
          byteLength: plaintext.length,
          sha256: checksum,
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
    return { filePath, checksum };
  }

  it('formats the checksum on its own line', () => {
    const hash = 'a'.repeat(64);
    expect(formatImportChecksum(hash)).toBe(`  Checksum: ${hash}`);
    expect(formatImportChecksum(hash)).not.toContain('Agent:');
  });

  it('returns and prints the verified checksum on a successful import', async () => {
    const { filePath, checksum } = await writeContainer('with-checksum.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toMatchObject({
      restored: true,
      agentId: 'fixture-agent',
      checksum,
    });
    expect(log.mock.calls.flat()).toContain(`  Checksum: ${checksum}`);
    log.mockRestore();
  });

  it('prints the checksum on dry-run and after a real export', async () => {
    const packed = await writeContainer('dry-run-checksum.savestate');
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
      checksum: packed.checksum,
    });
    expect(fromExport?.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(log.mock.calls.flat()).toContain(`  Checksum: ${packed.checksum}`);
    expect(log.mock.calls.filter((call) => typeof call[0] === 'string' && call[0].startsWith('  Checksum: ')).length).toBeGreaterThan(1);
    log.mockRestore();
  });
});
