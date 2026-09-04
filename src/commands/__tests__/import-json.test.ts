import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { formatImportResultJson, importState, registerContainerCommands } from '../container.js';

const result = {
  agent: 'fixture-agent',
  formatVersion: 1,
  created: '2026-01-26T09:30:00.000Z',
  checksum: 'abc123',
  size: 4096,
  payloadName: 'agent_state',
  contentType: 'application/json',
  description: 'pre-update',
  components: ['personality', 'memory'],
  encryption: 'AES-256-GCM',
  keyDerivation: 'Argon2id',
  excluded: ['tools'],
  input: 'agent.savestate',
  target: '/tmp/restored/agent_state.json',
  mode: 'replace' as const,
  restored: true,
  dryRun: false,
};

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate import --json', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-import-json-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function createValidContainer(filePath: string, passphrase: string): Promise<void> {
    const agentState = {
      agentId: 'fixture-agent',
      version: 1,
      exportedAt: '2026-01-26T09:30:00.000Z',
      personality: { name: 'fixture-agent' },
      memory: { facts: ['synthetic'] },
    };
    const plaintext = Buffer.from(JSON.stringify(agentState));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest = {
      formatVersion: 1,
      created: '2026-01-26T09:30:00.000Z',
      agentId: 'fixture-agent',
      description: 'pre-update',
      encryption: {
        algorithm: 'AES-256-GCM',
        keyDerivation: 'Argon2id',
      },
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

  it('registers --json on import commands', () => {
    const program = new Command();
    registerContainerCommands(program);
    const importCmd = program.commands.find((command) => command.name() === 'import');
    const containerImport = program.commands
      .find((command) => command.name() === 'container')
      ?.commands.find((command) => command.name() === 'import');
    expect(importCmd?.options.some((option) => option.long === '--json')).toBe(true);
    expect(containerImport?.options.some((option) => option.long === '--json')).toBe(true);
  });

  it('prints import metadata as JSON', () => {
    const parsed = JSON.parse(formatImportResultJson(result)) as {
      agent: string;
      formatVersion: number;
      created: string;
      checksum: string;
      size: number;
      payloadName: string;
      contentType: string;
      description: string | null;
      components: string[];
      encryption: string;
      keyDerivation: string;
      excluded: string[] | null;
      input: string;
      target: string | null;
      mode: string;
      restored: boolean;
      dryRun: boolean;
    };
    expect(parsed.agent).toBe('fixture-agent');
    expect(parsed.formatVersion).toBe(1);
    expect(parsed.created).toBe('2026-01-26T09:30:00.000Z');
    expect(parsed.checksum).toBe('abc123');
    expect(parsed.size).toBe(4096);
    expect(parsed.payloadName).toBe('agent_state');
    expect(parsed.contentType).toBe('application/json');
    expect(parsed.description).toBe('pre-update');
    expect(parsed.components).toEqual(['personality', 'memory']);
    expect(parsed.encryption).toBe('AES-256-GCM');
    expect(parsed.keyDerivation).toBe('Argon2id');
    expect(parsed.excluded).toEqual(['tools']);
    expect(parsed.input).toBe('agent.savestate');
    expect(parsed.target).toBe('/tmp/restored/agent_state.json');
    expect(parsed.mode).toBe('replace');
    expect(parsed.restored).toBe(true);
    expect(parsed.dryRun).toBe(false);
  });

  it('records a missing description and a dry-run', () => {
    const parsed = JSON.parse(
      formatImportResultJson({
        ...result,
        description: undefined,
        excluded: [],
        target: undefined,
        restored: false,
        dryRun: true,
      }),
    ) as {
      description: string | null;
      excluded: string[] | null;
      target: string | null;
      restored: boolean;
      dryRun: boolean;
    };
    expect(parsed.description).toBeNull();
    expect(parsed.excluded).toBeNull();
    expect(parsed.target).toBeNull();
    expect(parsed.restored).toBe(false);
    expect(parsed.dryRun).toBe(true);
  });

  it('emits JSON and skips progress when importing', async () => {
    const filePath = join(testDir, 'json.savestate');
    await createValidContainer(filePath, 'synthetic-passphrase');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const imported = await importState({
      in: filePath,
      passphrase: 'synthetic-passphrase',
      json: true,
      dryRun: true,
    });

    const printed = log.mock.calls.flat().join('\n');
    const parsed = JSON.parse(printed) as {
      agent: string;
      restored: boolean;
      dryRun: boolean;
      input: string;
    };
    expect(imported).toMatchObject({
      agentId: 'fixture-agent',
      restored: false,
      dryRun: true,
    });
    expect(parsed.agent).toBe('fixture-agent');
    expect(parsed.restored).toBe(false);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.input).toBe(filePath);
    expect(printed).not.toContain('Successfully restored');
    expect(printed).not.toContain('DRY RUN');
    expect(printed).not.toContain('  Agent:');
    expect(printed).not.toContain('Decrypting agent state');
    log.mockRestore();
  });
});
