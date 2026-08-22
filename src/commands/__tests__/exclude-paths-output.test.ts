import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { exportState, importState, listExcludedPaths } from '../container.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate --exclude path output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-exclude-paths-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function createValidContainer(filePath: string, passphrase: string): Promise<void> {
    const agentState = {
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-08-21T23:30:00.000Z',
      personality: { name: 'fixture-agent' },
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
    };
    const plaintext = Buffer.from(JSON.stringify(agentState));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest = {
      formatVersion: 1,
      created: '2026-08-21T23:30:00.000Z',
      agentId: 'fixture-agent',
      payloads: [
        {
          name: 'agent_state',
          contentType: 'application/json',
          byteLength: plaintext.length,
          sha256: createHash('sha256').update(plaintext).digest('hex'),
        },
      ],
    };
    const manifestBuffer = Buffer.from(JSON.stringify(manifest));
    const manifestLength = Buffer.alloc(4);
    manifestLength.writeUInt32LE(manifestBuffer.length, 0);
    await fs.writeFile(
      filePath,
      Buffer.concat([createMagicHeader(1), manifestLength, manifestBuffer, encryptedState]),
    );
  }

  it('normalizes excluded path tokens', () => {
    expect(listExcludedPaths(undefined)).toEqual([]);
    expect(listExcludedPaths('personality')).toEqual(['personality']);
    expect(listExcludedPaths('personality, Memory')).toEqual(['personality', 'memory']);
  });

  it('prints excluded paths on export', async () => {
    const filePath = join(testDir, 'export-exclude.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
      exclude: 'personality',
    });

    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(log.mock.calls.flat()).toContain('Excluding paths: personality');
    expect(log.mock.calls.flat()).toContain('Including paths: memory, tools, preferences, conversation_history');
    log.mockRestore();
  });

  it('prints excluded paths on import', async () => {
    const filePath = join(testDir, 'import-exclude.savestate');
    const targetDir = join(testDir, 'restored');
    await createValidContainer(filePath, 'synthetic-passphrase');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      exclude: 'personality',
      target: targetDir,
    });

    expect(result).toMatchObject({
      restored: true,
      agentId: 'fixture-agent',
      components: ['memory', 'tools'],
    });
    expect(log.mock.calls.flat()).toContain('Excluding paths: personality');
    expect(log.mock.calls.flat()).toContain('Including paths: memory, tools');
    log.mockRestore();
  });

  it('does not print excluded paths when --exclude is rejected', async () => {
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
    expect(error.mock.calls.flat().join('\n')).toMatch(/unknown exclude path/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Excluding paths:');
    error.mockRestore();
    log.mockRestore();
  });

  it('does not print excluded paths for include-only selection', async () => {
    const filePath = join(testDir, 'include-only.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
      include: 'memory,tools',
    });

    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(log.mock.calls.flat()).toContain('Including paths: memory, tools');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Excluding paths:');
    log.mockRestore();
  });
});
