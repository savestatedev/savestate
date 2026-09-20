import { describe, expect, it } from 'vitest';
import { parseContainerInclude } from '../container.js';

describe('savestate container --include', () => {
  it('defaults to undefined', () => {
    expect(parseContainerInclude(undefined)).toBeUndefined();
  });

  it('accepts known state paths', () => {
    expect(parseContainerInclude('memory')).toEqual(['memory']);
    expect(parseContainerInclude('personality, tools')).toEqual(['personality', 'tools']);
    expect(parseContainerInclude('personality,memory,tools,preferences,conversation_history')).toEqual([
      'personality',
      'memory',
      'tools',
      'preferences',
      'conversation_history',
    ]);
    expect(parseContainerInclude(' Memory ')).toEqual(['memory']);
  });

  it.each(['nope', '', 'memory,bogus', ',,'])('rejects invalid value %s', (value) => {
    expect(() => parseContainerInclude(value)).toThrow(
      `Invalid --include value "${value}". Expected one or more of: personality, memory, tools, preferences, conversation_history.`,
    );
  });
});
