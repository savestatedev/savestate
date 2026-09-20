import { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import {
  registerContainerCommands,
  resolveBooleanIncludeFlags,
} from '../container.js';

describe('savestate container --include-conversation-history', () => {
  it('defaults to all paths when no boolean include flags are set', () => {
    expect(resolveBooleanIncludeFlags({})).toEqual({
      personality: true,
      memory: true,
      tools: true,
      preferences: true,
      conversation_history: true,
    });
  });

  it('omits conversation history when other boolean include flags are set', () => {
    expect(resolveBooleanIncludeFlags({ includeMemory: true })).toEqual({
      personality: false,
      memory: true,
      tools: false,
      preferences: false,
      conversation_history: false,
    });
  });

  it('packs conversation history when the flag is set', () => {
    expect(resolveBooleanIncludeFlags({ includeConversationHistory: true })).toEqual({
      personality: false,
      memory: false,
      tools: false,
      preferences: false,
      conversation_history: true,
    });
  });

  it('combines conversation history with other boolean include flags', () => {
    expect(
      resolveBooleanIncludeFlags({
        includeMemory: true,
        includeConversationHistory: true,
      }),
    ).toEqual({
      personality: false,
      memory: true,
      tools: false,
      preferences: false,
      conversation_history: true,
    });
  });

  it('registers --include-conversation-history on export commands', () => {
    const program = new Command();
    registerContainerCommands(program);
    const exportCmd = program.commands.find((command) => command.name() === 'export');
    const container = program.commands.find((command) => command.name() === 'container');
    const containerExport = container?.commands.find((command) => command.name() === 'export');
    expect(
      exportCmd?.options.some((option) => option.long === '--include-conversation-history'),
    ).toBe(true);
    expect(
      containerExport?.options.some((option) => option.long === '--include-conversation-history'),
    ).toBe(true);
  });
});
