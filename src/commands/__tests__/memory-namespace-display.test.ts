import { describe, expect, it } from 'vitest';
import { formatMemoryListNamespace } from '../memory.js';

describe('memory list namespace display', () => {
  it('marks memories without a namespace explicitly', () => {
    expect(formatMemoryListNamespace(undefined)).toBe('—');
  });

  it('truncates long namespaces without losing the label shape', () => {
    expect(formatMemoryListNamespace('org:very-long-application:agent:user'))
      .toBe('org:very-long-applica...');
  });
});
