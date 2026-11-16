import { describe, expect, it } from 'vitest';
import { Command } from 'commander';
import { registerMemoryCommands } from '../memory-cli.js';

describe('savestate memory list help', () => {
  it('documents the short summary alias', () => {
    const program = new Command();
    registerMemoryCommands(program);

    const help = program.commands.find((command) => command.name() === 'memory')
      ?.commands.find((command) => command.name() === 'list')
      ?.helpInformation();

    expect(help).toContain('--json-summary, --summary');
  });
});
