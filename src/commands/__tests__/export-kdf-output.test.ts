import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState, formatExportKeyDerivation } from '../container.js';

function readManifest(file: Buffer): {
  encryption?: { keyDerivation?: string };
} {
  const manifestLength = file.readUInt32LE(16);
  return JSON.parse(file.subarray(20, 20 + manifestLength).toString('utf-8'));
}

describe('savestate export key derivation output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-kdf-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('formats the key derivation on its own line', () => {
    expect(formatExportKeyDerivation('Argon2id')).toBe('  Key derivation: Argon2id');
    expect(formatExportKeyDerivation('Argon2id')).not.toContain('Agent:');
  });

  it('prints the key derivation after a successful export', async () => {
    const filePath = join(testDir, 'with-kdf.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    const written = await fs.readFile(filePath);
    const manifest = readManifest(written);

    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(manifest.encryption?.keyDerivation).toBe('Argon2id');
    expect(log.mock.calls.flat()).toContain('  Key derivation: Argon2id');
    log.mockRestore();
  });

  it('omits key derivation when export does not write', async () => {
    const filePath = join(testDir, 'unwritten.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await exportState({
      agent: '',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false });
    expect(log.mock.calls.flat()).not.toContain('  Key derivation: Argon2id');
    error.mockRestore();
    log.mockRestore();
  });
});
