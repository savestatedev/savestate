import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { importState, registerContainerCommands } from '../container.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate import --dry-run', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-dry-run-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function createValidContainer(filePath: string, passphrase: string): Promise<void> {
    const agentState = {
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-08-17T21:08:00.000Z',
      personality: { name: 'fixture-agent' },
      memory: { facts: ['synthetic'] },
    };
    const plaintext = Buffer.from(JSON.stringify(agentState));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest = {
      formatVersion: 1,
      created: '2026-08-17T21:08:00.000Z',
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

  it('registers --dry-run on import commands', () => {
    const program = new Command();
    registerContainerCommands(program);
    const importCmd = program.commands.find((command) => command.name() === 'import');
    const containerImport = program.commands
      .find((command) => command.name() === 'container')
      ?.commands.find((command) => command.name() === 'import');
    expect(importCmd?.options.some((option) => option.long === '--dry-run')).toBe(true);
    expect(containerImport?.options.some((option) => option.long === '--dry-run')).toBe(true);
  });

  it('decrypts and previews without restoring', async () => {
    const filePath = join(testDir, 'fixture.savestate');
    await createValidContainer(filePath, 'synthetic-passphrase');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      dryRun: true,
    });

    expect(result).toEqual({
      dryRun: true,
      restored: false,
      agentId: 'fixture-agent',
      mode: 'replace',
      created: '2026-08-17T21:08:00.000Z',
      components: ['personality', 'memory'],
      checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(log.mock.calls.flat().join('\n')).toContain('DRY RUN');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Replacing state');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    log.mockRestore();
  });
});
