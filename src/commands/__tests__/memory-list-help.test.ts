import { describe, expect, it } from 'vitest';
import { Command } from 'commander';
import { parseMemoryFreshness, registerMemoryCommands } from '../memory-cli.js';

describe('savestate memory list help', () => {
  it('documents the short summary alias', () => {
    const program = new Command();
    registerMemoryCommands(program);

    const memory = program.commands.find((command) => command.name() === 'memory');
    const help = memory?.commands.find((command) => command.name() === 'list')?.helpInformation();
    let renderedHelp = '';
    program.exitOverride();
    program.configureOutput({ writeOut: (value) => { renderedHelp += value; } });
    expect(() => program.parse(['node', 'savestate', 'memory', 'list', '--help'])).toThrow();

    expect(help).toContain('--json-summary, --summary');
    expect(help).toContain('--tag <tag>');
    expect(help).toContain('-f, --freshness <state>');
    expect(help).toContain('--summary is the short alias');
    expect(help).toContain('needs_confirmation/needs-confirmation');
    expect(renderedHelp).toContain('--since 2026-01-01 --until 2026-01-31');
    expect(renderedHelp).toContain('--namespace org:app:agent --json-summary');
    expect(renderedHelp).toContain('--unassigned --summary');
  });

  it('normalizes the hyphenated confirmation state for CLI users', () => {
    expect(parseMemoryFreshness(' needs-confirmation ')).toBe('needs_confirmation');
  });

  it('explains the accepted hyphenated spelling for invalid values', () => {
    expect(() => parseMemoryFreshness('unknown')).toThrow('needs-confirmation is also accepted');
  });

  it('normalizes the hyphenated confirmation state for CLI users', () => {
    expect(parseMemoryFreshness(' needs-confirmation ')).toBe('needs_confirmation');
  });
});
