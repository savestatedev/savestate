import { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import {
  formatMcpImportJson,
  registerMCPCommands,
  type McpImportJson,
} from '../mcp.js';

const result: McpImportJson = {
  input: 'passport.json',
  sourceAgent: 'my-agent',
  targetAgent: 'other-agent',
  importedMemories: 3,
  totalMemories: 4,
  snapshots: 2,
  merge: true,
};

describe('savestate mcp import --json', () => {
  it('registers --json on mcp import', () => {
    const program = new Command();
    registerMCPCommands(program);
    const importCmd = program.commands
      .find((command) => command.name() === 'mcp')
      ?.commands.find((command) => command.name() === 'import');
    expect(importCmd?.options.some((option) => option.long === '--json')).toBe(true);
  });

  it('prints import summary as JSON', () => {
    const parsed = JSON.parse(formatMcpImportJson(result)) as McpImportJson;
    expect(parsed).toEqual({
      input: 'passport.json',
      sourceAgent: 'my-agent',
      targetAgent: 'other-agent',
      importedMemories: 3,
      totalMemories: 4,
      snapshots: 2,
      merge: true,
    });
  });

  it('records a replace import with no memories', () => {
    const parsed = JSON.parse(
      formatMcpImportJson({
        ...result,
        importedMemories: 0,
        totalMemories: 0,
        snapshots: 0,
        merge: false,
      }),
    ) as McpImportJson;
    expect(parsed.importedMemories).toBe(0);
    expect(parsed.totalMemories).toBe(0);
    expect(parsed.snapshots).toBe(0);
    expect(parsed.merge).toBe(false);
    expect(parsed.targetAgent).toBe('other-agent');
  });
});
