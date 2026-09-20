import { describe, expect, it } from 'vitest';
import { parseContainerExclude } from '../container.js';

describe('savestate container --exclude', () => {
  it('defaults to undefined', () => {
    expect(parseContainerExclude(undefined)).toBeUndefined();
  });

  it('accepts known state paths', () => {
    expect(parseContainerExclude('memory')).toEqual(['memory']);
    expect(parseContainerExclude('personality, tools')).toEqual(['personality', 'tools']);
    expect(parseContainerExclude('personality,memory,tools,preferences,conversation_history')).toEqual([
      'personality',
      'memory',
      'tools',
      'preferences',
      'conversation_history',
    ]);
    expect(parseContainerExclude(' Memory ')).toEqual(['memory']);
  });

  it.each(['nope', '', 'memory,bogus', ',,'])('rejects invalid value %s', (value) => {
    expect(() => parseContainerExclude(value)).toThrow(
      `Invalid --exclude value "${value}". Expected one or more of: personality, memory, tools, preferences, conversation_history.`,
    );
  });
});
