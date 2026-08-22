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

describe('savestate import excluded listed membership', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-excluded-listed-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(
    fileName: string,
    fields?: { components?: unknown; excluded?: unknown },
  ): Promise<string> {
    const passphrase = 'synthetic-passphrase';
    const plaintext = Buffer.from(JSON.stringify({
      agentId: 'fixture-agent',
      version: 1,
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
    }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      created: '2026-08-22T07:10:00.000Z',
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
    if (fields?.components !== undefined) {
      manifest.components = fields.components;
    }
    if (fields?.excluded !== undefined) {
      manifest.excluded = fields.excluded;
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

  it('rejects a container whose excluded list includes a listed component', async () => {
    const filePath = await writeContainer('overlap.savestate', {
      components: ['memory', 'tools'],
      excluded: ['memory'],
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat().join('\n')).toMatch(/excluded path is listed: memory/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    error.mockRestore();
    log.mockRestore();
  });

  it('imports a disjoint pair and still accepts older files missing either field', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const disjoint = await writeContainer('disjoint.savestate', {
      components: ['memory', 'tools'],
      excluded: ['personality'],
    });
    const componentsOnly = await writeContainer('components-only.savestate', {
      components: ['memory', 'tools'],
    });
    const excludedOnly = await writeContainer('excluded-only.savestate', {
      excluded: ['personality'],
    });
    const legacy = await writeContainer('legacy.savestate');
    const exported = join(testDir, 'exported.savestate');

    const valid = await importState({
      in: disjoint,
      passphrase: 'synthetic-passphrase',
    });
    const listed = await importState({
      in: componentsOnly,
      passphrase: 'synthetic-passphrase',
    });
    const omitted = await importState({
      in: excludedOnly,
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
      exclude: 'personality',
    });
    const fromExport = await importState({
      in: exported,
      passphrase: 'synthetic-passphrase',
    });

    expect(valid).toMatchObject({ restored: true, agentId: 'fixture-agent' });
    expect(listed).toMatchObject({ restored: true, agentId: 'fixture-agent' });
    expect(omitted).toMatchObject({ restored: true, agentId: 'fixture-agent' });
    expect(older).toMatchObject({ restored: true, agentId: 'fixture-agent' });
    expect(written.written).toBe(true);
    expect(fromExport).toMatchObject({ restored: true, agentId: 'fixture-agent' });
    log.mockRestore();
  });
});
