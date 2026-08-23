import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState, formatExportEncryption } from '../container.js';

function readManifest(file: Buffer): {
  encryption?: { algorithm?: string };
} {
  const manifestLength = file.readUInt32LE(16);
  return JSON.parse(file.subarray(20, 20 + manifestLength).toString('utf-8'));
}

describe('savestate export encryption output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-encryption-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('formats the encryption algorithm on its own line', () => {
    expect(formatExportEncryption('AES-256-GCM')).toBe('  Encryption: AES-256-GCM');
    expect(formatExportEncryption('AES-256-GCM')).not.toContain('Agent:');
  });

  it('prints the encryption algorithm after a successful export', async () => {
    const filePath = join(testDir, 'with-encryption.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    const written = await fs.readFile(filePath);
    const manifest = readManifest(written);

    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(manifest.encryption?.algorithm).toBe('AES-256-GCM');
    expect(log.mock.calls.flat()).toContain('  Encryption: AES-256-GCM');
    log.mockRestore();
  });

  it('omits encryption when export does not write', async () => {
    const filePath = join(testDir, 'unwritten.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await exportState({
      agent: '',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false });
    expect(log.mock.calls.flat()).not.toContain('  Encryption: AES-256-GCM');
    error.mockRestore();
    log.mockRestore();
  });
});
