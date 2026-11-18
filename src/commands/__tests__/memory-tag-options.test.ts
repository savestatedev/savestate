import { describe, expect, it } from 'vitest';
import { parseMemoryTagOptions } from '../memory-cli.js';

describe('memory tag options', () => {
  it('accepts the singular alias', () => {
    expect(parseMemoryTagOptions(undefined, 'work, urgent')).toEqual(['work', 'urgent']);
  });

  it('rejects both spellings instead of silently ignoring one', () => {
    expect(() => parseMemoryTagOptions('work', 'urgent')).toThrow(
      'Use either --tags or --tag, not both.',
    );
  });
});
