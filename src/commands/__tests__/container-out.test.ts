import { describe, expect, it } from 'vitest';
import { parseContainerOut } from '../container.js';

describe('savestate container export --out', () => {
  it('defaults to undefined', () => {
    expect(parseContainerOut(undefined)).toBeUndefined();
  });

  it('accepts a single path', () => {
    expect(parseContainerOut('agent.savestate')).toBe('agent.savestate');
    expect(parseContainerOut('./exports/agent.savestate')).toBe('./exports/agent.savestate');
    expect(parseContainerOut(' agent.savestate ')).toBe('agent.savestate');
  });

  it.each(['', ' ', ',', 'a.savestate,b.savestate', 'agent.savestate other.savestate'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseContainerOut(value)).toThrow(
        `Invalid --out value "${value}". Expected a single non-empty path.`,
      );
    },
  );
});
