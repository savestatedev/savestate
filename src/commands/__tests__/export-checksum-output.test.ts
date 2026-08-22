import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState, formatExportChecksum } from '../container.js';

function readManifest(file: Buffer): {
  payloads?: Array<{ sha256?: string }>;
} {
  const manifestLength = file.readUInt32LE(16);
  return JSON.parse(file.subarray(20, 20 + manifestLength).toString('utf-8'));
}

describe('savestate export checksum output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-checksum-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('formats the checksum on its own line', () => {
    const hash = 'a'.repeat(64);
    expect(formatExportChecksum(hash)).toBe(`  Checksum: ${hash}`);
    expect(formatExportChecksum(hash)).not.toContain('Agent:');
  });

  it('prints the payload checksum after a successful export', async () => {
    const filePath = join(testDir, 'with-checksum.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    const written = await fs.readFile(filePath);
    const manifest = readManifest(written);
    const checksum = manifest.payloads?.[0]?.sha256;

    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(log.mock.calls.flat()).toContain(`  Checksum: ${checksum}`);
    log.mockRestore();
  });

  it('omits a checksum when export does not write', async () => {
    const filePath = join(testDir, 'unwritten.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await exportState({
      agent: '',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false });
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.startsWith('  Checksum: '))).toBe(false);
    error.mockRestore();
    log.mockRestore();
  });
});
