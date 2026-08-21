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

describe('savestate import component schema', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-components-schema-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(fileName: string, components?: unknown): Promise<string> {
    const passphrase = 'synthetic-passphrase';
    const plaintext = Buffer.from(JSON.stringify({
      agentId: 'fixture-agent',
      version: 1,
      memory: { facts: ['synthetic'] },
    }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      created: '2026-08-21T17:10:00.000Z',
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

  it('rejects a container whose components list includes an unknown path', async () => {
    const filePath = await writeContainer('unknown-component.savestate', ['memory', 'secrets']);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat().join('\n')).toMatch(/unknown component/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    error.mockRestore();
    log.mockRestore();
  });

  it('rejects an empty components list', async () => {
    const filePath = await writeContainer('empty-components.savestate', []);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat().join('\n')).toMatch(/at least one path/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    error.mockRestore();
    log.mockRestore();
  });

  it('imports known components and still accepts older files without them', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const withComponents = await writeContainer('known-components.savestate', ['memory', 'tools']);
    const withoutComponents = await writeContainer('no-components.savestate');
    const exported = join(testDir, 'exported.savestate');

    const known = await importState({
      in: withComponents,
      passphrase: 'synthetic-passphrase',
    });
    const legacy = await importState({
      in: withoutComponents,
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
    expect(legacy).toMatchObject({ restored: true, agentId: 'fixture-agent' });
    expect(written.written).toBe(true);
    expect(fromExport).toMatchObject({ restored: true, agentId: 'fixture-agent' });
    log.mockRestore();
  });
});
