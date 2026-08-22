import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { applyImportInclude, importState, registerContainerCommands } from '../container.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate import --include', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-include-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function createValidContainer(filePath: string, passphrase: string): Promise<void> {
    const agentState = {
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-08-21T15:00:00.000Z',
      personality: { name: 'fixture-agent' },
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
    };
    const plaintext = Buffer.from(JSON.stringify(agentState));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest = {
      formatVersion: 1,
      created: '2026-08-21T15:00:00.000Z',
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

  it('registers --include on import commands', () => {
    const program = new Command();
    registerContainerCommands(program);
    const importCmd = program.commands.find((command) => command.name() === 'import');
    const containerImport = program.commands
      .find((command) => command.name() === 'container')
      ?.commands.find((command) => command.name() === 'import');
    expect(importCmd?.options.some((option) => option.long === '--include')).toBe(true);
    expect(containerImport?.options.some((option) => option.long === '--include')).toBe(true);
  });

  it('rejects an unknown include path before restoring', async () => {
    const filePath = join(testDir, 'unknown-include.savestate');
    await createValidContainer(filePath, 'synthetic-passphrase');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(applyImportInclude({ memory: { facts: [] } }, 'secrets')).toEqual({
      error:
        'Error: Unknown include path: secrets. Allowed: personality, memory, tools, preferences, conversation_history.',
    });

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      include: 'secrets',
    });

    expect(result).toBeUndefined();
    expect(error.mock.calls.flat().join('\n')).toMatch(/unknown include path/i);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Successfully restored');
    expect(log.mock.calls.flat().join('\n')).not.toContain('Decrypting agent state');
    error.mockRestore();
    log.mockRestore();
  });

  it('restores only selected components to the target directory', async () => {
    const filePath = join(testDir, 'include-memory.savestate');
    const targetDir = join(testDir, 'restored');
    await createValidContainer(filePath, 'synthetic-passphrase');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      include: 'memory',
      target: targetDir,
    });

    const writtenPath = join(targetDir, 'agent_state.json');
    const written = JSON.parse(await fs.readFile(writtenPath, 'utf-8')) as Record<string, unknown>;

    expect(result).toEqual({
      dryRun: false,
      restored: true,
      agentId: 'fixture-agent',
      mode: 'replace',
      created: '2026-08-21T15:00:00.000Z',
      components: ['memory'],
      checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
      payloadBytes: expect.any(Number),
      target: writtenPath,
    });
    expect(log.mock.calls.flat()).toContain('Including paths: memory');
    expect(written).toHaveProperty('memory');
    expect(written).toHaveProperty('agentId', 'fixture-agent');
    expect(written).not.toHaveProperty('personality');
    expect(written).not.toHaveProperty('tools');
    log.mockRestore();
  });
});
