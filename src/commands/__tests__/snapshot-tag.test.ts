import { describe, expect, it } from 'vitest';
import { parseSnapshotTag } from '../snapshot.js';

describe('savestate snapshot --tag', () => {
  it('defaults to undefined', () => {
    expect(parseSnapshotTag(undefined)).toBeUndefined();
  });

  it('accepts type:key=value entries', () => {
    expect(parseSnapshotTag('decision:api_provider=openai')).toEqual({
      type: 'decision',
      key: 'api_provider',
      value: 'openai',
      tags: [],
      metadata: {},
    });
    expect(parseSnapshotTag('preference:theme=dark')).toMatchObject({
      type: 'preference',
      key: 'theme',
      value: 'dark',
    });
    expect(parseSnapshotTag(' custom:model=gpt-4 ')).toMatchObject({
      type: 'custom',
      key: 'model',
      value: 'gpt-4',
    });
  });

  it.each(['', ' ', 'nocolon', 'decision:nokv', 'nope:key=value', 'decision:=value', 'decision:key='])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseSnapshotTag(value)).toThrow(
        `Invalid --tag value "${value}". Expected type:key=value with type one of: decision, preference, error, api_response, custom.`,
      );
    },
  );
});
