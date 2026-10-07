import { describe, expect, it } from 'vitest';
import {
  parseIdentitySchemaLimit,
  parseIdentitySchemaOffset,
  formatIdentitySchemaJson,
  selectIdentitySchemaOffsetProperties,
  selectIdentitySchemaProperties,
} from '../identity.js';

describe('savestate identity schema --limit', () => {
  it('defaults to undefined', () => {
    expect(parseIdentitySchemaLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseIdentitySchemaLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseIdentitySchemaLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseIdentitySchemaLimit('1000')).toBe(1000);
    expect(() => parseIdentitySchemaLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N identity schema properties', () => {
    expect(
      selectIdentitySchemaProperties(
        [{ name: 'name' }, { name: 'tools' }, { name: 'goals' }],
        2,
      ).map((property) => property.name),
    ).toEqual(['name', 'tools']);
  });

  it('returns all properties when --limit is omitted', () => {
    const properties = [{ name: 'name' }, { name: 'tools' }];
    expect(selectIdentitySchemaProperties(properties, undefined)).toEqual(properties);
  });

  it('accepts a bounded non-negative offset', () => {
    expect(parseIdentitySchemaOffset(undefined)).toBeUndefined();
    expect(parseIdentitySchemaOffset('0')).toBe(0);
    expect(parseIdentitySchemaOffset('12')).toBe(12);
    expect(parseIdentitySchemaOffset('1000')).toBe(1000);
  });

  it.each(['-1', '1.5', '1001', 'nope'])('rejects invalid offset %s', (value) => {
    expect(() => parseIdentitySchemaOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('skips properties before applying a limit', () => {
    const properties = [{ name: 'name' }, { name: 'tools' }, { name: 'goals' }];
    expect(selectIdentitySchemaProperties(selectIdentitySchemaOffsetProperties(properties, 1), 1)).toEqual([{ name: 'tools' }]);
  });

  it('pages JSON schema properties with offset before limit', () => {
    const parsed = JSON.parse(formatIdentitySchemaJson({
      properties: {
        name: { type: 'string' },
        tools: { type: 'array' },
        goals: { type: 'array' },
      },
    }, 1, 1)) as { properties: Array<{ name: string }> };
    expect(parsed.properties).toEqual([{ name: 'tools', type: 'array' }]);
  });
});
