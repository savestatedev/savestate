import { describe, expect, it } from 'vitest';
import { parseMemoryNamespace, validateMemoryNamespaceFilters } from '../memory-cli.js';
import { filterMemoryListByUnassignedNamespace } from '../memory.js';

describe('savestate memory --namespace', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryNamespace(undefined)).toBeUndefined();
  });

  it('accepts a single namespace', () => {
    expect(parseMemoryNamespace('org:app:agent')).toBe('org:app:agent');
    expect(parseMemoryNamespace('org:app:agent:user')).toBe('org:app:agent:user');
    expect(parseMemoryNamespace(' org:app:agent ')).toBe('org:app:agent');
  });

  it.each([
    '',
    ' ',
    ',',
    'org:app:agent,other',
    'org app:agent',
    'org:app',
    'org::agent',
    'org:app:agent:user:extra',
  ])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseMemoryNamespace(value)).toThrow(
        `Invalid --namespace value "${value}". Expected a single non-empty namespace (org:app:agent[:user]).`,
      );
    },
  );
});

describe('savestate memory --unassigned', () => {
  it('keeps missing and blank namespaces while excluding assigned entries', () => {
    const entries = [
      { id: 'missing', content: 'a', source: 'test', createdAt: '2026-10-01T00:00:00.000Z' },
      { id: 'blank', content: 'b', source: 'test', createdAt: '2026-10-01T00:00:00.000Z', metadata: { namespace: '  ' } },
      { id: 'assigned', content: 'c', source: 'test', createdAt: '2026-10-01T00:00:00.000Z', metadata: { namespace: 'org:app:agent' } },
    ];

    expect(filterMemoryListByUnassignedNamespace(entries, true).map(({ id }) => id)).toEqual(['missing', 'blank']);
    expect(filterMemoryListByUnassignedNamespace(entries)).toBe(entries);
  });

  it('rejects combining an explicit namespace with --unassigned', () => {
    expect(() => validateMemoryNamespaceFilters('org:app:agent', true)).toThrow(
      'The --namespace and --unassigned options cannot be used together.',
    );
  });
});
