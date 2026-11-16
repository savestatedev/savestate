import { describe, expect, it } from 'vitest';
import { Command } from 'commander';
import { registerMemoryCommands } from '../memory-cli.js';

describe('savestate memory list help', () => {
  it('documents the short summary alias', () => {
    const program = new Command();
    registerMemoryCommands(program);

    const memory = program.commands.find((command) => command.name() === 'memory');
    const help = memory?.commands.find((command) => command.name() === 'list')?.helpInformation();

    expect(help).toContain('--json-summary, --summary');
  });
});
