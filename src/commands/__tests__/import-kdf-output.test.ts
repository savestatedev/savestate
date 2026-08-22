import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { exportState, formatImportKeyDerivation, importState } from '../container.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate import key derivation output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-kdf-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(fileName: string, encryption?: unknown): Promise<string> {
    const passphrase = 'synthetic-passphrase';
    const plaintext = Buffer.from(JSON.stringify({
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-08-22T15:00:00.000Z',
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
    }));
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
          sha256: createHash('sha256').update(plaintext).digest('hex'),
        },
      ],
    };
    if (encryption !== undefined) {
      manifest.encryption = encryption;
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

  it('formats the key derivation on its own line', () => {
    expect(formatImportKeyDerivation('Argon2id')).toBe('  Key derivation: Argon2id');
    expect(formatImportKeyDerivation('Argon2id')).not.toContain('Agent:');
  });

  it('returns and prints the KDF when the manifest names it', async () => {
    const filePath = await writeContainer('with-kdf.savestate', {
      algorithm: 'AES-256-GCM',
      keyDerivation: 'Argon2id',
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toMatchObject({
      restored: true,
      agentId: 'fixture-agent',
      keyDerivation: 'Argon2id',
    });
    expect(log.mock.calls.flat()).toContain('  Key derivation: Argon2id');
    log.mockRestore();
  });

  it('prints the KDF on dry-run and omits it when the archive has none', async () => {
    const withKdf = await writeContainer('dry-run-kdf.savestate', {
      algorithm: 'AES-256-GCM',
      keyDerivation: 'Argon2id',
    });
    const withoutKdf = await writeContainer('no-kdf.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const preview = await importState({
      in: withKdf,
      passphrase: 'synthetic-passphrase',
      dryRun: true,
    });
    const older = await importState({
      in: withoutKdf,
      passphrase: 'synthetic-passphrase',
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
      keyDerivation: 'Argon2id',
    });
    expect(older?.keyDerivation).toBeUndefined();
    expect(fromExport).toMatchObject({ keyDerivation: 'Argon2id' });
    expect(log.mock.calls.flat()).toContain('  Key derivation: Argon2id');
    expect(log.mock.calls.filter((call) => call[0] === '  Key derivation: Argon2id').length).toBeGreaterThan(1);
    log.mockRestore();
  });
});
