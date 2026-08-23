import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState, formatExportComponents } from '../container.js';

function readManifest(file: Buffer): {
  components?: string[];
} {
  const manifestLength = file.readUInt32LE(16);
  return JSON.parse(file.subarray(20, 20 + manifestLength).toString('utf-8'));
}

describe('savestate export components output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-components-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('formats included components on their own line', () => {
    expect(formatExportComponents(['memory'])).toBe('  Components: memory');
    expect(formatExportComponents(['memory', 'tools'])).toBe('  Components: memory, tools');
    expect(formatExportComponents([])).toBe('  Components: none');
    expect(formatExportComponents(['memory'])).not.toContain('Agent:');
  });

  it('prints included components after a successful export', async () => {
    const filePath = join(testDir, 'with-components.savestate');
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
    expect(manifest.components).toEqual(['memory', 'tools']);
    expect(log.mock.calls.flat()).toContain('  Components: memory, tools');
    log.mockRestore();
  });

  it('omits components when export does not write', async () => {
    const filePath = join(testDir, 'unwritten.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await exportState({
      agent: '',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false });
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.startsWith('  Components:'))).toBe(false);
    error.mockRestore();
    log.mockRestore();
  });
});
