import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState, formatExportContentType } from '../container.js';

function readManifest(file: Buffer): {
  payloads?: Array<{ contentType?: string }>;
} {
  const manifestLength = file.readUInt32LE(16);
  return JSON.parse(file.subarray(20, 20 + manifestLength).toString('utf-8'));
}

describe('savestate export content type output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-content-type-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('formats the content type on its own line', () => {
    expect(formatExportContentType('application/json')).toBe('  Content-Type: application/json');
    expect(formatExportContentType('application/json')).not.toContain('Agent:');
  });

  it('prints the content type after a successful export', async () => {
    const filePath = join(testDir, 'with-content-type.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    const written = await fs.readFile(filePath);
    const manifest = readManifest(written);

    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(manifest.payloads?.[0]?.contentType).toBe('application/json');
    expect(log.mock.calls.flat()).toContain('  Content-Type: application/json');
    log.mockRestore();
  });

  it('omits a content type when export does not write', async () => {
    const filePath = join(testDir, 'unwritten.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await exportState({
      agent: '',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false });
    expect(log.mock.calls.flat()).not.toContain('  Content-Type: application/json');
    error.mockRestore();
    log.mockRestore();
  });
});
