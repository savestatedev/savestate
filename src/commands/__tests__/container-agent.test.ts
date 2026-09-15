import { describe, expect, it } from 'vitest';
import { parseContainerAgent } from '../container.js';

describe('savestate container --agent', () => {
  it('accepts a single agent id', () => {
    expect(parseContainerAgent('default')).toBe('default');
    expect(parseContainerAgent('my-agent')).toBe('my-agent');
    expect(parseContainerAgent(' other-agent ')).toBe('other-agent');
  });

  it.each(['', ' ', ',', 'my-agent,other-agent', 'my agent'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseContainerAgent(value)).toThrow(
        `Invalid --agent value "${value}". Expected a single non-empty agent id.`,
      );
    },
  );

  it('rejects a missing value', () => {
    expect(() => parseContainerAgent(undefined)).toThrow(
      'Invalid --agent value. Expected a single non-empty agent id.',
    );
  });
});
