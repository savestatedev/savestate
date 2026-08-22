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

describe('savestate import --target', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-target-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function createValidContainer(filePath: string, passphrase: string): Promise<string> {
    const agentState = {
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-08-17T23:03:00.000Z',
      personality: { name: 'fixture-agent' },
      memory: { facts: ['synthetic'] },
    };
    const plaintext = JSON.stringify(agentState);
    const encryptedState = await encrypt(Buffer.from(plaintext), { passphrase });
    const manifest = {
      formatVersion: 1,
      created: '2026-08-17T23:03:00.000Z',
      agentId: 'fixture-agent',
      payloads: [
        {
          name: 'agent_state',
          contentType: 'application/json',
          byteLength: Buffer.byteLength(plaintext),
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
    return plaintext;
  }

  it('registers --target on import commands', () => {
    const program = new Command();
    registerContainerCommands(program);
    const importCmd = program.commands.find((command) => command.name() === 'import');
    const containerImport = program.commands
      .find((command) => command.name() === 'container')
      ?.commands.find((command) => command.name() === 'import');
    expect(importCmd?.options.some((option) => option.long === '--target')).toBe(true);
    expect(containerImport?.options.some((option) => option.long === '--target')).toBe(true);
  });

  it('writes decrypted agent state to the target directory', async () => {
    const filePath = join(testDir, 'fixture.savestate');
    const targetDir = join(testDir, 'restored');
    const plaintext = await createValidContainer(filePath, 'synthetic-passphrase');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      target: targetDir,
    });

    const writtenPath = join(targetDir, 'agent_state.json');
    expect(result).toEqual({
      dryRun: false,
      restored: true,
      agentId: 'fixture-agent',
      mode: 'replace',
      created: '2026-08-17T23:03:00.000Z',
      components: ['personality', 'memory'],
      checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
      payloadBytes: expect.any(Number),
      target: writtenPath,
    });
    expect(await fs.readFile(writtenPath, 'utf-8')).toBe(plaintext);
    expect(log.mock.calls.flat().join('\n')).toContain(writtenPath);
    log.mockRestore();
  });

  it('keeps the current restore path when --target is omitted', async () => {
    const filePath = join(testDir, 'no-target.savestate');
    const strayDir = join(testDir, 'should-not-exist');
    await createValidContainer(filePath, 'synthetic-passphrase');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
    });

    expect(result).toEqual({
      dryRun: false,
      restored: true,
      agentId: 'fixture-agent',
      mode: 'replace',
      created: '2026-08-17T23:03:00.000Z',
      components: ['personality', 'memory'],
      checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
      payloadBytes: expect.any(Number),
    });
    await expect(fs.stat(strayDir)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(log.mock.calls.flat().join('\n')).toContain('Successfully restored');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Wrote agent state');
    log.mockRestore();
  });
});
