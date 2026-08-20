import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState } from '../container.js';

function readManifest(file: Buffer): { agentId?: string } {
  const manifestLength = file.readUInt32LE(16);
  return JSON.parse(file.subarray(20, 20 + manifestLength).toString('utf-8'));
}

describe('savestate export empty output path', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-empty-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.rm('   ', { force: true });
  });

  it('rejects an empty output path before writing a file', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: '',
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toEqual({ written: false, out: '', overwritten: false });
    expect(error.mock.calls.flat().join('\n')).toMatch(/output path/i);
    error.mockRestore();
  });

  it('rejects a whitespace-only output path before writing a file', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: '   ',
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toEqual({ written: false, out: '   ', overwritten: false });
    await expect(fs.access('   ')).rejects.toThrow();
    expect(error.mock.calls.flat().join('\n')).toMatch(/output path/i);
    error.mockRestore();
  });

  it('still exports a non-empty output path', async () => {
    const filePath = join(testDir, 'valid-output.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    const written = await fs.readFile(filePath);
    const manifest = readManifest(written);

    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(written.subarray(0, 8).toString('ascii')).toBe('SAVESTAT');
    expect(manifest.agentId).toBe('fixture-agent');
    log.mockRestore();
  });
});
