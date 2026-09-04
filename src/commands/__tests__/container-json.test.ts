import { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import { formatExportResultJson, formatImportResultJson, registerContainerCommands } from '../container.js';

const exportResult = {
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
  written: false,
  overwritten: false,
  dryRun: true,
};

const importResult = {
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
  target: './restored/agent_state.json',
  mode: 'replace' as const,
  restored: false,
  dryRun: true,
};

describe('savestate container --json', () => {
  it('registers --json on container export and import', () => {
    const program = new Command();
    registerContainerCommands(program);
    const containerCmd = program.commands.find((command) => command.name() === 'container');
    const containerExport = containerCmd?.commands.find((command) => command.name() === 'export');
    const containerImport = containerCmd?.commands.find((command) => command.name() === 'import');
    expect(containerExport?.options.some((option) => option.long === '--json')).toBe(true);
    expect(containerImport?.options.some((option) => option.long === '--json')).toBe(true);
  });

  it('prints container export metadata as JSON', () => {
    const parsed = JSON.parse(formatExportResultJson(exportResult)) as {
      agent: string;
      output: string;
      written: boolean;
      dryRun: boolean;
    };
    expect(parsed.agent).toBe('fixture-agent');
    expect(parsed.output).toBe('agent.savestate');
    expect(parsed.written).toBe(false);
    expect(parsed.dryRun).toBe(true);
  });

  it('prints container import metadata as JSON', () => {
    const parsed = JSON.parse(formatImportResultJson(importResult)) as {
      agent: string;
      input: string;
      target: string | null;
      restored: boolean;
      dryRun: boolean;
    };
    expect(parsed.agent).toBe('fixture-agent');
    expect(parsed.input).toBe('agent.savestate');
    expect(parsed.target).toBe('./restored/agent_state.json');
    expect(parsed.restored).toBe(false);
    expect(parsed.dryRun).toBe(true);
  });
});
