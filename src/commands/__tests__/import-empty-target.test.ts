import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState, importState } from '../container.js';

describe('savestate import empty target path', () => {
  let testDir: string;
  let filePath: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-empty-target-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    filePath = join(testDir, 'fixture.savestate');
    const exported = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });
    expect(exported.written).toBe(true);
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.rm('   ', { recursive: true, force: true });
  });

  it('rejects an empty target path before writing restored state', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      target: '',
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat().join('\n')).toMatch(/target path/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Wrote agent state');
    error.mockRestore();
    log.mockRestore();
  });

  it('rejects a whitespace-only target path before writing restored state', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      target: '   ',
    });

    expect(result).toBeUndefined();
    await expect(fs.access('   ')).rejects.toThrow();
    expect(error.mock.calls.flat().join('\n')).toMatch(/target path/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Wrote agent state');
    error.mockRestore();
    log.mockRestore();
  });

  it('still imports a non-empty target path', async () => {
    const targetDir = join(testDir, 'restored');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      target: targetDir,
    });

    const writtenPath = join(targetDir, 'agent_state.json');
    expect(result).toMatchObject({
      dryRun: false,
      restored: true,
      agentId: 'fixture-agent',
      target: writtenPath,
    });
    await expect(fs.readFile(writtenPath, 'utf-8')).resolves.toContain('fixture-agent');
    expect(log.mock.calls.flat().join('\n')).toContain(writtenPath);
    log.mockRestore();
  });

  it('keeps the current restore path when --target is omitted', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toMatchObject({
      dryRun: false,
      restored: true,
      agentId: 'fixture-agent',
    });
    expect(result?.target).toBeUndefined();
    expect(log.mock.calls.flat().join('\n')).toContain('Successfully restored');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Wrote agent state');
    log.mockRestore();
  });
});
