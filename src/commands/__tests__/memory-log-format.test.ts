import { describe, expect, it } from 'vitest';
import { Command } from 'commander';
import {
  parseMemoryListFormat,
  registerMemoryCommands,
  resolveMemoryListFormat,
} from '../memory-cli.js';

describe('savestate memory log output format', () => {
  it('accepts the explicit summary format and keeps legacy flags compatible', () => {
    expect(parseMemoryListFormat(' pretty ')).toBe('table');
    expect(parseMemoryListFormat('summary')).toBe('json-summary');
    expect(resolveMemoryListFormat('json-summary', false, false, false)).toBe('json-summary');
    expect(resolveMemoryListFormat(undefined, false, true, false)).toBe('json-summary');
  });

  it('explains the pretty alias when an explicit format is invalid', () => {
    expect(() => parseMemoryListFormat('yaml')).toThrow(/table, pretty, json/);
  });

  it('documents explicit formats on memory log', () => {
    const program = new Command();
    registerMemoryCommands(program);
    const memory = program.commands.find((command) => command.name() === 'memory');
    const log = memory?.commands.find((command) => command.name() === 'log');

    expect(log?.helpInformation()).toContain('--format <format>');
    expect(log?.helpInformation()).toContain('--json-summary, --summary');
  });
});
