import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState, importState } from '../container.js';

describe('savestate import directory input path', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-directory-input-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('rejects a directory input path before reading a container', async () => {
    const dirPath = join(testDir, 'input-dir');
    await fs.mkdir(dirPath);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: dirPath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat().join('\n')).toMatch(/directory/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    error.mockRestore();
    log.mockRestore();
  });

  it('still imports a non-directory input path', async () => {
    const filePath = join(testDir, 'valid-input.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exported = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });
    expect(exported.written).toBe(true);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toMatchObject({
      dryRun: false,
      restored: true,
      agentId: 'fixture-agent',
    });
    expect(log.mock.calls.flat().join('\n')).toContain('Successfully restored');
    log.mockRestore();
  });
});
