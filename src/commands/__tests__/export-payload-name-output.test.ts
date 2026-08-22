import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState, formatExportPayloadName } from '../container.js';

function readManifest(file: Buffer): {
  payloads?: Array<{ name?: string }>;
} {
  const manifestLength = file.readUInt32LE(16);
  return JSON.parse(file.subarray(20, 20 + manifestLength).toString('utf-8'));
}

describe('savestate export payload name output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-payload-name-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('formats the payload name on its own line', () => {
    expect(formatExportPayloadName('agent_state')).toBe('  Payload: agent_state');
    expect(formatExportPayloadName('agent_state')).not.toContain('Agent:');
  });

  it('prints the payload name after a successful export', async () => {
    const filePath = join(testDir, 'with-payload-name.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    const written = await fs.readFile(filePath);
    const manifest = readManifest(written);

    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(manifest.payloads?.[0]?.name).toBe('agent_state');
    expect(log.mock.calls.flat()).toContain('  Payload: agent_state');
    log.mockRestore();
  });

  it('omits a payload name when export does not write', async () => {
    const filePath = join(testDir, 'unwritten.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await exportState({
      agent: '',
      out: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toEqual({ written: false, out: filePath, overwritten: false });
    expect(log.mock.calls.flat()).not.toContain('  Payload: agent_state');
    error.mockRestore();
    log.mockRestore();
  });
});
