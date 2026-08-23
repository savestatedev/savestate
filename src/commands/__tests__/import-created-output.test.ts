import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { exportState, formatImportCreated, importState } from '../container.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate import created output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-created-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(fileName: string, created = '2026-08-23T07:00:00.000Z'): Promise<string> {
    const passphrase = 'synthetic-passphrase';
    const plaintext = Buffer.from(JSON.stringify({
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: created,
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
    }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      created,
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
    const filePath = join(testDir, fileName);
    await fs.writeFile(
      filePath,
      Buffer.concat([createMagicHeader(1), manifestLength, manifestBuffer, encryptedState]),
    );
    return filePath;
  }

  it('formats the created timestamp on its own line', () => {
    expect(formatImportCreated('2026-08-23T07:00:00.000Z')).toBe('  Created: 2026-08-23T07:00:00.000Z');
    expect(formatImportCreated('2026-08-23T07:00:00.000Z')).not.toContain('Agent:');
  });

  it('returns and prints the created timestamp on a successful import', async () => {
    const created = '2026-08-23T07:00:00.000Z';
    const filePath = await writeContainer('with-created.savestate', created);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toMatchObject({
      restored: true,
      agentId: 'fixture-agent',
      created,
    });
    expect(log.mock.calls.flat()).toContain(`  Created: ${created}`);
    log.mockRestore();
  });

  it('prints the created timestamp on dry-run and after a real export', async () => {
    const created = '2026-08-23T07:00:00.000Z';
    const packed = await writeContainer('dry-run-created.savestate', created);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const preview = await importState({
      in: packed,
      passphrase: 'synthetic-passphrase',
      dryRun: true,
    });
    const exported = join(testDir, 'exported.savestate');
    await exportState({
      agent: 'fixture-agent',
      out: exported,
      passphrase: 'synthetic-passphrase',
    });
    const fromExport = await importState({
      in: exported,
      passphrase: 'synthetic-passphrase',
    });

    expect(preview).toMatchObject({
      dryRun: true,
      restored: false,
      created,
    });
    expect(fromExport?.created).toEqual(expect.any(String));
    expect(fromExport!.created.length).toBeGreaterThan(0);
    expect(log.mock.calls.flat()).toContain(`  Created: ${created}`);
    expect(log.mock.calls.flat()).toContain(`  Created: ${fromExport!.created}`);
    log.mockRestore();
  });

  it('omits a created timestamp when import does not restore', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await importState({
      in: '',
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toBeUndefined();
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.startsWith('  Created: '))).toBe(false);
    error.mockRestore();
    log.mockRestore();
  });
});
