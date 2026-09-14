import { describe, expect, it } from 'vitest';
import { parseAclProposer } from '../acl.js';

describe('savestate acl --proposer', () => {
  it('accepts a single proposer id', () => {
    expect(parseAclProposer('agent-1')).toBe('agent-1');
    expect(parseAclProposer('agent-proposer')).toBe('agent-proposer');
    expect(parseAclProposer(' agent-1 ')).toBe('agent-1');
  });

  it.each(['', ' ', ',', 'agent-1,agent-2', 'agent 1'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseAclProposer(value)).toThrow(
        `Invalid --proposer value "${value}". Expected a single non-empty proposer id.`,
      );
    },
  );

  it('rejects a missing value', () => {
    expect(() => parseAclProposer(undefined)).toThrow(
      'Invalid --proposer value. Expected a single non-empty proposer id.',
    );
  });
});
