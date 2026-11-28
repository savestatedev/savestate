import { describe, expect, it } from 'vitest';
import { Command } from 'commander';
import {
  parseMemoryFreshness,
  parseMemoryListFormat,
  registerMemoryCommands,
  resolveMemoryListFormat,
} from '../memory-cli.js';

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
    expect(help).toContain('--format <format>');
    expect(help).toContain('pretty (alias for table)');
    expect(help).toContain('--metadata-only');
    expect(help).toContain('--tag <tag>');
    expect(help).toContain('-f, --freshness <state>');
    expect(help).toContain('--summary is the short alias');
    expect(help).toContain('needs_confirmation/needs-confirmation');
    expect(renderedHelp).toContain('--since 2026-01-01 --until 2026-01-31');
    expect(renderedHelp).toContain('--namespace org:app:agent --json-summary');
    expect(renderedHelp).toContain('--unassigned --summary');
    expect(renderedHelp).toContain('--content "preferred editor" --json-summary');
    expect(renderedHelp).toContain('--freshness needs-confirmation --json-summary');
    expect(renderedHelp).toContain('--page 2 --page-size 20');
    expect(renderedHelp).toContain('--limit 20 --offset 20');
  });

  it('documents metadata-only explain output', () => {
    const program = new Command();
    registerMemoryCommands(program);
    const memory = program.commands.find((command) => command.name() === 'memory');
    const help = memory?.commands.find((command) => command.name() === 'explain')?.helpInformation();
    let renderedHelp = '';
    program.exitOverride();
    program.configureOutput({ writeOut: (value) => { renderedHelp += value; } });
    expect(() => program.parse(['node', 'savestate', 'memory', 'explain', '--help'])).toThrow();

    expect(help).toContain('--metadata-only');
    expect(help).toContain('--format <format>');
    expect(help).toContain('pretty (alias for table)');
    expect(help).toMatch(/without retrieval\s+details/);
    expect(renderedHelp).toContain('--content "VS Code" --json-summary');
  });

  it('documents audit-log filters and summary output', () => {
    const program = new Command();
    registerMemoryCommands(program);
    let renderedHelp = '';
    program.exitOverride();
    program.configureOutput({ writeOut: (value) => { renderedHelp += value; } });
    expect(() => program.parse(['node', 'savestate', 'memory', 'log', '--help'])).toThrow();

    expect(renderedHelp).toContain('savestate memory log <memory-id> --action edited');
    expect(renderedHelp).toContain('--action edited,rolled_back --json');
    expect(renderedHelp).toContain('--actor <id>');
    expect(renderedHelp).toContain('--actor agent --since 2026-01-01');
    expect(renderedHelp).toContain('savestate memory log <memory-id> --since 2026-01-01 --until 2026-01-31');
    expect(renderedHelp).toContain('savestate memory log <memory-id> --page 2 --page-size 20');
    expect(renderedHelp).toContain('savestate memory log <memory-id> --limit 20 --offset 20');
    expect(renderedHelp).toContain('savestate memory log <memory-id> --summary');
  });

  it('accepts the explicit output format on explain', () => {
    const program = new Command();
    registerMemoryCommands(program);
    const memory = program.commands.find((command) => command.name() === 'memory');
    const explain = memory?.commands.find((command) => command.name() === 'explain');
    expect(explain?.options.some((option) => option.long === '--format')).toBe(true);
    expect(parseMemoryListFormat(' json-summary ')).toBe('json-summary');
  });

  it('normalizes the hyphenated confirmation state for CLI users', () => {
    expect(parseMemoryFreshness(' needs-confirmation ')).toBe('needs_confirmation');
  });

  it('explains the accepted hyphenated spelling for invalid values', () => {
    expect(() => parseMemoryFreshness('unknown')).toThrow('needs-confirmation is also accepted');
  });

  it('parses explicit output formats and preserves legacy flags', () => {
    expect(parseMemoryListFormat(' JSON-SUMMARY ')).toBe('json-summary');
    expect(parseMemoryListFormat(' Summary ')).toBe('json-summary');
    expect(resolveMemoryListFormat(undefined, true, false, false)).toBe('json');
    expect(resolveMemoryListFormat(undefined, false, true, false)).toBe('json-summary');
    expect(resolveMemoryListFormat('table', false, false, false)).toBe('table');
  });

  it('rejects invalid or contradictory output formats', () => {
    expect(() => parseMemoryListFormat('yaml')).toThrow(
      'Expected one of table, json, json-summary, or summary.',
    );
    expect(() => resolveMemoryListFormat('table', true, false, false)).toThrow(
      'Cannot combine --format table with legacy JSON output flags.',
    );
  });

  it('normalizes the hyphenated confirmation state for CLI users', () => {
    expect(parseMemoryFreshness(' needs-confirmation ')).toBe('needs_confirmation');
  });
});
