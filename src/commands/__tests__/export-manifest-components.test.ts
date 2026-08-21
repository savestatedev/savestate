import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState } from '../container.js';

function readManifest(file: Buffer): {
  components?: string[];
} {
  const manifestLength = file.readUInt32LE(16);
  return JSON.parse(file.subarray(20, 20 + manifestLength).toString('utf-8'));
}

describe('savestate export manifest components', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-manifest-components-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('records selected include paths on the unencrypted manifest', async () => {
    const filePath = join(testDir, 'include-memory-tools.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
      include: 'memory,tools',
    });

    const written = await fs.readFile(filePath);
    const manifest = readManifest(written);

    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(written.subarray(0, 8).toString('ascii')).toBe('SAVESTAT');
    expect(manifest.components).toEqual(['memory', 'tools']);
    log.mockRestore();
  });

  it('records every default component on the unencrypted manifest', async () => {
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
    log.mockRestore();
  });
});
