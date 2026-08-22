import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { exportState, formatImportComponents, importState } from '../container.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate import components output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-components-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(fileName: string, state: Record<string, unknown>): Promise<string> {
    const passphrase = 'synthetic-passphrase';
    const plaintext = Buffer.from(JSON.stringify({
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-08-22T12:00:00.000Z',
      ...state,
    }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      created: '2026-08-22T12:00:00.000Z',
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

  it('formats restored components on their own line', () => {
    expect(formatImportComponents(['memory'])).toBe('  Components: memory');
    expect(formatImportComponents(['memory', 'tools'])).toBe('  Components: memory, tools');
    expect(formatImportComponents([])).toBe('  Components: none');
    expect(formatImportComponents(['memory'])).not.toContain('Agent:');
  });

  it('returns and prints restored components on a successful import', async () => {
    const filePath = await writeContainer('with-components.savestate', {
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toMatchObject({
      restored: true,
      agentId: 'fixture-agent',
      components: ['memory', 'tools'],
    });
    expect(log.mock.calls.flat()).toContain('  Components: memory, tools');
    log.mockRestore();
  });

  it('prints components on dry-run and after a real export', async () => {
    const packed = await writeContainer('dry-run-components.savestate', {
      memory: { facts: ['synthetic'] },
    });
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
      include: 'memory,tools',
    });
    const fromExport = await importState({
      in: exported,
      passphrase: 'synthetic-passphrase',
    });

    expect(preview).toMatchObject({
      dryRun: true,
      restored: false,
      components: ['memory'],
    });
    expect(fromExport).toMatchObject({ components: ['memory', 'tools'] });
    expect(log.mock.calls.flat()).toContain('  Components: memory');
    expect(log.mock.calls.flat()).toContain('  Components: memory, tools');
    log.mockRestore();
  });
});
