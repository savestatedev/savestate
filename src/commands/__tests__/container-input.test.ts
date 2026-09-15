import { describe, expect, it } from 'vitest';
import { parseContainerInput } from '../container.js';

describe('savestate import --in', () => {
  it('defaults to undefined', () => {
    expect(parseContainerInput(undefined)).toBeUndefined();
  });

  it('accepts a single path', () => {
    expect(parseContainerInput('agent.savestate')).toBe('agent.savestate');
    expect(parseContainerInput('./imports/agent.savestate')).toBe('./imports/agent.savestate');
    expect(parseContainerInput(' agent.savestate ')).toBe('agent.savestate');
  });

  it.each(['', ' ', ',', 'a.savestate,b.savestate', 'agent.savestate other.savestate'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseContainerInput(value)).toThrow(
        `Invalid --in value "${value}". Expected a single non-empty path.`,
      );
    },
  );
});
