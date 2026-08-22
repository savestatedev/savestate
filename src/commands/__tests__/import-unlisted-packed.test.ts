import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { exportState, importState } from '../container.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate import unlisted packed path', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-unlisted-packed-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(
    fileName: string,
    state: Record<string, unknown>,
    components?: unknown,
  ): Promise<string> {
    const passphrase = 'synthetic-passphrase';
    const plaintext = Buffer.from(JSON.stringify(state));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      created: '2026-08-22T08:10:00.000Z',
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
    if (components !== undefined) {
      manifest.components = components;
    }
    const manifestBuffer = Buffer.from(JSON.stringify(manifest));
    const manifestLength = Buffer.alloc(4);
    manifestLength.writeUInt32LE(manifestBuffer.length, 0);
    const filePath = join(testDir, fileName);
    await fs.writeFile(
      filePath,
      Buffer.concat([createMagicHeader(1), manifestLength, manifestBuffer, encryptedState]),
    );
    return filePath;
  }

  it('rejects a container whose packed state includes an unlisted path', async () => {
    const filePath = await writeContainer(
      'unlisted-packed.savestate',
      {
        agentId: 'fixture-agent',
        version: 1,
        exportedAt: '2026-08-22T08:10:00.000Z',
        memory: { facts: ['synthetic'] },
        tools: { enabled: [] },
      },
      ['memory'],
    );
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat().join('\n')).toBe('Error: packed path not listed: tools');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    error.mockRestore();
    log.mockRestore();
  });

  it('imports a matching components list and still accepts older files without them', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const matching = await writeContainer(
      'matching-components.savestate',
      {
        agentId: 'fixture-agent',
        version: 1,
        exportedAt: '2026-08-22T08:10:00.000Z',
        memory: { facts: ['synthetic'] },
      },
      ['memory'],
    );
    const legacy = await writeContainer(
      'no-components.savestate',
      {
        agentId: 'fixture-agent',
        version: 1,
        exportedAt: '2026-08-22T08:10:00.000Z',
        memory: { facts: ['synthetic'] },
      },
    );
    const exported = join(testDir, 'exported.savestate');

    const known = await importState({
      in: matching,
      passphrase: 'synthetic-passphrase',
    });
    const older = await importState({
      in: legacy,
      passphrase: 'synthetic-passphrase',
    });
    const written = await exportState({
      agent: 'fixture-agent',
      out: exported,
      passphrase: 'synthetic-passphrase',
      include: 'memory,tools',
    });
    const fromExport = await importState({
      in: exported,
      passphrase: 'synthetic-passphrase',
    });

    expect(known).toMatchObject({ restored: true, agentId: 'fixture-agent' });
    expect(older).toMatchObject({ restored: true, agentId: 'fixture-agent' });
    expect(written.written).toBe(true);
    expect(fromExport).toMatchObject({ restored: true, agentId: 'fixture-agent' });
    log.mockRestore();
  });
});
