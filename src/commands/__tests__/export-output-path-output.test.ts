import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState, formatExportOutput } from '../container.js';

describe('savestate export output path', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-output-path-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('formats the output path on its own line', () => {
    expect(formatExportOutput('/tmp/agent.savestate')).toBe('  Output: /tmp/agent.savestate');
    expect(formatExportOutput('/tmp/agent.savestate')).not.toContain('Agent:');
  });

  it('prints the output path after a successful export', async () => {
    const filePath = join(testDir, 'with-output.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(log.mock.calls.flat()).toContain(formatExportOutput(filePath));
    log.mockRestore();
  });

  it('omits an output path when export does not write', async () => {
    const filePath = join(testDir, 'unwritten.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await exportState({
      agent: '',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false });
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.startsWith('  Output: '))).toBe(false);
    error.mockRestore();
    log.mockRestore();
  });
});
