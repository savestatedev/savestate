import { describe, expect, it } from 'vitest';
import {
  parseMemoryMaxImportance,
  parseMemoryMinImportance,
  validateMemoryImportanceRange,
} from '../memory-cli.js';
import {
  filterMemoryListByImportance,
  formatMemoryListImportance,
  formatMemoryListJson,
  getMemoryListImportance,
} from '../memory.js';

describe('savestate memory list --min-importance', () => {
  it('accepts bounded scores and rejects malformed values', () => {
    expect(parseMemoryMinImportance(' 0.8 ')).toBe(0.8);
    expect(parseMemoryMinImportance('1')).toBe(1);
    expect(parseMemoryMinImportance(undefined)).toBeUndefined();
    expect(() => parseMemoryMinImportance('1.1')).toThrow(
      'Invalid --min-importance value "1.1". Expected a number between 0 and 1.',
    );
    expect(parseMemoryMaxImportance(' 0.8 ')).toBe(0.8);
    expect(() => parseMemoryMaxImportance('-0.1')).toThrow(
      'Invalid --max-importance value "-0.1". Expected a number between 0 and 1.',
    );
  });

  it('uses the existing 0.5 default for missing or invalid metadata', () => {
    const entries = [
      { id: 'high', content: 'high', source: 'test', createdAt: '2026-10-01T00:00:00.000Z', metadata: { importance: 0.9 } },
      { id: 'default', content: 'default', source: 'test', createdAt: '2026-10-01T00:00:00.000Z' },
      { id: 'invalid', content: 'invalid', source: 'test', createdAt: '2026-10-01T00:00:00.000Z', metadata: { importance: 'high' } },
    ];

    expect(filterMemoryListByImportance(entries, 0.8).map(({ id }) => id)).toEqual(['high']);
    expect(filterMemoryListByImportance(entries, 0.5).map(({ id }) => id)).toEqual(['high', 'default', 'invalid']);
    expect(filterMemoryListByImportance(entries, undefined, 0.5).map(({ id }) => id)).toEqual(['default', 'invalid']);
    expect(filterMemoryListByImportance(entries)).toBe(entries);
  });

  it('exposes the effective score in JSON and table-friendly output', () => {
    const entries = [
      { id: 'high', content: 'high', source: 'test', createdAt: '2026-10-01T00:00:00.000Z', metadata: { importance: 0.9 } },
      { id: 'default', content: 'default', source: 'test', createdAt: '2026-10-01T00:00:00.000Z' },
    ];

    expect(getMemoryListImportance(entries[0])).toBe(0.9);
    expect(getMemoryListImportance(entries[1])).toBe(0.5);
    expect(getMemoryListImportance({
      ...entries[1],
      metadata: { importance: 2 },
    })).toBe(0.5);
    expect(formatMemoryListImportance(entries[0])).toBe('0.90');
    expect(formatMemoryListImportance(entries[1])).toBe('0.50');

    const parsed = JSON.parse(formatMemoryListJson(entries, entries)) as {
      entries: Array<{ id: string; importance: number }>;
    };
    expect(parsed.entries.map(({ id, importance }) => ({ id, importance }))).toEqual([
      { id: 'high', importance: 0.9 },
      { id: 'default', importance: 0.5 },
    ]);
  });

  it('preserves the active threshold for JSON consumers', () => {
    const entries = [{ id: 'high', content: 'high', source: 'test', createdAt: '2026-10-01T00:00:00.000Z' }];
    const parsed = JSON.parse(formatMemoryListJson(entries, entries, {
      filters: { minImportance: 0.8 },
    })) as { filters: { minImportance?: number } };

    expect(parsed.filters.minImportance).toBe(0.8);
  });

  it('preserves the upper threshold for JSON consumers', () => {
    const entries = [{ id: 'default', content: 'default', source: 'test', createdAt: '2026-10-01T00:00:00.000Z' }];
    const parsed = JSON.parse(formatMemoryListJson(entries, entries, {
      filters: { maxImportance: 0.5 },
    })) as { filters: { maxImportance?: number } };

    expect(parsed.filters.maxImportance).toBe(0.5);
  });
});

describe('savestate memory explain importance filters', () => {
  it('accepts the same bounded score syntax as memory list', () => {
    expect(parseMemoryMinImportance('0.8')).toBe(0.8);
    expect(parseMemoryMaxImportance('1.0')).toBe(1);
  });

  it('rejects an inverted importance range before storage access', () => {
    expect(() => validateMemoryImportanceRange(0.9, 0.2)).toThrow(
      'Invalid memory importance range: --min-importance (0.9) must be at or below --max-importance (0.2).',
    );
    expect(() => validateMemoryImportanceRange(0.2, 0.9)).not.toThrow();
    expect(() => validateMemoryImportanceRange(undefined, 0.9)).not.toThrow();
  });
});
