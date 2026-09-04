import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState, formatExportResultJson, registerContainerCommands } from '../container.js';

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
  output: 'agent.savestate',
  written: true,
  overwritten: false,
  dryRun: false,
};

describe('savestate export --json', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-json-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('registers --json on export commands', () => {
    const program = new Command();
    registerContainerCommands(program);
    const exportCmd = program.commands.find((command) => command.name() === 'export');
    const containerExport = program.commands
      .find((command) => command.name() === 'container')
      ?.commands.find((command) => command.name() === 'export');
    expect(exportCmd?.options.some((option) => option.long === '--json')).toBe(true);
    expect(containerExport?.options.some((option) => option.long === '--json')).toBe(true);
  });

  it('prints export metadata as JSON', () => {
    const parsed = JSON.parse(formatExportResultJson(result)) as {
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
      output: string;
      written: boolean;
      overwritten: boolean;
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
    expect(parsed.output).toBe('agent.savestate');
    expect(parsed.written).toBe(true);
    expect(parsed.overwritten).toBe(false);
    expect(parsed.dryRun).toBe(false);
  });

  it('records a missing description and a dry-run', () => {
    const parsed = JSON.parse(
      formatExportResultJson({
        ...result,
        description: undefined,
        excluded: [],
        written: false,
        dryRun: true,
      }),
    ) as { description: string | null; excluded: string[] | null; written: boolean; dryRun: boolean };
    expect(parsed.description).toBeNull();
    expect(parsed.excluded).toBeNull();
    expect(parsed.written).toBe(false);
    expect(parsed.dryRun).toBe(true);
  });

  it('emits JSON and skips progress when exporting', async () => {
    const filePath = join(testDir, 'json.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exported = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
      json: true,
    });

    const printed = log.mock.calls.flat().join('\n');
    const parsed = JSON.parse(printed) as { agent: string; written: boolean; dryRun: boolean; output: string };
    expect(exported).toEqual({ written: true, out: filePath, overwritten: false });
    expect(parsed.agent).toBe('fixture-agent');
    expect(parsed.written).toBe(true);
    expect(parsed.dryRun).toBe(false);
    expect(parsed.output).toBe(filePath);
    expect(printed).not.toContain('Successfully exported');
    expect(printed).not.toContain('  Agent:');
    log.mockRestore();
  });
});
