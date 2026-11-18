import { describe, expect, it } from 'vitest';
import { Command } from 'commander';
import { parseMemoryFreshness, registerMemoryCommands } from '../memory-cli.js';

describe('savestate memory list help', () => {
  it('documents the short summary alias', () => {
    const program = new Command();
    registerMemoryCommands(program);

    const memory = program.commands.find((command) => command.name() === 'memory');
    const help = memory?.commands.find((command) => command.name() === 'list')?.helpInformation();

    expect(help).toContain('--json-summary, --summary');
    expect(help).toContain('--summary is the short alias');
  });

  it('normalizes the hyphenated confirmation state for CLI users', () => {
    expect(parseMemoryFreshness(' needs-confirmation ')).toBe('needs_confirmation');
  });
});
