import { describe, expect, it } from 'vitest';
import { parseIdentitySchemaLimit, selectIdentitySchemaProperties } from '../identity.js';

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
});
