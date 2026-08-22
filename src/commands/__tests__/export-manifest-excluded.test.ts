import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState } from '../container.js';

function readManifest(file: Buffer): {
  components?: string[];
  excluded?: string[];
} {
  const manifestLength = file.readUInt32LE(16);
  return JSON.parse(file.subarray(20, 20 + manifestLength).toString('utf-8'));
}

describe('savestate export manifest excluded', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-manifest-excluded-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('records excluded paths on the unencrypted manifest', async () => {
    const filePath = join(testDir, 'exclude-personality.savestate');
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
    expect(written.subarray(0, 8).toString('ascii')).toBe('SAVESTAT');
    expect(manifest.components).toEqual(['memory', 'tools', 'preferences', 'conversation_history']);
    expect(manifest.excluded).toEqual(['personality']);
    log.mockRestore();
  });

  it('records only the exclude tokens when include and exclude are combined', async () => {
    const filePath = join(testDir, 'include-exclude.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
      include: 'memory,tools',
      exclude: 'memory',
    });

    const written = await fs.readFile(filePath);
    const manifest = readManifest(written);

    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(manifest.components).toEqual(['tools']);
    expect(manifest.excluded).toEqual(['memory']);
    log.mockRestore();
  });

  it('omits excluded when --exclude is not used', async () => {
    const filePath = join(testDir, 'default-all.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    const written = await fs.readFile(filePath);
    const manifest = readManifest(written);

    expect(manifest.components).toEqual(['personality', 'memory', 'tools', 'preferences', 'conversation_history']);
    expect(manifest.excluded).toBeUndefined();
    log.mockRestore();
  });

  it('does not write a container for a rejected exclude path', async () => {
    const filePath = join(testDir, 'rejected-exclude.savestate');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
      exclude: 'secrets',
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false });
    await expect(fs.access(filePath)).rejects.toThrow();
    expect(error.mock.calls.flat().join('\n')).toMatch(/unknown exclude path/i);
    error.mockRestore();
    log.mockRestore();
  });
});
