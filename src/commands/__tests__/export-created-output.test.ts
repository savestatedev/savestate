import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState, formatExportCreated } from '../container.js';

function readManifest(file: Buffer): {
  created?: string;
} {
  const manifestLength = file.readUInt32LE(16);
  return JSON.parse(file.subarray(20, 20 + manifestLength).toString('utf-8'));
}

describe('savestate export created output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-created-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('formats the created timestamp on its own line', () => {
    expect(formatExportCreated('2026-08-23T12:00:00.000Z')).toBe('  Created: 2026-08-23T12:00:00.000Z');
    expect(formatExportCreated('2026-08-23T12:00:00.000Z')).not.toContain('Agent:');
  });

  it('prints the created timestamp after a successful export', async () => {
    const filePath = join(testDir, 'with-created.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    const written = await fs.readFile(filePath);
    const manifest = readManifest(written);

    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(manifest.created).toEqual(expect.any(String));
    expect(manifest.created!.length).toBeGreaterThan(0);
    expect(log.mock.calls.flat()).toContain(`  Created: ${manifest.created}`);
    log.mockRestore();
  });

  it('omits a created timestamp when export does not write', async () => {
    const filePath = join(testDir, 'unwritten.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await exportState({
      agent: '',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false });
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.startsWith('  Created: '))).toBe(false);
    error.mockRestore();
    log.mockRestore();
  });
});
