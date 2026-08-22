import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState, formatExportFormatVersion } from '../container.js';

function readManifest(file: Buffer): {
  formatVersion?: number;
} {
  const manifestLength = file.readUInt32LE(16);
  return JSON.parse(file.subarray(20, 20 + manifestLength).toString('utf-8'));
}

describe('savestate export format version output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-format-version-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('formats the format version on its own line', () => {
    expect(formatExportFormatVersion(1)).toBe('  Format: v1');
    expect(formatExportFormatVersion(1)).not.toContain('Agent:');
  });

  it('prints the format version after a successful export', async () => {
    const filePath = join(testDir, 'with-format-version.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    const written = await fs.readFile(filePath);
    const manifest = readManifest(written);

    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(manifest.formatVersion).toBe(1);
    expect(log.mock.calls.flat()).toContain('  Format: v1');
    log.mockRestore();
  });

  it('omits a format version when export does not write', async () => {
    const filePath = join(testDir, 'unwritten.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await exportState({
      agent: '',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false });
    expect(log.mock.calls.flat()).not.toContain('  Format: v1');
    error.mockRestore();
    log.mockRestore();
  });
});
