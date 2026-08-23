import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState, formatExportAgent } from '../container.js';

function readManifest(file: Buffer): {
  agentId?: string;
} {
  const manifestLength = file.readUInt32LE(16);
  return JSON.parse(file.subarray(20, 20 + manifestLength).toString('utf-8'));
}

describe('savestate export agent output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-agent-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('formats the agent id on its own line', () => {
    expect(formatExportAgent('fixture-agent')).toBe('  Agent: fixture-agent');
    expect(formatExportAgent('fixture-agent')).not.toContain('Source:');
  });

  it('prints the agent id after a successful export', async () => {
    const filePath = join(testDir, 'with-agent.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    const written = await fs.readFile(filePath);
    const manifest = readManifest(written);

    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(manifest.agentId).toBe('fixture-agent');
    expect(log.mock.calls.flat()).toContain('  Agent: fixture-agent');
    log.mockRestore();
  });

  it('omits an agent id when export does not write', async () => {
    const filePath = join(testDir, 'unwritten.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await exportState({
      agent: '',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false });
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.startsWith('  Agent: '))).toBe(false);
    error.mockRestore();
    log.mockRestore();
  });
});
