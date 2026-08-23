import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState, formatExportExcluded } from '../container.js';

function readManifest(file: Buffer): {
  excluded?: string[];
} {
  const manifestLength = file.readUInt32LE(16);
  return JSON.parse(file.subarray(20, 20 + manifestLength).toString('utf-8'));
}

describe('savestate export excluded output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-excluded-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('formats excluded paths on their own line', () => {
    expect(formatExportExcluded(['personality'])).toBe('  Excluded: personality');
    expect(formatExportExcluded(['personality', 'tools'])).toBe('  Excluded: personality, tools');
    expect(formatExportExcluded(['personality'])).not.toContain('Agent:');
  });

  it('prints excluded paths after a successful export', async () => {
    const filePath = join(testDir, 'with-excluded.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
      exclude: 'personality',
    });

    const written = await fs.readFile(filePath);
    const manifest = readManifest(written);

    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(manifest.excluded).toEqual(['personality']);
    expect(log.mock.calls.flat()).toContain('  Excluded: personality');
    log.mockRestore();
  });

  it('omits excluded when export writes none or does not write', async () => {
    const unlabeled = join(testDir, 'without-excluded.savestate');
    const unwritten = join(testDir, 'unwritten.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const unlabeledResult = await exportState({
      agent: 'fixture-agent',
      out: unlabeled,
      passphrase: 'synthetic-passphrase',
    });
    const unwrittenResult = await exportState({
      agent: '',
      out: unwritten,
      passphrase: 'synthetic-passphrase',
    });

    const unlabeledManifest = readManifest(await fs.readFile(unlabeled));

    expect(unlabeledResult).toEqual({ written: true, out: unlabeled, overwritten: false });
    expect(unlabeledManifest.excluded).toBeUndefined();
    expect(unwrittenResult).toEqual({ written: false, out: unwritten, overwritten: false });
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.startsWith('  Excluded:'))).toBe(false);
    error.mockRestore();
    log.mockRestore();
  });
});
