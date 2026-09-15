import { describe, expect, it } from 'vitest';
import { parseContainerOutput } from '../container.js';

describe('savestate export --output', () => {
  it('defaults to undefined', () => {
    expect(parseContainerOutput(undefined)).toBeUndefined();
  });

  it('accepts a single path', () => {
    expect(parseContainerOutput('agent.savestate')).toBe('agent.savestate');
    expect(parseContainerOutput('./exports/agent.savestate')).toBe('./exports/agent.savestate');
    expect(parseContainerOutput(' agent.savestate ')).toBe('agent.savestate');
  });

  it.each(['', ' ', ',', 'a.savestate,b.savestate', 'agent.savestate other.savestate'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseContainerOutput(value)).toThrow(
        `Invalid --output value "${value}". Expected a single non-empty path.`,
      );
    },
  );
});
