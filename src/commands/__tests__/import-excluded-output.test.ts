import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { exportState, formatImportExcluded, importState } from '../container.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate import excluded output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-excluded-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(fileName: string, excluded?: unknown): Promise<string> {
    const passphrase = 'synthetic-passphrase';
    const plaintext = Buffer.from(JSON.stringify({
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-08-22T11:00:00.000Z',
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
    }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      created: '2026-08-22T11:00:00.000Z',
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
    if (excluded !== undefined) {
      manifest.excluded = excluded;
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

  it('formats excluded paths on their own line', () => {
    expect(formatImportExcluded(['personality'])).toBe('  Excluded: personality');
    expect(formatImportExcluded(['personality', 'tools'])).toBe('  Excluded: personality, tools');
    expect(formatImportExcluded(['personality'])).not.toContain('Agent:');
  });

  it('returns and prints excluded paths when the manifest lists them', async () => {
    const filePath = await writeContainer('with-excluded.savestate', ['personality']);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toMatchObject({
      restored: true,
      agentId: 'fixture-agent',
      excluded: ['personality'],
    });
    expect(log.mock.calls.flat()).toContain('  Excluded: personality');
    log.mockRestore();
  });

  it('prints excluded paths on dry-run and omits them when the archive has none', async () => {
    const withExcluded = await writeContainer('dry-run-excluded.savestate', ['personality']);
    const withoutExcluded = await writeContainer('no-excluded.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const preview = await importState({
      in: withExcluded,
      passphrase: 'synthetic-passphrase',
      dryRun: true,
    });
    const older = await importState({
      in: withoutExcluded,
      passphrase: 'synthetic-passphrase',
    });
    const exported = join(testDir, 'exported.savestate');
    await exportState({
      agent: 'fixture-agent',
      out: exported,
      passphrase: 'synthetic-passphrase',
      exclude: 'personality',
    });
    const fromExport = await importState({
      in: exported,
      passphrase: 'synthetic-passphrase',
    });

    expect(preview).toMatchObject({
      dryRun: true,
      restored: false,
      excluded: ['personality'],
    });
    expect(older?.excluded).toBeUndefined();
    expect(fromExport).toMatchObject({ excluded: ['personality'] });
    expect(log.mock.calls.flat()).toContain('  Excluded: personality');
    expect(log.mock.calls.filter((call) => call[0] === '  Excluded: personality').length).toBeGreaterThan(1);
    log.mockRestore();
  });
});
