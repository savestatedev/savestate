import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { exportState, formatImportDescription, importState } from '../container.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate import description output', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-description-output-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(fileName: string, description?: unknown): Promise<string> {
    const passphrase = 'synthetic-passphrase';
    const plaintext = Buffer.from(JSON.stringify({
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-08-22T12:00:00.000Z',
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
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
    if (description !== undefined) {
      manifest.description = description;
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

  it('formats a description on its own line', () => {
    expect(formatImportDescription('Labeled export')).toBe('  Description: Labeled export');
    expect(formatImportDescription('Labeled export')).not.toContain('Agent:');
  });

  it('returns and prints the description when the manifest has one', async () => {
    const filePath = await writeContainer('with-description.savestate', 'Labeled import fixture');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toMatchObject({
      restored: true,
      agentId: 'fixture-agent',
      description: 'Labeled import fixture',
    });
    expect(log.mock.calls.flat()).toContain('  Description: Labeled import fixture');
    log.mockRestore();
  });

  it('prints the description on dry-run and omits it when the archive has none', async () => {
    const withDescription = await writeContainer('dry-run-description.savestate', 'Dry-run labeled');
    const withoutDescription = await writeContainer('no-description.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const preview = await importState({
      in: withDescription,
      passphrase: 'synthetic-passphrase',
      dryRun: true,
    });
    const older = await importState({
      in: withoutDescription,
      passphrase: 'synthetic-passphrase',
    });
    const exported = join(testDir, 'exported.savestate');
    await exportState({
      agent: 'fixture-agent',
      out: exported,
      passphrase: 'synthetic-passphrase',
      description: 'Exported labeled archive',
    });
    const fromExport = await importState({
      in: exported,
      passphrase: 'synthetic-passphrase',
    });

    expect(preview).toMatchObject({
      dryRun: true,
      restored: false,
      description: 'Dry-run labeled',
    });
    expect(older?.description).toBeUndefined();
    expect(fromExport).toMatchObject({ description: 'Exported labeled archive' });
    expect(log.mock.calls.flat()).toContain('  Description: Dry-run labeled');
    expect(log.mock.calls.flat()).toContain('  Description: Exported labeled archive');
    log.mockRestore();
  });

  it('does not invent a description from whitespace', async () => {
    const filePath = await writeContainer('blank-description.savestate', '   ');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result?.description).toBeUndefined();
    expect(log.mock.calls.flat().some((line) => typeof line === 'string' && line.startsWith('  Description:'))).toBe(false);
    log.mockRestore();
  });
});
