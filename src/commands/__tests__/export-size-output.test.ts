import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState, formatExportSize } from '../container.js';

function readManifest(file: Buffer): {
  payloads?: Array<{ byteLength?: number }>;
} {
  const manifestLength = file.readUInt32LE(16);
  return JSON.parse(file.subarray(20, 20 + manifestLength).toString('utf-8'));
}

describe('savestate export size output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-size-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('formats the size on its own line', () => {
    expect(formatExportSize(42)).toBe('  Size: 42 bytes');
    expect(formatExportSize(42)).not.toContain('Agent:');
  });

  it('prints the payload size after a successful export', async () => {
    const filePath = join(testDir, 'with-size.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    const written = await fs.readFile(filePath);
    const manifest = readManifest(written);
    const payloadBytes = manifest.payloads?.[0]?.byteLength;

    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(payloadBytes).toEqual(expect.any(Number));
    expect(payloadBytes).toBeGreaterThan(0);
    expect(log.mock.calls.flat()).toContain(`  Size: ${payloadBytes} bytes`);
    log.mockRestore();
  });

  it('omits a size when export does not write', async () => {
    const filePath = join(testDir, 'unwritten.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await exportState({
      agent: '',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false });
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.startsWith('  Size: '))).toBe(false);
    error.mockRestore();
    log.mockRestore();
  });
});
