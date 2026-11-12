import { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import { registerContainerCommands, resolveContainerImportInput } from '../container.js';

describe('savestate container import help', () => {
  it('documents the --input alias for the required archive path', () => {
    const program = new Command();
    registerContainerCommands(program);

    const container = program.commands.find((command) => command.name() === 'container');
    const importCommand = container?.commands.find((command) => command.name() === 'import');

    expect(importCommand).toBeDefined();
    expect(importCommand?.options.find((option) => option.long === '--in')?.short).toBe('-i');
    expect(importCommand?.options.find((option) => option.long === '--input')).toBeDefined();
    expect(importCommand?.helpInformation()).toContain('--input');
  });

  it('rejects conflicting values when both input flags are provided', () => {
    expect(resolveContainerImportInput('state.savestate', 'state.savestate')).toBe('state.savestate');
    expect(resolveContainerImportInput(undefined, 'state.savestate')).toBe('state.savestate');
    expect(() => resolveContainerImportInput('one.savestate', 'two.savestate')).toThrow(
      '--in and --input must match',
    );
  });
});
