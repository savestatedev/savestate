import { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import {
  formatMcpExportJson,
  registerMCPCommands,
  type McpExportJson,
} from '../mcp.js';

const result: McpExportJson = {
  agent: 'my-agent',
  output: 'passport-my-agent.json',
  memories: 3,
  snapshots: 2,
  includeSnapshots: true,
  written: true,
};

describe('savestate mcp export --json', () => {
  it('registers --json on mcp export', () => {
    const program = new Command();
    registerMCPCommands(program);
    const exportCmd = program.commands
      .find((command) => command.name() === 'mcp')
      ?.commands.find((command) => command.name() === 'export');
    expect(exportCmd?.options.some((option) => option.long === '--json')).toBe(true);
  });

  it('prints export summary as JSON', () => {
    const parsed = JSON.parse(formatMcpExportJson(result)) as McpExportJson;
    expect(parsed).toEqual({
      agent: 'my-agent',
      output: 'passport-my-agent.json',
      memories: 3,
      snapshots: 2,
      includeSnapshots: true,
      written: true,
    });
  });

  it('records a write without snapshot metadata', () => {
    const parsed = JSON.parse(
      formatMcpExportJson({
        ...result,
        memories: 0,
        snapshots: 0,
        includeSnapshots: false,
      }),
    ) as McpExportJson;
    expect(parsed.memories).toBe(0);
    expect(parsed.snapshots).toBe(0);
    expect(parsed.includeSnapshots).toBe(false);
    expect(parsed.written).toBe(true);
  });
});
